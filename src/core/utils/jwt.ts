import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

// Datos que viajan dentro del token. Se mantiene minimo a proposito:
// solo lo necesario para autorizar sin volver a consultar la base en cada request.
export interface TokenPayload {
  userId: number;
  email: string;
  rol: string;
}

export const firmarToken = (payload: TokenPayload): string => {
  const opciones = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign(payload, env.JWT_SECRET, opciones);
};

export const verificarToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('La sesion expiro, vuelve a iniciar sesion', 401);
    }
    throw new AppError('Token invalido', 401);
  }
};

// Extrae el token de una cabecera "Authorization: Bearer <token>"
export const extraerTokenDeCabecera = (cabecera?: string): string | null => {
  if (!cabecera) return null;
  const [esquema, token] = cabecera.split(' ');
  if (esquema !== 'Bearer' || !token) return null;
  return token.trim() || null;
};
