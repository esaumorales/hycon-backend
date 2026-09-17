import dotenv from 'dotenv';
import path from 'path';

// Carga las variables de entorno desde la raiz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = Number(process.env.PORT) || 4000;

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretkey',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // Origenes permitidos para CORS, separados por coma
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  // Direccion publica del backend: con ella se arman las URLs de las imagenes subidas
  PUBLIC_URL: (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, ''),
  // Carpeta donde se guardan los archivos subidos desde el panel
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../uploads'),
};
