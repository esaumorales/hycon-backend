import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../core/errors/AppError';
import { catalogService } from './catalog.service';
import { listadoQuerySchema } from './catalog.schema';
import type { CrearCursoInput, CrearProductoInput } from './catalog.schema';

// El propietario del registro es siempre el usuario autenticado, nunca el body
const obtenerOwnerId = (req: Request): number => {
  if (!req.usuario) {
    throw new AppError('No autenticado. Inicia sesion para continuar', 401);
  }
  return req.usuario.userId;
};

// Un estado invalido en la URL no rompe la peticion: se ignora y se usa el valor por defecto
const leerEstado = (req: Request) => listadoQuerySchema.catch({ estado: 'active' }).parse(req.query).estado;

export const listarProductos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productos = await catalogService.listarProductos(leerEstado(req));
    res.status(200).json({ success: true, data: { productos } });
  } catch (error) {
    next(error);
  }
};

export const crearProducto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const producto = await catalogService.crearProducto(
      req.body as CrearProductoInput,
      obtenerOwnerId(req)
    );
    res.status(201).json({ success: true, data: { producto } });
  } catch (error) {
    next(error);
  }
};

export const listarCursos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cursos = await catalogService.listarCursos(leerEstado(req));
    res.status(200).json({ success: true, data: { cursos } });
  } catch (error) {
    next(error);
  }
};

export const crearCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const curso = await catalogService.crearCurso(
      req.body as CrearCursoInput,
      obtenerOwnerId(req)
    );
    res.status(201).json({ success: true, data: { curso } });
  } catch (error) {
    next(error);
  }
};
