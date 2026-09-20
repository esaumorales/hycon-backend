import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { prisma } from '../../core/database/prisma';
import { env } from '../../core/config/env';
import { AppError, ErrorDemasiadosIntentos } from '../../core/errors/AppError';
import { firmarToken } from '../../core/utils/jwt';
import { crearRegistroIntentos, type RegistroIntentos } from './auth.intentos';
import { aUsuarioPublico } from './auth.mapper';
import type { LoginInput, RegistroInput } from './auth.schema';
import type {
  ContextoPeticion,
  EventoAcceso,
  SesionGuardada,
  SesionIniciada,
  UsuarioConRol,
  UsuarioPublico,
} from './auth.types';

// Rol asignado a quien se registra desde la web publica
export const ROL_POR_DEFECTO = 'CLIENTE';

// Coste de bcrypt: cada punto duplica el trabajo de quien intente romper los hashes
export const RONDAS_BCRYPT = 12;

// Hash ficticio con el mismo coste: comparar contra el cuando el correo no existe
// hace que la respuesta tarde lo mismo y no delate que cuentas hay registradas
const HASH_FICTICIO = bcrypt.hashSync('hash-ficticio-para-igualar-tiempos', RONDAS_BCRYPT);

// Si dos pestanas renuevan la sesion a la vez, la segunda llega con un token recien
// rotado. Dentro de este margen se trata como carrera normal y no como robo.
export const GRACIA_ROTACION_MS = 10_000;

export interface PoliticaAcceso {
  maxIntentos: number;
  bloqueoMs: number;
  accesoMs: number;
  sesionMs: number;
  sesionRecordarMs: number;
}

export const POLITICA_POR_DEFECTO: PoliticaAcceso = {
  maxIntentos: env.LOGIN_MAX_INTENTOS,
  bloqueoMs: env.LOGIN_BLOQUEO_MINUTOS * 60_000,
  accesoMs: env.ACCESS_TOKEN_MINUTOS * 60_000,
  sesionMs: env.SESION_HORAS * 3_600_000,
  sesionRecordarMs: env.SESION_RECORDAR_DIAS * 86_400_000,
};

// Dependencias inyectables: en produccion son Prisma, bcrypt y el reloj real;
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
  registrarFallo(userId: number, intentos: number, bloqueadoHasta: Date | null): Promise<void>;
  registrarAccesoCorrecto(userId: number, cuando: Date, nuevoHash?: string): Promise<void>;

  crearSesion(datos: {
    userId: number;
    tokenHash: string;
    familyId: string;
    remember: boolean;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<void>;
  buscarSesionPorHash(tokenHash: string): Promise<SesionGuardada | null>;
  revocarSesion(sessionId: string, cuando: Date): Promise<void>;
  revocarFamilia(familyId: string, cuando: Date): Promise<void>;

  registrarEvento(evento: EventoAcceso): Promise<void>;

  hashear(texto: string): Promise<string>;
  comparar(texto: string, hash: string): Promise<boolean>;
  necesitaRehash(hash: string): boolean;
  firmar(payload: { userId: number; email: string; rol: string }): string;
  generarTokenSesion(): string;
  ahora(): Date;
  intentosDesconocidos: RegistroIntentos;
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
  failedLoginAttempts: true,
  lockedUntil: true,
  role: { select: { roleId: true, name: true } },
} as const;

// En la base solo se guarda el hash del token de sesion
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Los campos de texto se recortan al tamano de la columna
const recortar = (texto: string | undefined, maximo: number) => texto?.slice(0, maximo);

export const dependenciasReales: DependenciasAuth = {
  buscarUsuarioPorEmail: (email) => prisma.user.findUnique({ where: { email }, select: seleccionConRol }),
  buscarUsuarioPorId: (userId) => prisma.user.findUnique({ where: { userId }, select: seleccionConRol }),
  buscarRolPorNombre: async (nombre) => {
    const roles = await prisma.role.findMany({ where: { name: nombre }, take: 1 });
    return roles[0] ? { roleId: roles[0].roleId } : null;
  },
  crearUsuario: (datos) => prisma.user.create({ data: datos, select: seleccionConRol }),
  registrarFallo: async (userId, intentos, bloqueadoHasta) => {
    await prisma.user.update({
      where: { userId },
      data: { failedLoginAttempts: intentos, lockedUntil: bloqueadoHasta },
    });
  },
  registrarAccesoCorrecto: async (userId, cuando, nuevoHash) => {
    await prisma.user.update({
      where: { userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: cuando,
        ...(nuevoHash ? { passwordHash: nuevoHash } : {}),
      },
    });
  },

  crearSesion: async ({ ip, userAgent, ...datos }) => {
    await prisma.session.create({
      data: { ...datos, ip: recortar(ip, 64), userAgent: recortar(userAgent, 300) },
    });
  },
  buscarSesionPorHash: (tokenHash) =>
    prisma.session.findUnique({
      where: { tokenHash },
      select: { sessionId: true, userId: true, familyId: true, remember: true, expiresAt: true, revokedAt: true },
    }),
  revocarSesion: async (sessionId, cuando) => {
    await prisma.session.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: cuando } });
  },
  revocarFamilia: async (familyId, cuando) => {
    await prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: cuando } });
  },

  registrarEvento: async ({ ip, userAgent, email, ...evento }) => {
    await prisma.authEvent.create({
      data: { ...evento, email: recortar(email, 150), ip: recortar(ip, 64), userAgent: recortar(userAgent, 300) },
    });
  },

  hashear: (texto) => bcrypt.hash(texto, RONDAS_BCRYPT),
  comparar: (texto, hash) => bcrypt.compare(texto, hash),
  // Los hashes creados con menos rondas se actualizan en el siguiente acceso correcto
  necesitaRehash: (hash) => {
    try {
      return bcrypt.getRounds(hash) < RONDAS_BCRYPT;
    } catch {
      return false;
    }
  },
  firmar: firmarToken,
  generarTokenSesion: () => randomBytes(32).toString('base64url'),
  ahora: () => new Date(),
  intentosDesconocidos: crearRegistroIntentos({
    maxIntentos: POLITICA_POR_DEFECTO.maxIntentos,
    bloqueoMs: POLITICA_POR_DEFECTO.bloqueoMs,
  }),
};

