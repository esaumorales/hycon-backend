import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';

const idSchema = z.coerce.number().int().positive();
const uuidSchema = z.string().uuid();

// Envoltorio para no repetir try/catch en cada controlador
export const manejar =
  (accion: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    accion(req, res).catch(next);
  };

export const leerId = (req: Request): number => {
  const resultado = idSchema.safeParse(req.params.id);
  if (!resultado.success) {
    throw new AppError('El identificador debe ser un numero entero positivo', 400);
  }
  return resultado.data;
};

// Identificador publico de catalogo: por la URL solo viaja el uuid, nunca el correlativo
export const leerUuid = (req: Request): string => {
  const resultado = uuidSchema.safeParse(req.params.uuid);
  if (!resultado.success) {
    throw new AppError('El identificador debe ser un uuid valido', 400);
  }
  return resultado.data;
};

// El autor o propietario de un registro sale siempre del token, nunca del body
export const obtenerUsuarioId = (req: Request): number => {
  if (!req.usuario) {
    throw new AppError('No autenticado. Inicia sesion para continuar', 401);
  }
  return req.usuario.userId;
};
