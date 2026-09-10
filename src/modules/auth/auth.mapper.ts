import type { UsuarioConRol, UsuarioPublico } from './auth.types';

// Convierte el registro de base a la forma que se expone por la API
export const aUsuarioPublico = (usuario: UsuarioConRol): UsuarioPublico => ({
  userId: usuario.userId,
  name: usuario.name,
  lastname: usuario.lastname,
  email: usuario.email,
  phone: usuario.phone,
  avatarUrl: usuario.avatarUrl,
  roleId: usuario.roleId,
  rol: usuario.role.name,
});
