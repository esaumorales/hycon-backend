import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../core/errors/AppError';
import { TAMANO_MAXIMO_IMAGEN } from './uploads.service';

export const CAMPO_IMAGEN = 'imagen';

// En memoria: el archivo se valida por su firma antes de escribir nada en disco
const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_IMAGEN, files: 1 },
}).single(CAMPO_IMAGEN);

/** Recoge la imagen del formulario y traduce los errores de multer a mensajes claros. */
export const recibirImagen = (req: Request, res: Response, next: NextFunction) => {
  recibir(req, res, (error: unknown) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('La imagen supera el maximo de 5 MB', 413));
      }
      return next(new AppError(`Envia un solo archivo en el campo "${CAMPO_IMAGEN}"`, 400));
    }
    return next(error);
  });
};

/** El archivo recibido, ya comprobado de que llego. */
export const exigirArchivo = (req: Request): Buffer => {
  if (!req.file) {
    throw new AppError(`Adjunta una imagen en el campo "${CAMPO_IMAGEN}"`, 400);
  }
  return req.file.buffer;
};
