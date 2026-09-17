import { describe, expect, it } from 'vitest';
import { resolverSecretoJwt } from './env';

describe('resolverSecretoJwt', () => {
  it('acepta un secreto largo en cualquier entorno', () => {
    const secreto = 'x'.repeat(32);
    expect(resolverSecretoJwt(secreto, true)).toBe(secreto);
    expect(resolverSecretoJwt(secreto, false)).toBe(secreto);
  });

  it('impide arrancar en produccion sin secreto o con uno corto', () => {
    expect(() => resolverSecretoJwt(undefined, true)).toThrow(/JWT_SECRET/);
    expect(() => resolverSecretoJwt('supersecretkey', true)).toThrow(/32 caracteres/);
  });

  it('en desarrollo permite seguir con un secreto de relleno', () => {
    expect(resolverSecretoJwt(undefined, false).length).toBeGreaterThanOrEqual(32);
  });
});
