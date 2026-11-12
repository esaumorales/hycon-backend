import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// El almacen se sustituye para no tocar disco ni Cloudinary de verdad.
// Las funciones se crean dentro de la fabrica porque vi.mock se eleva al inicio.
const { firmarSubida } = vi.hoisted(() => ({ firmarSubida: vi.fn() }));

vi.mock('./uploads.service', async (original) => {
  const real = await original<typeof import('./uploads.service')>();
  return {
    ...real,
    almacenCloudinary: { firmarSubida, eliminar: vi.fn(), esSuya: vi.fn(), publicIdDe: vi.fn() },
  };
});

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';

const admin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;

const firma = {
  cloudName: 'hycon-demo',
  apiKey: '123456789012345',
  timestamp: 1760000000,
  folder: 'hycon/catalogo',
  signature: 'a'.repeat(40),
};

beforeEach(() => {
  firmarSubida.mockReturnValue(firma);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('firma para el catalogo', () => {
  it('exige sesion de ADMIN', async () => {
    const sinSesion = await request(app).post('/api/v1/uploads/firma/catalogo');
    const comoCliente = await request(app)
      .post('/api/v1/uploads/firma/catalogo')
      .set('Authorization', cliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(firmarSubida).not.toHaveBeenCalled();
  });

  it('devuelve la firma sin el secreto', async () => {
    const respuesta = await request(app)
      .post('/api/v1/uploads/firma/catalogo')
      .set('Authorization', admin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.firma).toEqual(firma);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/secret/i);
    expect(firmarSubida).toHaveBeenCalledWith('catalogo');
  });
});

describe('firma para el avatar', () => {
  it('la puede pedir cualquiera con sesion, pero no un visitante', async () => {
    const sinSesion = await request(app).post('/api/v1/uploads/firma/avatar');
    const comoCliente = await request(app)
      .post('/api/v1/uploads/firma/avatar')
      .set('Authorization', cliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(200);
    // Las fotos de perfil van a su propia carpeta
    expect(firmarSubida).toHaveBeenCalledWith('avatares');
  });
});
