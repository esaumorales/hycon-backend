import { describe, expect, it } from 'vitest';
import { comoAppError } from './errores-prisma';
import { AppError } from './AppError';

const errorPrisma = (code: string) => Object.assign(new Error('fallo de prisma'), { code });

describe('comoAppError', () => {
  it('el pool sin conexiones libres responde 503, no 500', () => {
    // P2028 es el que aparecia al listar productos con la base ocupada
    const traducido = comoAppError(errorPrisma('P2028'));

    expect(traducido).toBeInstanceOf(AppError);
    expect(traducido?.statusCode).toBe(503);
    expect(traducido?.message).toMatch(/saturado/i);
  });

  it('traduce los codigos habituales de Prisma', () => {
    expect(comoAppError(errorPrisma('P2024'))?.statusCode).toBe(503);
    expect(comoAppError(errorPrisma('P1001'))?.statusCode).toBe(503);
    expect(comoAppError(errorPrisma('P2002'))?.statusCode).toBe(409);
    expect(comoAppError(errorPrisma('P2003'))?.statusCode).toBe(409);
    expect(comoAppError(errorPrisma('P2025'))?.statusCode).toBe(404);
  });

  it('deja pasar lo que no es un error de base conocido', () => {
    expect(comoAppError(errorPrisma('P9999'))).toBeNull();
    expect(comoAppError(new Error('cualquier cosa'))).toBeNull();
    expect(comoAppError({ code: 'ECONNREFUSED' })).toBeNull();
    expect(comoAppError(null)).toBeNull();
  });
});
