import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Las rutas se prueban sin base de datos: el servicio se sustituye
vi.mock('./cotizaciones.service', async (original) => {
  const real = await original<typeof import('./cotizaciones.service')>();
  return {
    ...real,
    cotizacionesService: { evaluaciones: vi.fn(), crear: vi.fn(), listar: vi.fn() },
  };
});

import { app } from '../../app';
import { firmarToken } from '../../core/utils/jwt';
import { cotizacionesService } from './cotizaciones.service';
import { EVALUACIONES } from './cotizaciones.constants';

const admin = `Bearer ${firmarToken({ userId: 1, email: 'info@hycon.lat', rol: 'ADMIN' })}`;
const cliente = `Bearer ${firmarToken({ userId: 7, email: 'ana@hycon.com', rol: 'CLIENTE' })}`;

const cuerpo = {
  name: 'Ana Quispe',
  phone: '902665565',
  email: 'ana@empresa.com',
  evaluaciones: ['levantamiento-cargas'],
};

describe('/api/v1/cotizaciones', () => {
  beforeEach(() => {
    vi.mocked(cotizacionesService.evaluaciones).mockReturnValue(EVALUACIONES);
    vi.mocked(cotizacionesService.crear).mockResolvedValue({
      codigo: 'COT-C91E77',
      total: 200,
    } as never);
    vi.mocked(cotizacionesService.listar).mockResolvedValue({
      elementos: [],
      paginacion: { pagina: 1, porPagina: 6, total: 0, totalPaginas: 1 },
    } as never);
  });

  it('cualquiera puede ver las evaluaciones y sus precios', async () => {
    const respuesta = await request(app).get('/api/v1/cotizaciones/evaluaciones');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.evaluaciones).toHaveLength(4);
    expect(respuesta.body.data.evaluaciones[0]).toHaveProperty('norma');
  });

  it('el formulario se envia sin sesion y devuelve el codigo', async () => {
    const respuesta = await request(app).post('/api/v1/cotizaciones').send(cuerpo);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.cotizacion.codigo).toBe('COT-C91E77');
    expect(cotizacionesService.crear).toHaveBeenCalledWith(expect.objectContaining(cuerpo));
  });

  it('un cuerpo incompleto no llega al servicio', async () => {
    const sinEvaluaciones = await request(app)
      .post('/api/v1/cotizaciones')
      .send({ ...cuerpo, evaluaciones: [] });
    const correoMalo = await request(app)
      .post('/api/v1/cotizaciones')
      .send({ ...cuerpo, email: 'no-es-correo' });
    const inventada = await request(app)
      .post('/api/v1/cotizaciones')
      .send({ ...cuerpo, evaluaciones: ['masaje-gratis'] });

    expect([sinEvaluaciones.status, correoMalo.status, inventada.status]).toEqual([422, 422, 422]);
    expect(cotizacionesService.crear).not.toHaveBeenCalled();
  });

  it('ver las solicitudes recibidas es solo de ADMIN', async () => {
    const sinSesion = await request(app).get('/api/v1/cotizaciones');
    const comoCliente = await request(app).get('/api/v1/cotizaciones').set('Authorization', cliente);
    const comoAdmin = await request(app)
      .get('/api/v1/cotizaciones?pagina=2')
      .set('Authorization', admin);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(comoAdmin.status).toBe(200);
    expect(cotizacionesService.listar).toHaveBeenCalledWith({ pagina: 2, porPagina: 6 });
  });
});
