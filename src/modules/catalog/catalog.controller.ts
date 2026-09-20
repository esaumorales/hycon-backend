import type { Request } from 'express';
import { leerId, manejar, obtenerUsuarioId as obtenerOwnerId } from '../../core/utils/controlador';
import { catalogService } from './catalog.service';
import { AGENCIAS_ENVIO } from './catalog.constants';
import { listadoQuerySchema } from './catalog.schema';
import type { CursoInput, ProductoInput } from './catalog.schema';

// Los parametros invalidos de la URL no rompen la peticion: caen a su valor por defecto
const leerListado = (req: Request) => listadoQuerySchema.parse(req.query);

export const listarAgencias = manejar(async (_req, res) => {
  res.status(200).json({ success: true, data: { agencias: AGENCIAS_ENVIO } });
});

export const listarProductos = manejar(async (req, res) => {
  const { elementos, paginacion } = await catalogService.listarProductos(leerListado(req));
  res.status(200).json({ success: true, data: { productos: elementos, paginacion } });
});

export const obtenerProducto = manejar(async (req, res) => {
  const producto = await catalogService.obtenerProducto(leerId(req));
  res.status(200).json({ success: true, data: { producto } });
});

export const crearProducto = manejar(async (req, res) => {
  const producto = await catalogService.crearProducto(
    req.body as ProductoInput,
    obtenerOwnerId(req)
  );
  res.status(201).json({ success: true, data: { producto } });
});

export const actualizarProducto = manejar(async (req, res) => {
  const producto = await catalogService.actualizarProducto(leerId(req), req.body as ProductoInput);
  res.status(200).json({ success: true, data: { producto } });
});

export const eliminarProducto = manejar(async (req, res) => {
  await catalogService.eliminarProducto(leerId(req));
  res.status(204).end();
});

export const listarCursos = manejar(async (req, res) => {
  const { elementos, paginacion } = await catalogService.listarCursos(leerListado(req));
  res.status(200).json({ success: true, data: { cursos: elementos, paginacion } });
});

export const obtenerCurso = manejar(async (req, res) => {
  const curso = await catalogService.obtenerCurso(leerId(req));
  res.status(200).json({ success: true, data: { curso } });
});

export const crearCurso = manejar(async (req, res) => {
  const curso = await catalogService.crearCurso(req.body as CursoInput, obtenerOwnerId(req));
  res.status(201).json({ success: true, data: { curso } });
});

export const actualizarCurso = manejar(async (req, res) => {
  const curso = await catalogService.actualizarCurso(leerId(req), req.body as CursoInput);
  res.status(200).json({ success: true, data: { curso } });
});

export const eliminarCurso = manejar(async (req, res) => {
  await catalogService.eliminarCurso(leerId(req));
  res.status(204).end();
});
