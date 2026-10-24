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

const PROVEEDORES_VIDEO = ['youtube', 'r2', 'stream'] as const;
export type ProveedorPedido = (typeof PROVEEDORES_VIDEO)[number];

// Un valor desconocido no debe dejar el servidor a medias: se avisa y se usa youtube
export const proveedorPedido = (valor: string | undefined): ProveedorPedido => {
  const pedido = (valor ?? 'youtube').trim().toLowerCase();
  if ((PROVEEDORES_VIDEO as readonly string[]).includes(pedido)) return pedido as ProveedorPedido;

  if (process.env.VITEST === undefined) {
    console.error(
      `[video] VIDEO_PROVEEDOR="${valor}" no existe. Usa youtube, r2 o stream. Se queda en youtube.`
    );
  }
  return 'youtube';
};

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
  // La documentacion de la API solo se publica fuera de produccion
  API_DOCS: process.env.API_DOCS ? process.env.API_DOCS === 'true' : !EN_PRODUCCION,

  // ---- Cloudinary ----
  // Con las tres claves puestas, las imagenes se suben alli; si faltan,
  // se guardan en disco como hasta ahora
  CLOUDINARY: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    carpeta: process.env.CLOUDINARY_CARPETA ?? 'hycon',
  },

  // ---- Video de los cursos ----
  // Donde se guardan los videos nuevos: 'youtube' (solo enlaces), 'r2' o 'stream'.
  // Cambiar esto no toca los videos ya subidos: cada leccion recuerda de donde
  // sale el suyo, asi que conviven los tres sin migrar nada.
  VIDEO_PROVEEDOR: proveedorPedido(process.env.VIDEO_PROVEEDOR),
  // Minutos que vive el enlace firmado de un video
  VIDEO_FIRMA_MINUTOS: numero(process.env.VIDEO_FIRMA_MINUTOS, 120),
  // Peso maximo de un video subido desde el panel
  VIDEO_MAXIMO_MB: numero(process.env.VIDEO_MAXIMO_MB, 1024),
  // Duracion maxima que acepta Cloudflare Stream por video
  VIDEO_MAXIMO_MINUTOS: numero(process.env.VIDEO_MAXIMO_MINUTOS, 240),

  R2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    carpeta: process.env.R2_CARPETA ?? 'cursos',
  },

  STREAM: {
    accountId: process.env.STREAM_ACCOUNT_ID ?? '',
    apiToken: process.env.STREAM_API_TOKEN ?? '',
    dominio: (process.env.STREAM_DOMINIO ?? '').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
  },
};

/** Cloudinary solo se usa si estan las tres credenciales. */
export const cloudinaryActivo = (): boolean =>
  Boolean(env.CLOUDINARY.cloudName && env.CLOUDINARY.apiKey && env.CLOUDINARY.apiSecret);

/** Las tres credenciales de R2 y el bucket son imprescindibles. */
export const r2Completo = (): boolean =>
  Boolean(env.R2.accountId && env.R2.accessKeyId && env.R2.secretAccessKey && env.R2.bucket);

/** Stream necesita la cuenta, un token con permiso de Stream y el dominio del reproductor. */
export const streamCompleto = (): boolean =>
  Boolean(env.STREAM.accountId && env.STREAM.apiToken && env.STREAM.dominio);

/**
 * Proveedor que de verdad se puede usar. Si se pide uno sin terminar de
 * configurar, se avisa en el arranque y los videos nuevos siguen siendo
 * enlaces de YouTube en vez de fallar al subir.
 */
export const proveedorVideoActivo = (): ProveedorPedido => {
  const pedido = env.VIDEO_PROVEEDOR;
  if (pedido === 'r2' && !r2Completo()) {
    if (process.env.VITEST === undefined) {
      console.error('[video] VIDEO_PROVEEDOR=r2 pero faltan las claves R2_*. Se queda en youtube.');
    }
    return 'youtube';
  }
  if (pedido === 'stream' && !streamCompleto()) {
    if (process.env.VITEST === undefined) {
      console.error('[video] VIDEO_PROVEEDOR=stream pero faltan las claves STREAM_*. Se queda en youtube.');
    }
    return 'youtube';
  }
  return pedido;
};
