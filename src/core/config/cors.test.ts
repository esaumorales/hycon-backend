import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { env } from './env';

// Los origenes vienen del .env; las pruebas comprueban el comportamiento con esa lista
const permitido = env.CORS_ORIGINS[0];

describe('CORS', () => {
  it('la lista de origenes sale del entorno y no esta vacia', () => {
    expect(env.CORS_ORIGINS.length).toBeGreaterThan(0);
  });

  it('deja pasar un origen de la lista y le permite enviar la cookie', async () => {
    const respuesta = await request(app)
      .get('/api/v1/catalog/shipping-agencies')
      .set('Origin', permitido);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['access-control-allow-origin']).toBe(permitido);
    expect(respuesta.headers['access-control-allow-credentials']).toBe('true');
  });

  it('responde al preflight del navegador antes de una peticion con token', async () => {
    const respuesta = await request(app)
      .options('/api/v1/auth/me')
      .set('Origin', permitido)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(respuesta.status).toBeLessThan(300);
    expect(respuesta.headers['access-control-allow-origin']).toBe(permitido);
    expect(respuesta.headers['access-control-allow-headers']).toMatch(/authorization/i);
  });

  it('un origen que no esta en la lista queda fuera', async () => {
    const respuesta = await request(app)
      .get('/api/v1/catalog/shipping-agencies')
      .set('Origin', 'https://sitio-ajeno.example');

    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    expect(respuesta.status).toBe(403);
  });

  it('las peticiones sin origen (curl, sondas) siguen funcionando', async () => {
    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
  });
});
