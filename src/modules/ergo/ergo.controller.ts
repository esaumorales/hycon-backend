import type { Request, Response } from 'express';
import { manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { AppError } from '../../core/errors/AppError';
import { ergoService } from './ergo.service';
import { empresaSchema, fichaSchema } from './ergo.schema';

export const crearEmpresa = manejar(async (req: Request, res: Response) => {
  const userId = obtenerUsuarioId(req);
  
  const validacion = empresaSchema.safeParse(req.body);
  if (!validacion.success) {
    throw new AppError(validacion.error.issues[0].message, 400);
  }
  
  const empresa = await ergoService.crearEmpresa(userId, validacion.data.nombre);
  
  res.status(201).json({ 
    data: {
      id: empresa.companyId.toString(),
      nombre: empresa.name,
      fecha: empresa.createdAt.toLocaleDateString()
    }
  });
});

export const obtenerEmpresas = manejar(async (req: Request, res: Response) => {
  const userId = obtenerUsuarioId(req);
  const empresas = await ergoService.obtenerEmpresas(userId);
  
  res.json({
    data: empresas.map(e => ({
      id: e.companyId.toString(),
      nombre: e.name,
      fecha: e.createdAt.toLocaleDateString()
    }))
  });
});

export const obtenerFichas = manejar(async (req: Request, res: Response) => {
  const userId = obtenerUsuarioId(req);
  const companyId = Number.parseInt(String(req.params.id), 10);
  if (isNaN(companyId)) throw new AppError('ID de empresa inválido', 400);

  const fichas = await ergoService.obtenerFichas(companyId, userId);
  
  res.json({
    data: fichas.map(f => ({
      id: f.formId.toString(),
      nombre: f.name,
      fecha: f.createdAt.toLocaleDateString(),
      estado: 'En progreso'
    }))
  });
});


export const crearFicha = manejar(async (req: Request, res: Response) => {
  const userId = obtenerUsuarioId(req);
  const companyId = Number.parseInt(String(req.params.id), 10);
  if (isNaN(companyId)) throw new AppError('ID de empresa inválido', 400);

  const validacion = fichaSchema.safeParse(req.body);
  if (!validacion.success) {
    console.error("ERROR ZOD:", JSON.stringify(validacion.error.issues, null, 2));
    throw new AppError(validacion.error.issues[0].message, 400);
  }

  try {
    const ficha = await ergoService.crearFicha(
      companyId, 
      userId, 
      validacion.data.nombre, 
      validacion.data.description, 
      validacion.data.payload
    );

    res.status(201).json({
      data: {
        id: ficha.formId.toString(),
        nombre: ficha.name,
        fecha: ficha.createdAt.toLocaleDateString(),
        estado: 'En progreso'
      }
    });
  } catch(error: any) {
    console.error("ERROR CREAR FICHA:", error.message);
    throw error;
  }
});
