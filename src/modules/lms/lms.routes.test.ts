import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./lms.service', () => ({ lmsService: { misCursos: vi.fn() } }));

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { lmsService } from './lms.service';

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
