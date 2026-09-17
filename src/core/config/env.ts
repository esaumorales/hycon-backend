import dotenv from 'dotenv';
import path from 'path';

// Carga las variables de entorno desde la raiz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const EN_PRODUCCION = NODE_ENV === 'production';

const numero = (valor: string | undefined, porDefecto: number) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido > 0 ? convertido : porDefecto;
};

const LARGO_MINIMO_SECRETO = 32;

/**
 * El secreto que firma los tokens es obligatorio y largo en produccion:
 * con uno debil o por defecto cualquiera podria fabricar un token de ADMIN.
 * En desarrollo se tolera uno de relleno, pero se avisa.
 */
export const resolverSecretoJwt = (valor: string | undefined, produccion: boolean): string => {
  if (valor && valor.length >= LARGO_MINIMO_SECRETO) return valor;

  if (produccion) {
    throw new Error(
      `JWT_SECRET debe definirse con al menos ${LARGO_MINIMO_SECRETO} caracteres en produccion`
    );
  }
  if (process.env.VITEST === undefined) {
    console.warn(
      `[seguridad] JWT_SECRET falta o tiene menos de ${LARGO_MINIMO_SECRETO} caracteres. Solo es aceptable en desarrollo.`
    );
  }
  return valor || 'secreto-solo-para-desarrollo-no-usar-en-produccion';
};

const sameSite = (valor: string | undefined): 'lax' | 'strict' | 'none' =>
  valor === 'strict' || valor === 'none' ? valor : 'lax';

export const env = {
  NODE_ENV,
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: resolverSecretoJwt(process.env.JWT_SECRET, EN_PRODUCCION),
  // Origenes permitidos para CORS, separados por coma
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  // Direccion publica del backend: con ella se arman las URLs de las imagenes subidas
  PUBLIC_URL: (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, ''),
  // Carpeta donde se guardan los archivos subidos desde el panel
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../uploads'),

  // ---- Seguridad de acceso ----
  // Vida del token de acceso: corto, porque no se puede revocar antes de que caduque
  ACCESS_TOKEN_MINUTOS: numero(process.env.ACCESS_TOKEN_MINUTOS, 15),
  // Duracion maxima de una sesion sin "Recordarme" y con el
  SESION_HORAS: numero(process.env.SESION_HORAS, 12),
  SESION_RECORDAR_DIAS: numero(process.env.SESION_RECORDAR_DIAS, 30),
  // Intentos fallidos seguidos antes de bloquear y duracion del bloqueo
  LOGIN_MAX_INTENTOS: numero(process.env.LOGIN_MAX_INTENTOS, 5),
  LOGIN_BLOQUEO_MINUTOS: numero(process.env.LOGIN_BLOQUEO_MINUTOS, 15),
  // Peticiones por IP a las rutas de acceso en 15 minutos (frena ataques masivos)
  AUTH_LIMITE_POR_IP: numero(process.env.AUTH_LIMITE_POR_IP, 100),
  // La cookie de sesion solo viaja por HTTPS en produccion
  COOKIE_SECURE: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : EN_PRODUCCION,
  // 'none' solo si frontend y backend viven en dominios distintos (exige COOKIE_SECURE)
  COOKIE_SAMESITE: sameSite(process.env.COOKIE_SAMESITE),
  // Numero de proxies delante (Nginx, balanceador) para leer la IP real del cliente
  TRUST_PROXY: numero(process.env.TRUST_PROXY, 0),
};