const minutosRestantes = (hasta: number, ahora: number) => Math.max(1, Math.ceil((hasta - ahora) / 60_000));

const errorBloqueo = (hasta: number, ahora: number) =>
  new ErrorDemasiadosIntentos(
    `Demasiados intentos fallidos. Por seguridad el acceso esta bloqueado. Intenta de nuevo en ${minutosRestantes(hasta, ahora)} min`,
    (hasta - ahora) / 1000
  );

const SESION_INVALIDA = () => new AppError('Tu sesion termino. Inicia sesion de nuevo', 401);

export const crearServicioAuth = (deps: DependenciasAuth, politica: PoliticaAcceso = POLITICA_POR_DEFECTO) => {
  // El registro de eventos nunca debe tumbar un inicio de sesion
  const registrar = async (evento: EventoAcceso) => {
    try {
      await deps.registrarEvento(evento);
    } catch (error) {
      console.error('No se pudo registrar el evento de acceso', evento.type, error);
    }
  };

  const abrirSesion = async (
    usuario: UsuarioConRol,
    opciones: { recordar: boolean; familyId?: string; expiraEl?: Date },
    contexto: ContextoPeticion
  ): Promise<SesionIniciada> => {
    const ahora = deps.ahora();
    const tokenSesion = deps.generarTokenSesion();
    const expiraEl =
      opciones.expiraEl ??
      new Date(ahora.getTime() + (opciones.recordar ? politica.sesionRecordarMs : politica.sesionMs));

    await deps.crearSesion({
      userId: usuario.userId,
      tokenHash: hashToken(tokenSesion),
      familyId: opciones.familyId ?? randomUUID(),
      remember: opciones.recordar,
      expiresAt: expiraEl,
      ...contexto,
    });

    const publico = aUsuarioPublico(usuario);
    return {
      token: deps.firmar({ userId: publico.userId, email: publico.email, rol: publico.rol }),
      expiraEn: Math.floor(politica.accesoMs / 1000),
      usuario: publico,
      sesion: { token: tokenSesion, expiraEl, recordar: opciones.recordar },
    };
  };

  return {
    async registrar(datos: RegistroInput, contexto: ContextoPeticion = {}): Promise<SesionIniciada> {
      const existente = await deps.buscarUsuarioPorEmail(datos.email);
      if (existente) {
        throw new AppError('Ya existe una cuenta con este correo', 409);
      }

      const rol = await deps.buscarRolPorNombre(ROL_POR_DEFECTO);
      if (!rol) {
        throw new AppError(`El rol ${ROL_POR_DEFECTO} no existe. Ejecuta el seed de la base de datos`, 500);
      }

      const usuario = await deps.crearUsuario({
        name: datos.name,
        lastname: datos.lastname,
        email: datos.email,
        passwordHash: await deps.hashear(datos.password),
        phone: datos.phone,
        roleId: rol.roleId,
      });

      await registrar({ type: 'REGISTRO', userId: usuario.userId, email: usuario.email, ...contexto });
      return abrirSesion(usuario, { recordar: datos.recordar }, contexto);
    },

    async iniciarSesion(datos: LoginInput, contexto: ContextoPeticion = {}): Promise<SesionIniciada> {
      const ahora = deps.ahora().getTime();
      const usuario = await deps.buscarUsuarioPorEmail(datos.email);

      // 1. Bloqueo vigente: mismo mensaje exista o no la cuenta
      const bloqueoVigente = usuario
        ? usuario.lockedUntil && usuario.lockedUntil.getTime() > ahora
          ? usuario.lockedUntil.getTime()
          : null
        : deps.intentosDesconocidos.bloqueadoHasta(datos.email, ahora);

      if (bloqueoVigente) {
        await registrar({ type: 'LOGIN_BLOQUEADO', userId: usuario?.userId, email: datos.email, ...contexto });
        throw errorBloqueo(bloqueoVigente, ahora);
      }

      // 2. Comprobacion de la contrasena, con el mismo coste haya cuenta o no
      const coincide = usuario
        ? await deps.comparar(datos.password, usuario.passwordHash)
        : (await deps.comparar(datos.password, HASH_FICTICIO), false);

      if (!usuario || !coincide) {
        let bloqueadoHasta: number | null;

        if (usuario) {
          // Si el bloqueo anterior ya se cumplio, la cuenta vuelve a empezar desde cero
          const previos = usuario.lockedUntil ? 0 : usuario.failedLoginAttempts;
          const intentos = previos + 1;
          bloqueadoHasta = intentos >= politica.maxIntentos ? ahora + politica.bloqueoMs : null;
          await deps.registrarFallo(usuario.userId, bloqueadoHasta ? 0 : intentos, bloqueadoHasta ? new Date(bloqueadoHasta) : null);
        } else {
          bloqueadoHasta = deps.intentosDesconocidos.registrarFallo(datos.email, ahora);
        }

        await registrar({ type: 'LOGIN_FALLIDO', userId: usuario?.userId, email: datos.email, ...contexto });

        if (bloqueadoHasta) {
          await registrar({ type: 'CUENTA_BLOQUEADA', userId: usuario?.userId, email: datos.email, ...contexto });
          throw errorBloqueo(bloqueadoHasta, ahora);
        }
        // Mismo mensaje para correo inexistente y contrasena incorrecta
        throw new AppError('Correo o contrasena incorrectos', 401);
      }

      // 3. Acceso correcto: se limpia el contador y, si el hash es antiguo, se refuerza
      const nuevoHash = deps.necesitaRehash(usuario.passwordHash)
        ? await deps.hashear(datos.password)
        : undefined;
      await deps.registrarAccesoCorrecto(usuario.userId, new Date(ahora), nuevoHash);
      deps.intentosDesconocidos.limpiar(datos.email);
      await registrar({ type: 'LOGIN_OK', userId: usuario.userId, email: usuario.email, ...contexto });

      return abrirSesion(usuario, { recordar: datos.recordar }, contexto);
    },

    /**
     * Cambia un token de sesion por uno nuevo (rotacion) y emite otro token de acceso.
     * Un token ya usado que vuelve a aparecer indica robo: se cierra toda la familia.
     */
    async renovarSesion(tokenSesion: string | undefined, contexto: ContextoPeticion = {}): Promise<SesionIniciada> {
      if (!tokenSesion) throw SESION_INVALIDA();

      const ahora = deps.ahora();
      const sesion = await deps.buscarSesionPorHash(hashToken(tokenSesion));
      if (!sesion) throw SESION_INVALIDA();

      if (sesion.revokedAt) {
        const recienRotada = ahora.getTime() - sesion.revokedAt.getTime() <= GRACIA_ROTACION_MS;
        if (!recienRotada) {
          await deps.revocarFamilia(sesion.familyId, ahora);
          await registrar({ type: 'REUSO_TOKEN', userId: sesion.userId, ...contexto });
          throw SESION_INVALIDA();
        }
      }

      if (sesion.expiresAt.getTime() <= ahora.getTime()) {
        await deps.revocarSesion(sesion.sessionId, ahora);
        throw SESION_INVALIDA();
      }

      const usuario = await deps.buscarUsuarioPorId(sesion.userId);
      if (!usuario) throw SESION_INVALIDA();

      await deps.revocarSesion(sesion.sessionId, ahora);
      await registrar({ type: 'REFRESH', userId: usuario.userId, ...contexto });

      // La sesion nueva conserva la caducidad original: rotar no alarga la vida maxima
      return abrirSesion(
        usuario,
        { recordar: sesion.remember, familyId: sesion.familyId, expiraEl: sesion.expiresAt },
        contexto
      );
    },

    async cerrarSesion(tokenSesion: string | undefined, contexto: ContextoPeticion = {}): Promise<void> {
      if (!tokenSesion) return;
      const sesion = await deps.buscarSesionPorHash(hashToken(tokenSesion));
      if (!sesion) return;
      // Se cierra la familia completa: los tokens rotados de esta sesion dejan de valer
      await deps.revocarFamilia(sesion.familyId, deps.ahora());
      await registrar({ type: 'LOGOUT', userId: sesion.userId, ...contexto });
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
