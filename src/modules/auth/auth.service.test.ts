import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  crearServicioAuth,
  GRACIA_ROTACION_MS,
  hashToken,
  type DependenciasAuth,
  type PoliticaAcceso,
} from './auth.service';
import { crearRegistroIntentos } from './auth.intentos';
import type { SesionGuardada, UsuarioConRol } from './auth.types';

const MINUTO = 60_000;
const AHORA = new Date('2026-09-17T15:00:00.000Z');

const politica: PoliticaAcceso = {
  maxIntentos: 3,
  bloqueoMs: 15 * MINUTO,
  accesoMs: 15 * MINUTO,
  sesionMs: 12 * 60 * MINUTO,
  sesionRecordarMs: 30 * 24 * 60 * MINUTO,
};

const admin: UsuarioConRol = {
  userId: 1,
  name: 'Esau',
  lastname: 'Morales',
  email: 'info@hycon.lat',
  passwordHash: 'hash-real',
  phone: null,
  avatarUrl: null,
  roleId: 1,
  failedLoginAttempts: 0,
  lockedUntil: null,
  role: { roleId: 1, name: 'ADMIN' },
};

const sesionGuardada = (cambios: Partial<SesionGuardada> = {}): SesionGuardada => ({
  sessionId: 'sesion-1',
  userId: 1,
  familyId: 'familia-1',
  remember: true,
  expiresAt: new Date(AHORA.getTime() + 10 * 24 * 60 * MINUTO),
  revokedAt: null,
  ...cambios,
});

let deps: DependenciasAuth;
let contadorTokens: number;

const credenciales = { email: 'info@hycon.lat', password: 'correcta', recordar: false };
const contexto = { ip: '10.0.0.1', userAgent: 'Pruebas' };

beforeEach(() => {
  contadorTokens = 0;
  deps = {
    buscarUsuarioPorEmail: vi.fn().mockResolvedValue(admin),
    buscarUsuarioPorId: vi.fn().mockResolvedValue(admin),
    buscarRolPorNombre: vi.fn().mockResolvedValue({ roleId: 2 }),
    crearUsuario: vi.fn().mockResolvedValue({ ...admin, userId: 9, role: { roleId: 2, name: 'CLIENTE' } }),
    registrarFallo: vi.fn().mockResolvedValue(undefined),
    registrarAccesoCorrecto: vi.fn().mockResolvedValue(undefined),
    crearSesion: vi.fn().mockResolvedValue(undefined),
    buscarSesionPorHash: vi.fn().mockResolvedValue(sesionGuardada()),
    revocarSesion: vi.fn().mockResolvedValue(undefined),
    revocarFamilia: vi.fn().mockResolvedValue(undefined),
    registrarEvento: vi.fn().mockResolvedValue(undefined),
    hashear: vi.fn().mockResolvedValue('hash-nuevo'),
    comparar: vi.fn(async (texto: string) => texto === 'correcta'),
    necesitaRehash: vi.fn().mockReturnValue(false),
    firmar: vi.fn().mockReturnValue('token-de-acceso'),
    generarTokenSesion: vi.fn(() => `token-sesion-${++contadorTokens}`),
    ahora: vi.fn(() => AHORA),
    intentosDesconocidos: crearRegistroIntentos({ maxIntentos: politica.maxIntentos, bloqueoMs: politica.bloqueoMs }),
  };
});

const servicio = () => crearServicioAuth(deps, politica);
const tiposDeEvento = () => vi.mocked(deps.registrarEvento).mock.calls.map(([evento]) => evento.type);

