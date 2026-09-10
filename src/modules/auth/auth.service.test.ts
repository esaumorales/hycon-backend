import { describe, expect, it, vi, beforeEach } from 'vitest';
import { crearServicioAuth, type DependenciasAuth } from './auth.service';
import { AppError } from '../../core/errors/AppError';
import type { UsuarioConRol } from './auth.types';

const usuarioAdmin: UsuarioConRol = {
  userId: 1,
  name: 'Esau',
  lastname: 'Morales',
  email: 'admin@hycon.com',
  passwordHash: 'hash-guardado',
  phone: null,
  avatarUrl: null,
  roleId: 1,
  role: { roleId: 1, name: 'ADMIN' },
};

// Dobles de prueba: ninguna prueba toca Postgres ni bcrypt real
const crearDeps = (sobrescribir: Partial<DependenciasAuth> = {}): DependenciasAuth => ({
  buscarUsuarioPorEmail: vi.fn().mockResolvedValue(null),
  buscarUsuarioPorId: vi.fn().mockResolvedValue(usuarioAdmin),
  buscarRolPorNombre: vi.fn().mockResolvedValue({ roleId: 2 }),
  crearUsuario: vi.fn().mockResolvedValue({
    ...usuarioAdmin,
    userId: 9,
    email: 'ana@hycon.com',
    roleId: 2,
    role: { roleId: 2, name: 'CLIENTE' },
  }),
  hashear: vi.fn().mockResolvedValue('hash-nuevo'),
  comparar: vi.fn().mockResolvedValue(true),
  firmar: vi.fn().mockReturnValue('token-firmado'),
  ...sobrescribir,
});

describe('authService.iniciarSesion', () => {
  let deps: DependenciasAuth;

  beforeEach(() => {
    deps = crearDeps({ buscarUsuarioPorEmail: vi.fn().mockResolvedValue(usuarioAdmin) });
  });

  it('devuelve token y usuario cuando las credenciales son correctas', async () => {
    const servicio = crearServicioAuth(deps);

    const sesion = await servicio.iniciarSesion({
      email: 'admin@hycon.com',
      password: 'Hycon2026',
    });

    expect(sesion.token).toBe('token-firmado');
    expect(sesion.usuario.rol).toBe('ADMIN');
    expect(deps.comparar).toHaveBeenCalledWith('Hycon2026', 'hash-guardado');
  });

  it('nunca expone el hash de la contrasena', async () => {
    const servicio = crearServicioAuth(deps);

    const sesion = await servicio.iniciarSesion({
      email: 'admin@hycon.com',
      password: 'Hycon2026',
    });

    expect(JSON.stringify(sesion)).not.toContain('hash-guardado');
    expect(sesion.usuario).not.toHaveProperty('passwordHash');
  });

  it('firma el token con el rol real del usuario', async () => {
    const servicio = crearServicioAuth(deps);

    await servicio.iniciarSesion({ email: 'admin@hycon.com', password: 'Hycon2026' });

    expect(deps.firmar).toHaveBeenCalledWith({
      userId: 1,
      email: 'admin@hycon.com',
      rol: 'ADMIN',
    });
  });

  it('rechaza con 401 cuando la contrasena no coincide', async () => {
    const servicio = crearServicioAuth(
      crearDeps({
        buscarUsuarioPorEmail: vi.fn().mockResolvedValue(usuarioAdmin),
        comparar: vi.fn().mockResolvedValue(false),
      })
    );

    await expect(
      servicio.iniciarSesion({ email: 'admin@hycon.com', password: 'incorrecta' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('usa el mismo mensaje para correo inexistente que para contrasena mala', async () => {
    const sinUsuario = crearServicioAuth(
      crearDeps({ buscarUsuarioPorEmail: vi.fn().mockResolvedValue(null) })
    );
    const conPasswordMala = crearServicioAuth(
      crearDeps({
        buscarUsuarioPorEmail: vi.fn().mockResolvedValue(usuarioAdmin),
        comparar: vi.fn().mockResolvedValue(false),
      })
    );

    const errorA = await sinUsuario
      .iniciarSesion({ email: 'nadie@hycon.com', password: 'Hycon2026' })
      .catch((e: AppError) => e.message);
    const errorB = await conPasswordMala
      .iniciarSesion({ email: 'admin@hycon.com', password: 'mala' })
      .catch((e: AppError) => e.message);

    expect(errorA).toBe(errorB);
  });
});

describe('authService.registrar', () => {
  it('hashea la contrasena antes de guardarla', async () => {
    const deps = crearDeps();
    const servicio = crearServicioAuth(deps);

    await servicio.registrar({
      name: 'Ana',
      lastname: 'Quispe',
      email: 'ana@hycon.com',
      password: 'Cliente2026',
    });

    expect(deps.hashear).toHaveBeenCalledWith('Cliente2026');
    expect(deps.crearUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hash-nuevo', roleId: 2 })
    );
    const argumentos = (deps.crearUsuario as any).mock.calls[0][0];
    expect(argumentos).not.toHaveProperty('password');
  });

  it('rechaza con 409 si el correo ya esta registrado', async () => {
    const servicio = crearServicioAuth(
      crearDeps({ buscarUsuarioPorEmail: vi.fn().mockResolvedValue(usuarioAdmin) })
    );

    await expect(
      servicio.registrar({
        name: 'Ana',
        lastname: 'Quispe',
        email: 'admin@hycon.com',
        password: 'Cliente2026',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('falla con mensaje claro si falta el rol CLIENTE en la base', async () => {
    const servicio = crearServicioAuth(
      crearDeps({ buscarRolPorNombre: vi.fn().mockResolvedValue(null) })
    );

    await expect(
      servicio.registrar({
        name: 'Ana',
        lastname: 'Quispe',
        email: 'ana@hycon.com',
        password: 'Cliente2026',
      })
    ).rejects.toThrow(/seed/i);
  });
});

describe('authService.obtenerPerfil', () => {
  it('devuelve el usuario publico del id indicado', async () => {
    const servicio = crearServicioAuth(crearDeps());

    const usuario = await servicio.obtenerPerfil(1);

    expect(usuario.email).toBe('admin@hycon.com');
    expect(usuario).not.toHaveProperty('passwordHash');
  });

  it('lanza 404 si el usuario fue eliminado', async () => {
    const servicio = crearServicioAuth(
      crearDeps({ buscarUsuarioPorId: vi.fn().mockResolvedValue(null) })
    );

    await expect(servicio.obtenerPerfil(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
