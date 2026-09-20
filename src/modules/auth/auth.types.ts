// Forma publica del usuario: nunca incluye el hash de la contrasena
export interface UsuarioPublico {
  userId: number;
  name: string;
  lastname: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  rol: string;
  roleId: number;
}

// Registro tal como llega desde la base (subconjunto de Prisma.User con su rol)
export interface UsuarioConRol {
  userId: number;
  name: string;
  lastname: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  role: { roleId: number; name: string };
}

// Quien hace la peticion: se guarda en la sesion y en el registro de eventos
export interface ContextoPeticion {
  ip?: string;
  userAgent?: string;
}

export interface SesionGuardada {
  sessionId: string;
  userId: number;
  familyId: string;
  remember: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
}

// Lo que devuelve el servicio al controlador. El token de sesion va aparte
// porque viaja en una cookie httpOnly, nunca en el cuerpo de la respuesta.
export interface SesionIniciada {
  token: string;
  // Segundos de vida del token de acceso
  expiraEn: number;
  usuario: UsuarioPublico;
  sesion: {
    token: string;
    expiraEl: Date;
    recordar: boolean;
  };
}

export type TipoEventoAcceso =
  | 'LOGIN_OK'
  | 'LOGIN_FALLIDO'
  | 'LOGIN_BLOQUEADO'
  | 'CUENTA_BLOQUEADA'
  | 'REGISTRO'
  | 'REFRESH'
  | 'REUSO_TOKEN'
  | 'LOGOUT';

export interface EventoAcceso extends ContextoPeticion {
  type: TipoEventoAcceso;
  userId?: number;
  email?: string;
}
