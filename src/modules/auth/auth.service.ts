import bcrypt from 'bcryptjs';
import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import { firmarToken } from '../../core/utils/jwt';
import { aUsuarioPublico } from './auth.mapper';
import type { LoginInput, RegistroInput } from './auth.schema';
import type { SesionIniciada, UsuarioConRol, UsuarioPublico } from './auth.types';

// Rol asignado a quien se registra desde la web publica
export const ROL_POR_DEFECTO = 'CLIENTE';

const RONDAS_BCRYPT = 10;

// Dependencias inyectables: en produccion son Prisma y bcrypt reales,
// en las pruebas se sustituyen por dobles sin tocar la base de datos
export interface DependenciasAuth {
  buscarUsuarioPorEmail(email: string): Promise<UsuarioConRol | null>;
  buscarUsuarioPorId(userId: number): Promise<UsuarioConRol | null>;
  buscarRolPorNombre(nombre: string): Promise<{ roleId: number } | null>;
  crearUsuario(datos: {
    name: string;
    lastname: string;
    email: string;
    passwordHash: string;
    phone?: string;
    roleId: number;
  }): Promise<UsuarioConRol>;
  hashear(texto: string): Promise<string>;
  comparar(texto: string, hash: string): Promise<boolean>;
  firmar(payload: { userId: number; email: string; rol: string }): string;
}

const seleccionConRol = {
  userId: true,
  name: true,
  lastname: true,
  email: true,
  passwordHash: true,
  phone: true,
  avatarUrl: true,
  roleId: true,
  role: { select: { roleId: true, name: true } },
} as const;

export const dependenciasReales: DependenciasAuth = {
  buscarUsuarioPorEmail: (email) =>
    prisma.user.findUnique({ where: { email }, select: seleccionConRol }),
  buscarUsuarioPorId: (userId) =>
    prisma.user.findUnique({ where: { userId }, select: seleccionConRol }),
  buscarRolPorNombre: async (nombre) => {
    const roles = await prisma.role.findMany({ where: { name: nombre }, take: 1 });
    return roles[0] ? { roleId: roles[0].roleId } : null;
  },
  crearUsuario: (datos) => prisma.user.create({ data: datos, select: seleccionConRol }),
  hashear: (texto) => bcrypt.hash(texto, RONDAS_BCRYPT),
  comparar: (texto, hash) => bcrypt.compare(texto, hash),
  firmar: firmarToken,
};

export const crearServicioAuth = (deps: DependenciasAuth) => {
  const emitirSesion = (usuario: UsuarioConRol): SesionIniciada => {
    const publico = aUsuarioPublico(usuario);
    const token = deps.firmar({
      userId: publico.userId,
      email: publico.email,
      rol: publico.rol,
    });
    return { token, usuario: publico };
  };

  return {
    async registrar(datos: RegistroInput): Promise<SesionIniciada> {
      const existente = await deps.buscarUsuarioPorEmail(datos.email);
      if (existente) {
        throw new AppError('Ya existe una cuenta con este correo', 409);
      }

      const rol = await deps.buscarRolPorNombre(ROL_POR_DEFECTO);
      if (!rol) {
        throw new AppError(
          `El rol ${ROL_POR_DEFECTO} no existe. Ejecuta el seed de la base de datos`,
          500
        );
      }

      const passwordHash = await deps.hashear(datos.password);

      const usuario = await deps.crearUsuario({
        name: datos.name,
        lastname: datos.lastname,
        email: datos.email,
        passwordHash,
        phone: datos.phone,
        roleId: rol.roleId,
      });

      return emitirSesion(usuario);
    },

    async iniciarSesion(datos: LoginInput): Promise<SesionIniciada> {
      const usuario = await deps.buscarUsuarioPorEmail(datos.email);

      // Mismo mensaje para correo inexistente y contrasena incorrecta:
      // asi no se revela que correos estan registrados
      const credencialesInvalidas = new AppError('Correo o contrasena incorrectos', 401);

      if (!usuario) {
        // Se compara igual contra un hash ficticio para no filtrar por tiempo de respuesta
        await deps.comparar(datos.password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
        throw credencialesInvalidas;
      }

      const coincide = await deps.comparar(datos.password, usuario.passwordHash);
      if (!coincide) {
        throw credencialesInvalidas;
      }

      return emitirSesion(usuario);
    },

    async obtenerPerfil(userId: number): Promise<UsuarioPublico> {
      const usuario = await deps.buscarUsuarioPorId(userId);
      if (!usuario) {
        throw new AppError('El usuario ya no existe', 404);
      }
      return aUsuarioPublico(usuario);
    },
  };
};

export const authService = crearServicioAuth(dependenciasReales);
