import { afterEach, describe, expect, it, vi } from 'vitest';
import { proveedorPedido, resolverSecretoJwt } from './env';

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

describe('proveedorPedido', () => {
  it('acepta los tres almacenes de video', () => {
    expect(proveedorPedido('youtube')).toBe('youtube');
    expect(proveedorPedido('r2')).toBe('r2');
    expect(proveedorPedido('stream')).toBe('stream');
  });

  it('no se queja por mayusculas ni espacios', () => {
    expect(proveedorPedido('  R2 ')).toBe('r2');
  });

  // Un valor mal escrito no puede dejar el servidor a medias
  it('ante un valor desconocido o ausente se queda en youtube', () => {
    expect(proveedorPedido('cloudflare')).toBe('youtube');
    expect(proveedorPedido(undefined)).toBe('youtube');
    expect(proveedorPedido('')).toBe('youtube');
  });
});

describe('proveedorVideoActivo', () => {
  // La configuracion se lee al importar: cada caso carga el modulo de nuevo
  const cargarCon = async (variables: Record<string, string>) => {
    vi.resetModules();
    Object.entries(variables).forEach(([clave, valor]) => vi.stubEnv(clave, valor));
    return import('./env');
  };

  const CLAVES_R2 = {
    VIDEO_PROVEEDOR: 'r2',
    R2_ACCOUNT_ID: 'cuenta',
    R2_ACCESS_KEY_ID: 'clave',
    R2_SECRET_ACCESS_KEY: 'secreto',
    R2_BUCKET: 'videos',
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('con las cuatro claves de R2 usa R2', async () => {
    const { proveedorVideoActivo, r2Completo } = await cargarCon(CLAVES_R2);

    expect(r2Completo()).toBe(true);
    expect(proveedorVideoActivo()).toBe('r2');
  });

  it('si falta una clave de R2 se queda en youtube en vez de romper las subidas', async () => {
    const { proveedorVideoActivo } = await cargarCon({ ...CLAVES_R2, R2_BUCKET: '' });

    expect(proveedorVideoActivo()).toBe('youtube');
  });

  it('con Stream configurado usa Stream', async () => {
    const { proveedorVideoActivo, streamCompleto } = await cargarCon({
      VIDEO_PROVEEDOR: 'stream',
      STREAM_ACCOUNT_ID: 'cuenta',
      STREAM_API_TOKEN: 'token',
      STREAM_DOMINIO: 'https://customer-abc.cloudflarestream.com/',
    });

    expect(streamCompleto()).toBe(true);
    expect(proveedorVideoActivo()).toBe('stream');
  });

  it('al dominio de Stream se le quitan el protocolo y la barra final', async () => {
    const { env } = await cargarCon({
      STREAM_DOMINIO: 'https://customer-abc.cloudflarestream.com/',
    });

    expect(env.STREAM.dominio).toBe('customer-abc.cloudflarestream.com');
  });

  it('sin el token de Stream se queda en youtube', async () => {
    const { proveedorVideoActivo } = await cargarCon({
      VIDEO_PROVEEDOR: 'stream',
      STREAM_ACCOUNT_ID: 'cuenta',
      STREAM_API_TOKEN: '',
      STREAM_DOMINIO: 'customer-abc.cloudflarestream.com',
    });

    expect(proveedorVideoActivo()).toBe('youtube');
  });
});
