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

export interface SesionIniciada {
  token: string;
  usuario: UsuarioPublico;
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
  role: { roleId: number; name: string };
}
