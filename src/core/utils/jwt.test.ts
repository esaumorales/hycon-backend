import { describe, expect, it } from 'vitest';
import { extraerTokenDeCabecera, firmarToken, verificarToken } from './jwt';

describe('extraerTokenDeCabecera', () => {
  it('extrae el token de una cabecera Bearer valida', () => {
    expect(extraerTokenDeCabecera('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('devuelve null si no hay cabecera', () => {
    expect(extraerTokenDeCabecera(undefined)).toBeNull();
  });

  it('devuelve null con otros esquemas de autorizacion', () => {
    expect(extraerTokenDeCabecera('Basic abc')).toBeNull();
    expect(extraerTokenDeCabecera('abc.def.ghi')).toBeNull();
  });
});

describe('firmarToken / verificarToken', () => {
  it('recupera el payload original del token firmado', () => {
    const token = firmarToken({ userId: 7, email: 'admin@hycon.com', rol: 'ADMIN' });
    const payload = verificarToken(token);

    expect(payload.userId).toBe(7);
    expect(payload.rol).toBe('ADMIN');
  });

  it('rechaza un token manipulado con 401', () => {
    const token = firmarToken({ userId: 7, email: 'admin@hycon.com', rol: 'CLIENTE' });
    // Se cambia el ultimo caracter de la firma
    const manipulado = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');

    expect(() => verificarToken(manipulado)).toThrowError(/invalido/i);
  });
});
