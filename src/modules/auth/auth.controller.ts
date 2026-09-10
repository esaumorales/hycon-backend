import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../core/errors/AppError';
import { authService } from './auth.service';
import type { LoginInput, RegistroInput } from './auth.schema';

export const registrar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sesion = await authService.registrar(req.body as RegistroInput);
    res.status(201).json({ success: true, data: sesion });
  } catch (error) {
    next(error);
  }
};

export const iniciarSesion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sesion = await authService.iniciarSesion(req.body as LoginInput);
    res.status(200).json({ success: true, data: sesion });
  } catch (error) {
    next(error);
  }
};

export const perfil = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.usuario) {
      throw new AppError('No autenticado. Inicia sesion para continuar', 401);
    }
    const usuario = await authService.obtenerPerfil(req.usuario.userId);
    res.status(200).json({ success: true, data: { usuario } });
  } catch (error) {
    next(error);
  }
};
