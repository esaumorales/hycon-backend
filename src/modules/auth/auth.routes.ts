import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../core/config/env';
import { AppError } from '../../core/errors/AppError';
import { protect } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { recibirImagen } from '../uploads/uploads.middleware';
import {
  actualizarAvatar,
  fijarAvatar,
  actualizarPerfil,
  cambiarPassword,
  cerrarSesion,
  iniciarSesion,
  perfil,
  quitarAvatar,
  registrar,
  renovarSesion,
} from './auth.controller';
import {
  avatarSchema,
  cambioPasswordSchema,
  loginSchema,
  perfilSchema,
  registroSchema,
} from './auth.schema';

// Freno por IP: complementa el bloqueo por cuenta frente a ataques que prueban
// muchas cuentas distintas desde el mismo origen
const limitePorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_LIMITE_POR_IP,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes desde tu conexion. Espera unos minutos e intentalo de nuevo',
    });
  },
});

/**
 * Las rutas que usan la cookie de sesion solo aceptan peticiones desde los origenes
 * permitidos. Asi otra web no puede hacer que el navegador de la victima renueve o
 * cierre su sesion (CSRF). Las peticiones sin Origin (curl, apps) no llevan la cookie
 * de un navegador ajeno, por eso se dejan pasar.
 */
export const soloOrigenesPermitidos = (req: Request, _res: Response, next: NextFunction) => {
  const origen = req.get('origin');
  if (origen && !env.CORS_ORIGINS.includes(origen)) {
    return next(new AppError('Origen no permitido', 403));
  }
  next();
};

const router = Router();

router.post('/register', limitePorIp, validate(registroSchema), registrar);
router.post('/login', limitePorIp, validate(loginSchema), iniciarSesion);
router.post('/refresh', limitePorIp, soloOrigenesPermitidos, renovarSesion);
router.post('/logout', soloOrigenesPermitidos, cerrarSesion);
router.get('/me', protect, perfil);
router.put('/me', protect, validate(perfilSchema), actualizarPerfil);
// Cambiar la contrasena cierra las demas sesiones, por eso usa la cookie: mismo freno CSRF
router.put('/me/password', protect, soloOrigenesPermitidos, limitePorIp, validate(cambioPasswordSchema), cambiarPassword);
// Con Cloudinary la foto ya esta subida y solo llega su direccion
router.put('/me/avatar', protect, validate(avatarSchema), fijarAvatar);
// Sin Cloudinary, el archivo llega aqui y se guarda en disco
router.post('/me/avatar', protect, recibirImagen, actualizarAvatar);
router.delete('/me/avatar', protect, quitarAvatar);

export { router as authRoutes };
