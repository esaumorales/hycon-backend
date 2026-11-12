import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./lms.service', () => ({ lmsService: { misCursos: vi.fn() } }));
vi.mock('./certificados.service', async (original) => {
  const real = await original<typeof import('./certificados.service')>();
  return {
    ...real,
    certificadosService: { progreso: vi.fn(), marcarVista: vi.fn(), emitir: vi.fn() },
  };
});

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { lmsService } from './lms.service';
import { certificadosService } from './certificados.service';

const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;

describe('GET /api/v1/lms/mis-cursos', () => {
  const vacio = {
    elementos: [],
    paginacion: { pagina: 1, porPagina: 6, total: 0, totalPaginas: 1 },
  };

  beforeEach(() => {
    vi.mocked(lmsService.misCursos).mockResolvedValue(vacio);
  });

  it('exige sesion', async () => {
    const respuesta = await request(app).get('/api/v1/lms/mis-cursos');

    expect(respuesta.status).toBe(401);
    expect(lmsService.misCursos).not.toHaveBeenCalled();
  });

  it('devuelve los cursos del usuario del token, con su paginacion', async () => {
    vi.mocked(lmsService.misCursos).mockResolvedValue({
      elementos: [{ name: 'Logistica' }],
      paginacion: { pagina: 1, porPagina: 6, total: 1, totalPaginas: 1 },
    } as never);

    const respuesta = await request(app).get('/api/v1/lms/mis-cursos').set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.cursos).toHaveLength(1);
    expect(respuesta.body.data.paginacion).toMatchObject({ pagina: 1, total: 1 });
    expect(lmsService.misCursos).toHaveBeenCalledWith(7, {
      buscar: undefined,
      orden: 'recientes',
      pagina: 1,
      porPagina: 6,
    });
  });

  it('traslada los filtros de la URL', async () => {
    await request(app)
      .get('/api/v1/lms/mis-cursos?buscar=ergonomia&orden=nombre&pagina=2&porPagina=12')
      .set('Authorization', cliente);

    expect(lmsService.misCursos).toHaveBeenCalledWith(7, {
      buscar: 'ergonomia',
      orden: 'nombre',
      pagina: 2,
      porPagina: 12,
    });
  });

  // Un parametro mal escrito no puede tumbar la consulta: cae a su valor por defecto
  it('un filtro invalido cae al valor por defecto', async () => {
    await request(app)
      .get('/api/v1/lms/mis-cursos?pagina=abc&orden=lo-que-sea&porPagina=9999')
      .set('Authorization', cliente);

    expect(lmsService.misCursos).toHaveBeenCalledWith(7, {
      buscar: undefined,
      orden: 'recientes',
      pagina: 1,
      porPagina: 6,
    });
  });
});

const CURSO = '01a14cc6-333e-728f-874b-200eebe60b29';
const PARTE = '01a0fef2-0000-70bf-a4e4-000000000001';

const progreso = {
  cursoUuid: CURSO,
  curso: 'Mejora continua',
  partes: [],
  vistas: 0,
  total: 0,
  completado: false,
  certificado: null,
};

describe('progreso y certificado', () => {
  beforeEach(() => {
    vi.mocked(certificadosService.progreso).mockResolvedValue(progreso);
    vi.mocked(certificadosService.marcarVista).mockResolvedValue(progreso);
    vi.mocked(certificadosService.emitir).mockResolvedValue({
      codigo: 'HY-ABCD1234',
      nombre: 'Ana Quispe',
      curso: 'Mejora continua',
      duracionMinutos: 33,
      emitidoEl: '2026-11-04T12:00:00.000Z',
    });
  });

  it('el progreso exige sesion', async () => {
    const respuesta = await request(app).get(`/api/v1/lms/cursos/${CURSO}/progreso`);

    expect(respuesta.status).toBe(401);
    expect(certificadosService.progreso).not.toHaveBeenCalled();
  });

  it('el progreso se pide con el usuario del token', async () => {
    const respuesta = await request(app)
      .get(`/api/v1/lms/cursos/${CURSO}/progreso`)
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(certificadosService.progreso).toHaveBeenCalledWith(CURSO, 7);
  });

  it('marcar una parte como vista exige sesion', async () => {
    const respuesta = await request(app).post(
      `/api/v1/lms/cursos/${CURSO}/partes/${PARTE}/vista`
    );

    expect(respuesta.status).toBe(401);
  });

  it('marcar una parte devuelve el progreso al dia', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/lms/cursos/${CURSO}/partes/${PARTE}/vista`)
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(certificadosService.marcarVista).toHaveBeenCalledWith(CURSO, PARTE, 7);
  });

  it('emitir el certificado exige sesion', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/lms/cursos/${CURSO}/certificado`)
      .send({ nombre: 'Ana Quispe' });

    expect(respuesta.status).toBe(401);
    expect(certificadosService.emitir).not.toHaveBeenCalled();
  });

  it('emitir el certificado responde con el codigo', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/lms/cursos/${CURSO}/certificado`)
      .set('Authorization', cliente)
      .send({ nombre: 'Ana Quispe' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.certificado.codigo).toBe('HY-ABCD1234');
    expect(certificadosService.emitir).toHaveBeenCalledWith(CURSO, 7, { nombre: 'Ana Quispe' });
  });

  // El nombre se imprime en el documento: se valida antes de llegar al servicio
  it('rechaza un nombre que no es un nombre', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/lms/cursos/${CURSO}/certificado`)
      .set('Authorization', cliente)
      .send({ nombre: '<script>alert(1)</script>' });

    expect(respuesta.status).toBe(422);
    expect(certificadosService.emitir).not.toHaveBeenCalled();
  });

  it('el curso de la URL tiene que ser un uuid', async () => {
    const respuesta = await request(app)
      .get('/api/v1/lms/cursos/3/progreso')
      .set('Authorization', cliente);

    expect(respuesta.status).toBe(400);
  });
});