describe('iniciarSesion', () => {
  it('devuelve un token de acceso corto y una sesion aparte para la cookie', async () => {
    const sesion = await servicio().iniciarSesion(credenciales, contexto);

    expect(sesion.token).toBe('token-de-acceso');
    expect(sesion.expiraEn).toBe(15 * 60);
    expect(sesion.usuario).not.toHaveProperty('passwordHash');
    expect(sesion.sesion).toEqual({
      token: 'token-sesion-1',
      recordar: false,
      expiraEl: new Date(AHORA.getTime() + politica.sesionMs),
    });
  });

  it('guarda solo el hash del token de sesion, con IP y navegador', async () => {
    await servicio().iniciarSesion(credenciales, contexto);

    const guardada = vi.mocked(deps.crearSesion).mock.calls[0][0];
    expect(guardada.tokenHash).toBe(hashToken('token-sesion-1'));
    expect(JSON.stringify(guardada)).not.toContain('"token-sesion-1"');
    expect(guardada).toMatchObject({ userId: 1, remember: false, ip: '10.0.0.1', userAgent: 'Pruebas' });
  });

  it('con Recordarme la sesion dura 30 dias', async () => {
    const sesion = await servicio().iniciarSesion({ ...credenciales, recordar: true }, contexto);
    expect(sesion.sesion.expiraEl).toEqual(new Date(AHORA.getTime() + politica.sesionRecordarMs));
  });

  it('registra el acceso correcto y limpia el contador', async () => {
    await servicio().iniciarSesion(credenciales, contexto);

    expect(deps.registrarAccesoCorrecto).toHaveBeenCalledWith(1, AHORA, undefined);
    expect(tiposDeEvento()).toEqual(['LOGIN_OK']);
  });

  it('refuerza un hash antiguo al acertar la contrasena', async () => {
    vi.mocked(deps.necesitaRehash).mockReturnValue(true);

    await servicio().iniciarSesion(credenciales, contexto);

    expect(deps.hashear).toHaveBeenCalledWith('correcta');
    expect(deps.registrarAccesoCorrecto).toHaveBeenCalledWith(1, AHORA, 'hash-nuevo');
  });

  it('mismo mensaje para correo inexistente y contrasena incorrecta', async () => {
    const incorrecta = servicio().iniciarSesion({ ...credenciales, password: 'mala' }, contexto);
    await expect(incorrecta).rejects.toMatchObject({ statusCode: 401, message: 'Correo o contrasena incorrectos' });

    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue(null);
    const inexistente = servicio().iniciarSesion({ ...credenciales, email: 'nadie@x.com' }, contexto);
    await expect(inexistente).rejects.toMatchObject({ statusCode: 401, message: 'Correo o contrasena incorrectos' });
  });

  it('con un correo inexistente tambien ejecuta bcrypt, para no delatarse por el tiempo', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue(null);

    await expect(servicio().iniciarSesion(credenciales, contexto)).rejects.toThrow();

    expect(deps.comparar).toHaveBeenCalledTimes(1);
  });

  it('cuenta cada fallo en la cuenta y deja registro', async () => {
    await expect(servicio().iniciarSesion({ ...credenciales, password: 'mala' }, contexto)).rejects.toThrow();

    expect(deps.registrarFallo).toHaveBeenCalledWith(1, 1, null);
    expect(tiposDeEvento()).toEqual(['LOGIN_FALLIDO']);
    expect(deps.crearSesion).not.toHaveBeenCalled();
  });

  it('al llegar al maximo bloquea la cuenta 15 minutos con 429', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue({ ...admin, failedLoginAttempts: 2 });

    const intento = servicio().iniciarSesion({ ...credenciales, password: 'mala' }, contexto);

    await expect(intento).rejects.toMatchObject({ statusCode: 429, reintentarEnSegundos: 900 });
    expect(deps.registrarFallo).toHaveBeenCalledWith(1, 0, new Date(AHORA.getTime() + 15 * MINUTO));
    expect(tiposDeEvento()).toEqual(['LOGIN_FALLIDO', 'CUENTA_BLOQUEADA']);
  });

  it('una cuenta bloqueada no entra ni con la contrasena correcta', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue({
      ...admin,
      lockedUntil: new Date(AHORA.getTime() + 5 * MINUTO),
    });

    const intento = servicio().iniciarSesion(credenciales, contexto);

    await expect(intento).rejects.toMatchObject({ statusCode: 429, message: expect.stringContaining('5 min') });
    expect(deps.comparar).not.toHaveBeenCalled();
    expect(tiposDeEvento()).toEqual(['LOGIN_BLOQUEADO']);
  });

  it('cumplido el bloqueo, un nuevo fallo empieza a contar desde uno', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue({
      ...admin,
      failedLoginAttempts: 0,
      lockedUntil: new Date(AHORA.getTime() - MINUTO),
    });

    await expect(servicio().iniciarSesion({ ...credenciales, password: 'mala' }, contexto)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(deps.registrarFallo).toHaveBeenCalledWith(1, 1, null);
  });

  it('un correo inexistente se bloquea igual que uno real, sin delatar cual existe', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue(null);
    const auth = servicio();
    const intento = () => auth.iniciarSesion({ ...credenciales, email: 'fantasma@x.com' }, contexto);

    await expect(intento()).rejects.toMatchObject({ statusCode: 401 });
    await expect(intento()).rejects.toMatchObject({ statusCode: 401 });
    await expect(intento()).rejects.toMatchObject({ statusCode: 429 });
    await expect(intento()).rejects.toMatchObject({ statusCode: 429 });
  });

  it('si el registro de eventos falla, el acceso sigue funcionando', async () => {
    vi.mocked(deps.registrarEvento).mockRejectedValue(new Error('base caida'));
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(servicio().iniciarSesion(credenciales, contexto)).resolves.toHaveProperty('token');
    silenciar.mockRestore();
  });
});

