import type { Request, Response } from 'express';
import { AppError } from '../../core/errors/AppError';
import { manejar } from '../../core/utils/controlador';
import { authService } from './auth.service';
import { borrarCookieSesion, escribirCookieSesion, NOMBRE_COOKIE_SESION } from './auth.cookies';
import type { LoginInput, RegistroInput } from './auth.schema';
import type { ContextoPeticion, SesionIniciada } from './auth.types';

const contextoDe = (req: Request): ContextoPeticion => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? undefined,
});

const leerCookieSesion = (req: Request): string | undefined => {
  const valor = (req.cookies as Record<string, unknown> | undefined)?.[NOMBRE_COOKIE_SESION];
  return typeof valor === 'string' ? valor : undefined;
};

// El token largo va en la cookie; el cuerpo solo lleva el token de acceso y el usuario
const responderSesion = (res: Response, estado: number, { sesion, ...resto }: SesionIniciada) => {
  escribirCookieSesion(res, sesion);
  // Ninguna respuesta con credenciales debe quedar guardada en caches intermedias
  res.setHeader('Cache-Control', 'no-store');
  res.status(estado).json({ success: true, data: resto });
};

export const registrar = manejar(async (req, res) => {
  responderSesion(res, 201, await authService.registrar(req.body as RegistroInput, contextoDe(req)));
});

export const iniciarSesion = manejar(async (req, res) => {
  responderSesion(res, 200, await authService.iniciarSesion(req.body as LoginInput, contextoDe(req)));
});

export const renovarSesion = manejar(async (req, res) => {
  try {
    responderSesion(res, 200, await authService.renovarSesion(leerCookieSesion(req), contextoDe(req)));
  } catch (error) {
    // Una sesion que no se pudo renovar no debe seguir en el navegador
    borrarCookieSesion(res);
    throw error;
  }
});

export const cerrarSesion = manejar(async (req, res) => {
  await authService.cerrarSesion(leerCookieSesion(req), contextoDe(req));
  borrarCookieSesion(res);
  res.status(204).end();
});

export const perfil = manejar(async (req, res) => {
  if (!req.usuario) {
    throw new AppError('No autenticado. Inicia sesion para continuar', 401);
  }
  const usuario = await authService.obtenerPerfil(req.usuario.userId);
  res.status(200).json({ success: true, data: { usuario } });
});
