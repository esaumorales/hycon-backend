import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Cada caso vuelve a importar la aplicacion entera: con la maquina cargada
// los 5 s por defecto se quedan cortos sin que haya nada roto
vi.setConfig({ testTimeout: 20000 });

/**
 * Como se comporta el servidor cuando NODE_ENV=production. La configuracion se
 * lee al importar, asi que cada caso carga la aplicacion de nuevo.
 */
const cargarApp = async (variables: Record<string, string> = {}) => {
  vi.resetModules();
  Object.entries({
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(40),
    ...variables,
  }).forEach(([clave, valor]) => vi.stubEnv(clave, valor));

  const { app } = await import('./app');
  return app;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('en produccion no se regala informacion del servidor', () => {
  // Publicarla seria dar el mapa de todo lo que acepta la API
  it('la documentacion de la API no se publica', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/docs-secrets-a1b2c3d4e5f6');

    expect(respuesta.status).toBe(404);
  });

  it('se puede abrir a proposito en un despliegue concreto', async () => {
    const app = await cargarApp({ API_DOCS: 'true' });

    const respuesta = await request(app).get('/docs-secrets-a1b2c3d4e5f6');

    expect(respuesta.status).toBe(200);
  });

  it('la sonda de salud no cuenta en que entorno corre', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ success: true, estado: 'ok' });
  });

  it('no anuncia que el servidor es Express', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/health');

    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  it('manda las cabeceras de seguridad de helmet', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/health');

    expect(respuesta.headers['content-security-policy']).toContain("default-src 'self'");
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('errores en produccion', () => {
  // Una traza revela rutas internas y versiones: fuera de desarrollo no viaja
  it('un error no devuelve la traza ni el detalle interno', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/api/v1/catalog/courses/no-es-uuid');

    expect(respuesta.status).toBeGreaterThanOrEqual(400);
    expect(respuesta.body).not.toHaveProperty('stack');
    expect(JSON.stringify(respuesta.body)).not.toMatch(/at .+\(.*src.*\)/);
  });

  it('una ruta que no existe responde sin filtrar nada', async () => {
    const app = await cargarApp();

    const respuesta = await request(app).get('/api/v1/lo-que-sea');

    expect(respuesta.status).toBe(404);
    expect(JSON.stringify(respuesta.body)).not.toContain('Express');
  });
});

describe('arranque seguro', () => {
  // Con un secreto debil cualquiera podria fabricarse un token de ADMIN
  it('no arranca en produccion sin un JWT_SECRET largo', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'corto');

    await expect(import('./app')).rejects.toThrow(/JWT_SECRET/);
  });
});