describe('registrar', () => {
  const datos = {
    name: 'Ana',
    lastname: 'Quispe',
    email: 'ana@hycon.com',
    password: 'cafe con leche y pan',
    recordar: false,
  };

  beforeEach(() => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue(null);
  });

  it('crea la cuenta con la contrasena hasheada, rol CLIENTE y abre sesion', async () => {
    const sesion = await servicio().registrar(datos, contexto);

    expect(deps.hashear).toHaveBeenCalledWith('cafe con leche y pan');
    expect(deps.crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hash-nuevo', roleId: 2 })
    );
    expect(sesion.sesion.token).toBe('token-sesion-1');
    expect(tiposDeEvento()).toEqual(['REGISTRO']);
  });

  it('rechaza un correo ya registrado con 409', async () => {
    vi.mocked(deps.buscarUsuarioPorEmail).mockResolvedValue(admin);
    await expect(servicio().registrar(datos, contexto)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('renovarSesion', () => {
  it('rota el token: revoca el usado y emite otro en la misma familia', async () => {
    const renovada = await servicio().renovarSesion('token-viejo', contexto);

    expect(deps.buscarSesionPorHash).toHaveBeenCalledWith(hashToken('token-viejo'));
    expect(deps.revocarSesion).toHaveBeenCalledWith('sesion-1', AHORA);
    expect(deps.crearSesion).toHaveBeenCalledWith(expect.objectContaining({ familyId: 'familia-1', remember: true }));
    expect(renovada.sesion.token).toBe('token-sesion-1');
    expect(renovada.token).toBe('token-de-acceso');
  });

  it('rotar no alarga la vida maxima de la sesion', async () => {
    const renovada = await servicio().renovarSesion('token-viejo', contexto);
    expect(renovada.sesion.expiraEl).toEqual(sesionGuardada().expiresAt);
  });

  it('sin token o con uno desconocido responde 401', async () => {
    await expect(servicio().renovarSesion(undefined, contexto)).rejects.toMatchObject({ statusCode: 401 });

    vi.mocked(deps.buscarSesionPorHash).mockResolvedValue(null);
    await expect(servicio().renovarSesion('inventado', contexto)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('una sesion caducada no se renueva', async () => {
    vi.mocked(deps.buscarSesionPorHash).mockResolvedValue(sesionGuardada({ expiresAt: new Date(AHORA.getTime() - 1) }));

    await expect(servicio().renovarSesion('token-viejo', contexto)).rejects.toMatchObject({ statusCode: 401 });
    expect(deps.crearSesion).not.toHaveBeenCalled();
  });

  it('reutilizar un token ya rotado revoca toda la familia (posible robo)', async () => {
    vi.mocked(deps.buscarSesionPorHash).mockResolvedValue(
      sesionGuardada({ revokedAt: new Date(AHORA.getTime() - 5 * MINUTO) })
    );

    await expect(servicio().renovarSesion('token-robado', contexto)).rejects.toMatchObject({ statusCode: 401 });
    expect(deps.revocarFamilia).toHaveBeenCalledWith('familia-1', AHORA);
    expect(tiposDeEvento()).toEqual(['REUSO_TOKEN']);
    expect(deps.crearSesion).not.toHaveBeenCalled();
  });

  it('dos pestanas renovando a la vez no se tratan como robo', async () => {
    vi.mocked(deps.buscarSesionPorHash).mockResolvedValue(
      sesionGuardada({ revokedAt: new Date(AHORA.getTime() - GRACIA_ROTACION_MS / 2) })
    );

    await expect(servicio().renovarSesion('token-recien-rotado', contexto)).resolves.toHaveProperty('token');
    expect(deps.revocarFamilia).not.toHaveBeenCalled();
  });

  it('si el usuario fue eliminado no se renueva', async () => {
    vi.mocked(deps.buscarUsuarioPorId).mockResolvedValue(null);
    await expect(servicio().renovarSesion('token-viejo', contexto)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('cerrarSesion', () => {
  it('revoca la familia de la sesion y deja registro', async () => {
    await servicio().cerrarSesion('token-actual', contexto);

    expect(deps.revocarFamilia).toHaveBeenCalledWith('familia-1', AHORA);
    expect(tiposDeEvento()).toEqual(['LOGOUT']);
  });

  it('sin token o con uno desconocido no hace nada ni falla', async () => {
    await expect(servicio().cerrarSesion(undefined, contexto)).resolves.toBeUndefined();

    vi.mocked(deps.buscarSesionPorHash).mockResolvedValue(null);
    await expect(servicio().cerrarSesion('inventado', contexto)).resolves.toBeUndefined();
    expect(deps.revocarFamilia).not.toHaveBeenCalled();
  });
});
