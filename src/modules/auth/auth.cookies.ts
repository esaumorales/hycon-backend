import type { CookieOptions, Response } from 'express';
import { env } from '../../core/config/env';

export const NOMBRE_COOKIE_SESION = 'hycon_sesion';

// La cookie solo se envia a las rutas de autenticacion: el resto de la API
// se autoriza con el token de acceso, asi la sesion larga casi nunca viaja
const RUTA_COOKIE = '/api/v1/auth';

const opcionesBase = (): CookieOptions => ({
  // Inaccesible desde JavaScript: un script inyectado no puede robarla
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: RUTA_COOKIE,
});

export const escribirCookieSesion = (
  res: Response,
  sesion: { token: string; expiraEl: Date; recordar: boolean }
) => {
  res.cookie(NOMBRE_COOKIE_SESION, sesion.token, {
    ...opcionesBase(),
    // Sin "Recordarme" es una cookie de sesion del navegador: desaparece al cerrarlo.
    // El servidor igualmente la deja de aceptar cuando caduca en la base.
    ...(sesion.recordar ? { expires: sesion.expiraEl } : {}),
  });
};

export const borrarCookieSesion = (res: Response) => {
  res.clearCookie(NOMBRE_COOKIE_SESION, opcionesBase());
};
