import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// El almacen se sustituye para no firmar contra R2 ni Cloudflare de verdad.
// Las funciones se crean dentro de la fabrica porque vi.mock se eleva al inicio.
const { firmarSubida } = vi.hoisted(() => ({ firmarSubida: vi.fn() }));

vi.mock('./videos.service', async (original) => {
  const real = await original<typeof import('./videos.service')>();
  return {
    ...real,
    almacenVideos: {
      proveedor: 'r2',
      aceptaSubidas: true,
      firmarSubida,
      reproducir: vi.fn(),
      eliminar: vi.fn(),
    },
  };
});

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';

const admin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;

const CURSO = '01a0fef2-19c0-70bf-a4e4-2e1a85443aef';

const subida = {
  proveedor: 'r2',
  metodo: 'PUT',
  url: 'https://bucket.r2.cloudflarestorage.com/hycon/cursos/a.mp4?X-Amz-Signature=abc',
  referencia: 'r2:cursos/01a0/a.mp4',
  campoArchivo: null,
};

beforeEach(() => {
  firmarSubida.mockResolvedValue(subida);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('almacen de videos configurado', () => {
  it('exige sesion de ADMIN', async () => {
    const sinSesion = await request(app).get('/api/v1/media/videos');
    const comoCliente = await request(app).get('/api/v1/media/videos').set('Authorization', cliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
  });

  // Con esto el panel decide si ofrece subir un archivo o solo pedir un enlace
  it('dice que proveedor hay y si acepta subidas', async () => {
    const respuesta = await request(app).get('/api/v1/media/videos').set('Authorization', admin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.almacen).toMatchObject({ proveedor: 'r2', aceptaSubidas: true });
    expect(respuesta.body.data.almacen.extensiones).toContain('mp4');
    expect(respuesta.body.data.almacen.maximoMb).toBeGreaterThan(0);
  });
});

describe('firma para subir un video', () => {
  it('exige sesion de ADMIN', async () => {
    const sinSesion = await request(app)
      .post('/api/v1/media/videos/firma')
      .send({ cursoUuid: CURSO, nombre: 'clase.mp4' });
    const comoCliente = await request(app)
      .post('/api/v1/media/videos/firma')
      .set('Authorization', cliente)
      .send({ cursoUuid: CURSO, nombre: 'clase.mp4' });

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(firmarSubida).not.toHaveBeenCalled();
  });

  it('devuelve el destino firmado y la referencia que hay que guardar', async () => {
    const respuesta = await request(app)
      .post('/api/v1/media/videos/firma')
      .set('Authorization', admin)
      .send({ cursoUuid: CURSO, nombre: 'clase.mp4' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.subida).toEqual(subida);
    expect(firmarSubida).toHaveBeenCalledWith(CURSO, 'clase.mp4');
  });

  it('pide el curso y el nombre del archivo', async () => {
    const sinCurso = await request(app)
      .post('/api/v1/media/videos/firma')
      .set('Authorization', admin)
      .send({ nombre: 'clase.mp4' });
    const sinNombre = await request(app)
      .post('/api/v1/media/videos/firma')
      .set('Authorization', admin)
      .send({ cursoUuid: CURSO, nombre: '   ' });

    expect(sinCurso.status).toBe(422);
    expect(sinNombre.status).toBe(422);
    expect(firmarSubida).not.toHaveBeenCalled();
  });

  it('traslada el motivo cuando el almacen rechaza el archivo', async () => {
    const { AppError } = await import('../../core/errors/AppError');
    firmarSubida.mockRejectedValue(new AppError('Formato no permitido. Usa MP4, WEBM', 415));

    const respuesta = await request(app)
      .post('/api/v1/media/videos/firma')
      .set('Authorization', admin)
      .send({ cursoUuid: CURSO, nombre: 'virus.exe' });

    expect(respuesta.status).toBe(415);
    expect(respuesta.body.error).toMatch(/formato no permitido/i);
  });
});
