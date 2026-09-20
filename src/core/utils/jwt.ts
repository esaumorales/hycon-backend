import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

// Datos que viajan dentro del token. Se mantiene minimo a proposito:
// solo lo necesario para autorizar sin volver a consultar la base en cada request.
export interface TokenPayload {
  userId: number;
  email: string;
  rol: string;
}

// Emisor y destinatario fijos: un token firmado para otro sistema con el mismo secreto no sirve aqui
const EMISOR = 'hycon-api';
const AUDIENCIA = 'hycon-app';
const ALGORITMO = 'HS256';

export const firmarToken = (payload: TokenPayload): string =>
  jwt.sign({ userId: payload.userId, email: payload.email, rol: payload.rol }, env.JWT_SECRET, {
    algorithm: ALGORITMO,
    expiresIn: env.ACCESS_TOKEN_MINUTOS * 60,
    issuer: EMISOR,
    audience: AUDIENCIA,
    // Identificador unico: dos tokens emitidos en el mismo segundo nunca son iguales
    jwtid: randomUUID(),
  });

export const verificarToken = (token: string): TokenPayload => {
  try {
    // El algoritmo se fija: evita ataques que cambian el "alg" de la cabecera
    const datos = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [ALGORITMO],
      issuer: EMISOR,
      audience: AUDIENCIA,
    }) as jwt.JwtPayload & TokenPayload;
    return { userId: datos.userId, email: datos.email, rol: datos.rol };
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
