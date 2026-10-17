import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./lms.service', () => ({ lmsService: { misCursos: vi.fn() } }));

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { lmsService } from './lms.service';

const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;

describe('GET /api/v1/lms/mis-cursos', () => {
  beforeEach(() => {
    vi.mocked(lmsService.misCursos).mockResolvedValue([]);
  });

  it('exige sesion', async () => {
    const respuesta = await request(app).get('/api/v1/lms/mis-cursos');

    expect(respuesta.status).toBe(401);
    expect(lmsService.misCursos).not.toHaveBeenCalled();
  });

  it('devuelve los cursos del usuario del token', async () => {
    vi.mocked(lmsService.misCursos).mockResolvedValue([{ name: 'Logistica' }] as never);

    const respuesta = await request(app).get('/api/v1/lms/mis-cursos').set('Authorization', cliente);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.cursos).toHaveLength(1);
    expect(lmsService.misCursos).toHaveBeenCalledWith(7);
  });
});
