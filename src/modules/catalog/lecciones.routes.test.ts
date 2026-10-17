import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./lecciones.service', () => ({
  leccionesService: {
    listarPublicas: vi.fn(),
    listarParaAdmin: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    reordenar: vi.fn(),
  },
}));

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { leccionesService } from './lecciones.service';

const CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';
const LECCION = '01a0fef2-19c0-70bf-a4e4-2e1a85443aef';
const BASE = `/api/v1/catalog/courses/${CURSO}/lecciones`;

const admin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;
const cuerpo = { title: 'Introduccion', esMuestra: false };

const temario = { cursoUuid: CURSO, tieneAcceso: false, previewSegundos: 60, lecciones: [] };

describe('temario publico', () => {
  beforeEach(() => {
    vi.mocked(leccionesService.listarPublicas).mockResolvedValue(temario);
  });

  it('un visitante sin sesion lo consulta sin usuario', async () => {
    const respuesta = await request(app).get(BASE);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.temario).toBeDefined();
    expect(leccionesService.listarPublicas).toHaveBeenCalledWith(CURSO, undefined);
  });

  it('con sesion se consulta con el usuario, para desbloquear lo comprado', async () => {
    await request(app).get(BASE).set('Authorization', cliente);

    expect(leccionesService.listarPublicas).toHaveBeenCalledWith(CURSO, 7);
  });

  it('un token invalido no rompe la consulta: se atiende como visitante', async () => {
    const respuesta = await request(app).get(BASE).set('Authorization', 'Bearer roto');

    expect(respuesta.status).toBe(200);
    expect(leccionesService.listarPublicas).toHaveBeenCalledWith(CURSO, undefined);
  });

  it('el curso de la URL tiene que ser un uuid', async () => {
    const respuesta = await request(app).get('/api/v1/catalog/courses/3/lecciones');

    expect(respuesta.status).toBe(400);
  });
});

describe('administrar el temario', () => {
  beforeEach(() => {
    vi.mocked(leccionesService.listarParaAdmin).mockResolvedValue(temario);
    vi.mocked(leccionesService.crear).mockResolvedValue({ uuid: LECCION } as never);
    vi.mocked(leccionesService.actualizar).mockResolvedValue({ uuid: LECCION } as never);
    vi.mocked(leccionesService.eliminar).mockResolvedValue(undefined);
    vi.mocked(leccionesService.reordenar).mockResolvedValue(temario);
  });

  it('crear, editar, eliminar y reordenar son solo de ADMIN', async () => {
    const sinSesion = await request(app).post(BASE).send(cuerpo);
    const comoCliente = await request(app).post(BASE).set('Authorization', cliente).send(cuerpo);
    const editar = await request(app).put(`${BASE}/${LECCION}`).set('Authorization', cliente).send(cuerpo);
    const borrar = await request(app).delete(`${BASE}/${LECCION}`).set('Authorization', cliente);
    const ordenar = await request(app)
      .put(`${BASE}/orden`)
      .set('Authorization', cliente)
      .send({ orden: [LECCION] });
    const verAdmin = await request(app).get(`${BASE}/admin`).set('Authorization', cliente);

    expect(sinSesion.status).toBe(401);
    expect([comoCliente.status, editar.status, borrar.status, ordenar.status, verAdmin.status]).toEqual([
      403, 403, 403, 403, 403,
    ]);
    expect(leccionesService.crear).not.toHaveBeenCalled();
  });

  it('el ADMIN crea una leccion con el cuerpo validado', async () => {
    const respuesta = await request(app)
      .post(BASE)
      .set('Authorization', admin)
      .send({ ...cuerpo, durationMinutes: 8, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' });

    expect(respuesta.status).toBe(201);
    expect(leccionesService.crear).toHaveBeenCalledWith(
      CURSO,
      expect.objectContaining({ title: 'Introduccion', durationMinutes: 8, esMuestra: false })
    );
  });

  it('rechaza un video que no es de YouTube y un titulo corto', async () => {
    const videoRaro = await request(app)
      .post(BASE)
      .set('Authorization', admin)
      .send({ ...cuerpo, videoUrl: 'https://vimeo.com/123' });
    const tituloCorto = await request(app)
      .post(BASE)
      .set('Authorization', admin)
      .send({ ...cuerpo, title: 'A' });

    expect(videoRaro.status).toBe(422);
    expect(tituloCorto.status).toBe(422);
    expect(leccionesService.crear).not.toHaveBeenCalled();
  });

  it('el ADMIN edita y elimina una leccion concreta', async () => {
    const editar = await request(app).put(`${BASE}/${LECCION}`).set('Authorization', admin).send(cuerpo);
    const borrar = await request(app).delete(`${BASE}/${LECCION}`).set('Authorization', admin);

    expect(editar.status).toBe(200);
    expect(borrar.status).toBe(204);
    expect(leccionesService.actualizar).toHaveBeenCalledWith(CURSO, LECCION, expect.any(Object));
    expect(leccionesService.eliminar).toHaveBeenCalledWith(CURSO, LECCION);
  });

  it('el ADMIN reordena enviando la lista de uuids', async () => {
    const respuesta = await request(app)
      .put(`${BASE}/orden`)
      .set('Authorization', admin)
      .send({ orden: [LECCION, CURSO] });

    expect(respuesta.status).toBe(200);
    expect(leccionesService.reordenar).toHaveBeenCalledWith(CURSO, [LECCION, CURSO]);
  });

  it('un orden vacio o con algo que no es uuid no llega al servicio', async () => {
    const vacio = await request(app).put(`${BASE}/orden`).set('Authorization', admin).send({ orden: [] });
    const invalido = await request(app)
      .put(`${BASE}/orden`)
      .set('Authorization', admin)
      .send({ orden: ['3'] });

    expect(vacio.status).toBe(422);
    expect(invalido.status).toBe(422);
    expect(leccionesService.reordenar).not.toHaveBeenCalled();
  });
});
