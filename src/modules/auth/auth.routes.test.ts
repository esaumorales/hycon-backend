import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('./auth.service', () => ({
  authService: {
    registrar: vi.fn(),
    iniciarSesion: vi.fn(),
    renovarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    obtenerPerfil: vi.fn(),
  },
}));

import { app } from '../../app';
import { AppError, ErrorDemasiadosIntentos } from '../../core/errors/AppError';
import { authService } from './auth.service';

const usuario = {
  userId: 1,
  name: 'Esau',
  lastname: 'Morales',
  email: 'info@hycon.lat',
  phone: null,
  avatarUrl: null,
  roleId: 1,
  rol: 'ADMIN',
};

const sesion = (recordar: boolean) => ({
  token: 'token-de-acceso',
  expiraEn: 900,
  usuario,
  sesion: { token: 'token-largo-secreto', expiraEl: new Date('2026-10-17T15:00:00.000Z'), recordar },
});

const cookieDe = (respuesta: request.Response) =>
  ([] as string[]).concat(respuesta.headers['set-cookie'] ?? []).find((c) => c.startsWith('hycon_sesion=')) ?? '';

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.mocked(authService.iniciarSesion).mockResolvedValue(sesion(false));
  });

  it('devuelve el token de acceso y el usuario, pero nunca el token de sesion en el cuerpo', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'info@hycon.lat', password: '123456' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ token: 'token-de-acceso', expiraEn: 900, usuario });
    expect(JSON.stringify(respuesta.body)).not.toContain('token-largo-secreto');
    expect(respuesta.headers['cache-control']).toBe('no-store');
  });

  it('guarda la sesion en una cookie httpOnly, SameSite y limitada a /api/v1/auth', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'info@hycon.lat', password: '123456' });

    const cookie = cookieDe(respuesta);
    expect(cookie).toContain('hycon_sesion=token-largo-secreto');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    // Sin "Recordarme" es cookie de sesion del navegador
    expect(cookie).not.toMatch(/Expires=/i);
  });

  it('con Recordarme la cookie lleva fecha de caducidad', async () => {
    vi.mocked(authService.iniciarSesion).mockResolvedValue(sesion(true));

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'info@hycon.lat', password: '123456', recordar: true });

    expect(cookieDe(respuesta)).toMatch(/Expires=Sat, 17 Oct 2026/);
    expect(authService.iniciarSesion).toHaveBeenCalledWith(
      expect.objectContaining({ recordar: true }),
      expect.objectContaining({ ip: expect.any(String) })
    );
  });

  it('un bloqueo responde 429 con Retry-After y los segundos de espera', async () => {
    vi.mocked(authService.iniciarSesion).mockRejectedValue(
      new ErrorDemasiadosIntentos('Demasiados intentos fallidos', 840)
    );

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'info@hycon.lat', password: 'mala' });

    expect(respuesta.status).toBe(429);
    expect(respuesta.headers['retry-after']).toBe('840');
    expect(respuesta.body.reintentarEnSegundos).toBe(840);
    expect(cookieDe(respuesta)).toBe('');
  });

  it('valida el cuerpo antes de llegar al servicio', async () => {
    const respuesta = await request(app).post('/api/v1/auth/login').send({ email: 'no-es-correo' });

    expect(respuesta.status).toBe(422);
    expect(authService.iniciarSesion).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/register', () => {
  it('rechaza una contrasena debil con 422 sin llamar al servicio', async () => {
    const respuesta = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana',
      lastname: 'Quispe',
      email: 'ana@hycon.com',
      password: 'Cliente2026',
    });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error).toMatch(/^password:/);
    expect(authService.registrar).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('lee la cookie, rota la sesion y devuelve un token nuevo', async () => {
    vi.mocked(authService.renovarSesion).mockResolvedValue(sesion(true));

    const respuesta = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'hycon_sesion=token-anterior');

    expect(respuesta.status).toBe(200);
    expect(authService.renovarSesion).toHaveBeenCalledWith('token-anterior', expect.any(Object));
    expect(cookieDe(respuesta)).toContain('hycon_sesion=token-largo-secreto');
    expect(respuesta.body.data.usuario).toEqual(usuario);
  });

  it('si no se puede renovar borra la cookie y responde 401', async () => {
    vi.mocked(authService.renovarSesion).mockRejectedValue(new AppError('Tu sesion termino', 401));

    const respuesta = await request(app).post('/api/v1/auth/refresh').set('Cookie', 'hycon_sesion=caducada');

    expect(respuesta.status).toBe(401);
    expect(cookieDe(respuesta)).toMatch(/hycon_sesion=;/);
  });

  it('rechaza peticiones desde otra web (CSRF)', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://web-maliciosa.com')
      .set('Cookie', 'hycon_sesion=token-anterior');

    expect(respuesta.status).toBe(403);
    expect(authService.renovarSesion).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revoca la sesion, borra la cookie y responde 204', async () => {
    vi.mocked(authService.cerrarSesion).mockResolvedValue();

    const respuesta = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'hycon_sesion=token-actual');

    expect(respuesta.status).toBe(204);
    expect(authService.cerrarSesion).toHaveBeenCalledWith('token-actual', expect.any(Object));
    expect(cookieDe(respuesta)).toMatch(/hycon_sesion=;/);
  });
});

describe('cabeceras de seguridad', () => {
  it('no anuncia Express y aplica las cabeceras de helmet', async () => {
    const respuesta = await request(app).get('/health');

    expect(respuesta.headers['x-powered-by']).toBeUndefined();
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['strict-transport-security']).toBeDefined();
  });

  it('un error inesperado no filtra detalles internos fuera de desarrollo', async () => {
    vi.mocked(authService.iniciarSesion).mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {});

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'info@hycon.lat', password: '123456' });

    expect(respuesta.status).toBe(500);
    // Las pruebas corren con NODE_ENV=test: se comporta como produccion
    expect(respuesta.body.error).not.toContain('10.0.0.5');
    expect(respuesta.body.stack).toBeUndefined();
    silenciar.mockRestore();
  });
});
