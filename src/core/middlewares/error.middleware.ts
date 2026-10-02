import type { Request, Response, NextFunction } from 'express';
import { AppError, ErrorDemasiadosIntentos } from '../errors/AppError';
import { comoAppError, SEGUNDOS_REINTENTO } from '../errors/errores-prisma';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // Express reconoce el manejador de errores por tener cuatro parametros
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  const esDesarrollo = env.NODE_ENV === 'development';

  if (err instanceof ErrorDemasiadosIntentos) {
    res.setHeader('Retry-After', String(err.reintentarEnSegundos));
    res.status(429).json({
      success: false,
      error: err.message,
      reintentarEnSegundos: err.reintentarEnSegundos,
    });
    return;
  }

  // Un fallo de base de datos se traduce aqui una sola vez, no en cada endpoint
  const deLaBase = err instanceof AppError ? null : comoAppError(err);
  if (deLaBase) {
    console.error('Error de base de datos:', err);
    if (deLaBase.statusCode === 503) res.setHeader('Retry-After', String(SEGUNDOS_REINTENTO));
    res.status(deLaBase.statusCode).json({ success: false, error: deLaBase.message });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: esDesarrollo ? err.stack : undefined,
    });
    return;
  }

  // Errores no previstos: se registran completos en el servidor, pero fuera de
  // desarrollo el cliente solo recibe un mensaje generico (no se filtran detalles internos)
  console.error('Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: esDesarrollo ? err.message : 'Ocurrio un error interno. Intentalo mas tarde',
    stack: esDesarrollo ? err.stack : undefined,
  });
};
