import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError';

// Valida req.body contra un esquema de Zod y reemplaza el body por el dato ya parseado
export const validate = (esquema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resultado = esquema.safeParse(req.body);

    if (!resultado.success) {
      // Se devuelve el primer mensaje para que el formulario tenga algo claro que mostrar
      const primerError = resultado.error.issues[0];
      const campo = primerError.path.join('.');
      const mensaje = campo ? `${campo}: ${primerError.message}` : primerError.message;
      return next(new AppError(mensaje, 422));
    }

    req.body = resultado.data;
    next();
  };
};
