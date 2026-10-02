import { AppError } from './AppError';

// Errores de Prisma que tienen una respuesta clara para el cliente.
// Todo lo demas sigue siendo un 500 con el detalle solo en el log.
const RESPUESTAS: Record<string, { estado: number; mensaje: string }> = {
  // Sin conexiones libres en el pool o transaccion que no pudo arrancar a tiempo
  P2024: { estado: 503, mensaje: 'El servidor esta saturado. Vuelve a intentarlo en unos segundos' },
  P2028: { estado: 503, mensaje: 'El servidor esta saturado. Vuelve a intentarlo en unos segundos' },
  // La base no responde o se cayo la conexion
  P1001: { estado: 503, mensaje: 'No hay conexion con la base de datos. Intentalo mas tarde' },
  P1002: { estado: 503, mensaje: 'No hay conexion con la base de datos. Intentalo mas tarde' },
  P1008: { estado: 503, mensaje: 'La consulta tardo demasiado. Intentalo de nuevo' },
  P1017: { estado: 503, mensaje: 'No hay conexion con la base de datos. Intentalo mas tarde' },
  P2002: { estado: 409, mensaje: 'Ya existe un registro con esos datos' },
  P2003: { estado: 409, mensaje: 'El registro esta en uso por otros datos y no se puede modificar' },
  P2025: { estado: 404, mensaje: 'El registro no existe' },
};

// Los errores de Prisma traen un codigo PXXXX; se reconocen por ahi para no
// depender de las clases generadas del cliente
const codigoDe = (error: unknown): string | undefined => {
  const codigo = (error as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' && /^P\d{4}$/.test(codigo) ? codigo : undefined;
};

/** Traduce un error de Prisma a un AppError. Devuelve null si no es de los previstos. */
export const comoAppError = (error: unknown): AppError | null => {
  const codigo = codigoDe(error);
  const respuesta = codigo ? RESPUESTAS[codigo] : undefined;
  return respuesta ? new AppError(respuesta.mensaje, respuesta.estado) : null;
};

// Al cliente se le dice cuando reintentar en lugar de dejarlo adivinar
export const SEGUNDOS_REINTENTO = 5;
