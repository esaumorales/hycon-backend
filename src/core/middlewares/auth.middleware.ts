import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { extraerTokenDeCabecera, verificarToken } from '../utils/jwt';

// Exige un token valido y deja el payload en req.usuario
export const protect = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extraerTokenDeCabecera(req.headers.authorization);

    if (!token) {
      throw new AppError('No autenticado. Inicia sesion para continuar', 401);
    }

    req.usuario = verificarToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Igual que protect pero sin exigir sesion: si viene un token valido deja el usuario
 * en req.usuario, y si no, sigue como visitante. Lo usan las rutas publicas que
 * muestran mas contenido a quien ya compro.
 */
export const identificar = (req: Request, _res: Response, next: NextFunction) => {
  const token = extraerTokenDeCabecera(req.headers.authorization);
  if (!token) return next();

  try {
    req.usuario = verificarToken(token);
  } catch {
    // Un token caducado o invalido se ignora: la peticion sigue como visitante
  }
  next();
};

// Restringe el acceso a los roles indicados. Debe ir siempre despues de protect
export const restrictTo = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return next(new AppError('No autenticado. Inicia sesion para continuar', 401));
    }

    if (!roles.includes(req.usuario.rol)) {
      return next(new AppError('No tienes permisos para esta accion', 403));
    }

    next();
  };
};
