import { manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { AppError } from '../../core/errors/AppError';
import { ergoService } from './ergo.service';
import { empresaSchema, fichaSchema, actualizarFichaSchema, idErgoSchema } from './ergo.schema';
import type { z } from 'zod';

function validar<T extends z.ZodType>(schema: T, datos: unknown): z.output<T> {
  const resultado = schema.safeParse(datos);
  if (!resultado.success) throw new AppError(resultado.error.issues[0]?.message || 'Datos inválidos.', 400);
  return resultado.data;
}
const mapEmpresa = (e: Awaited<ReturnType<typeof ergoService.obtenerEmpresa>>) => ({ id: String(e.companyId), nombre: e.name, fecha: e.createdAt.toISOString(), totalFichas: e._count.forms });
const mapFicha = (f: Awaited<ReturnType<typeof ergoService.obtenerFicha>>) => ({ id: String(f.formId), empresaId: String(f.companyId), nombre: f.name, fecha: f.createdAt.toISOString(), actualizada: f.updatedAt.toISOString(), payload: f.payload });

export const obtenerEmpresas = manejar(async (req, res) => {
  res.json({ data: (await ergoService.obtenerEmpresas(obtenerUsuarioId(req))).map(mapEmpresa) });
});
export const crearEmpresa = manejar(async (req, res) => {
  const datos = validar(empresaSchema, req.body);
  res.status(201).json({ data: mapEmpresa(await ergoService.crearEmpresa(obtenerUsuarioId(req), datos.nombre)) });
});
export const obtenerEmpresa = manejar(async (req, res) => {
  res.json({ data: mapEmpresa(await ergoService.obtenerEmpresa(validar(idErgoSchema, req.params.id), obtenerUsuarioId(req))) });
});
export const obtenerFichas = manejar(async (req, res) => {
  res.json({ data: (await ergoService.obtenerFichas(validar(idErgoSchema, req.params.id), obtenerUsuarioId(req))).map(mapFicha) });
});
export const obtenerFicha = manejar(async (req, res) => {
  res.json({ data: mapFicha(await ergoService.obtenerFicha(validar(idErgoSchema, req.params.id), validar(idErgoSchema, req.params.fichaId), obtenerUsuarioId(req))) });
});
export const crearFicha = manejar(async (req, res) => {
  res.status(201).json({ data: mapFicha(await ergoService.crearFicha(validar(idErgoSchema, req.params.id), obtenerUsuarioId(req), validar(fichaSchema, req.body))) });
});
export const actualizarFicha = manejar(async (req, res) => {
  const datos = validar(actualizarFichaSchema, req.body);
  res.json({ data: mapFicha(await ergoService.actualizarFicha(validar(idErgoSchema, req.params.id), validar(idErgoSchema, req.params.fichaId), obtenerUsuarioId(req), datos, datos.version)) });
});
