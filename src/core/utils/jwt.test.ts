import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { extraerTokenDeCabecera, firmarToken, verificarToken } from './jwt';
import { env } from '../config/env';

const payload = { userId: 7, email: 'admin@hycon.com', rol: 'ADMIN' };

describe('extraerTokenDeCabecera', () => {
  it('extrae el token de una cabecera Bearer valida', () => {
    expect(extraerTokenDeCabecera('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('devuelve null si no hay cabecera o con otros esquemas', () => {
    expect(extraerTokenDeCabecera(undefined)).toBeNull();
    expect(extraerTokenDeCabecera('Basic abc')).toBeNull();
    expect(extraerTokenDeCabecera('abc.def.ghi')).toBeNull();
  });
});

describe('firmarToken / verificarToken', () => {
  it('recupera el payload original del token firmado', () => {
    expect(verificarToken(firmarToken(payload))).toEqual(payload);
  });

  it('el token de acceso es de corta duracion', () => {
    const datos = jwt.decode(firmarToken(payload)) as jwt.JwtPayload;
    expect((datos.exp as number) - (datos.iat as number)).toBe(env.ACCESS_TOKEN_MINUTOS * 60);
    expect(env.ACCESS_TOKEN_MINUTOS).toBeLessThanOrEqual(15);
  });

  it('dos tokens del mismo usuario y segundo son distintos', () => {
    expect(firmarToken(payload)).not.toBe(firmarToken(payload));
  });

  it('rechaza un token manipulado con 401', () => {
    const token = firmarToken(payload);
    const manipulado = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');

    expect(() => verificarToken(manipulado)).toThrowError(/invalido/i);
  });

  it('rechaza un token firmado con el mismo secreto pero para otro sistema', () => {
    const ajeno = jwt.sign(payload, env.JWT_SECRET, { issuer: 'otra-app', audience: 'hycon-app' });
    expect(() => verificarToken(ajeno)).toThrowError(/invalido/i);
  });

  it('rechaza tokens sin firma (alg none)', () => {
    const sinFirma = jwt.sign(payload, '', {
      algorithm: 'none',
      issuer: 'hycon-api',
      audience: 'hycon-app',
    });
    expect(() => verificarToken(sinFirma)).toThrowError(/invalido/i);
  });

  it('distingue un token caducado', () => {
    const caducado = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 10 }, env.JWT_SECRET, {
      issuer: 'hycon-api',
      audience: 'hycon-app',
    });
    expect(() => verificarToken(caducado)).toThrowError(/expiro/i);
  });
});
