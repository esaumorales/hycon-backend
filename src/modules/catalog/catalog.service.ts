import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import { aCursoPublico, aProductoDetallePublico, aProductoPublico } from './catalog.mapper';
import type { CrearCursoInput, CrearProductoInput, ListadoQuery } from './catalog.schema';
import type { CursoBase, CursoPublico, ProductoBase, ProductoDetallePublico, ProductoPublico } from './catalog.types';

// Tope de seguridad: el panel no pagina, pero tampoco se traen filas sin limite
export const LIMITE_LISTADO = 200;

export type EstadoListado = ListadoQuery['estado'];

// 'todos' no filtra; cualquier otro valor filtra por esa columna status
const filtroEstado = (estado: EstadoListado) =>
  estado === 'todos' ? undefined : { status: estado };

export interface DependenciasCatalogo {
  listarProductos(limite: number, estado: EstadoListado): Promise<ProductoBase[]>;
  obtenerProducto(productId: number): Promise<ProductoBase | null>;
  crearProducto(datos: CrearProductoInput & { ownerId: number }): Promise<ProductoBase>;
  listarCursos(limite: number, estado: EstadoListado): Promise<CursoBase[]>;
  obtenerCurso(courseId: number): Promise<CursoBase | null>;
  crearCurso(datos: CrearCursoInput & { ownerId: number }): Promise<CursoBase>;
}

const seleccionProducto = {
  productId: true,
  ownerId: true,
  name: true,
  description: true,
  brand: true,
  model: true,
  price: true,
  discountPrice: true,
  stock: true,
  status: true,
  createdAt: true,
  images: { select: { imageUrl: true, isThumbnail: true }, orderBy: { sortOrder: 'asc' } },
} as const;

const seleccionCurso = {
  courseId: true,
  ownerId: true,
  name: true,
  description: true,
  videoUrl: true,
  thumbnailUrl: true,
  durationMinutes: true,
  price: true,
  discountPrice: true,
  status: true,
  createdAt: true,
} as const;

export const dependenciasReales: DependenciasCatalogo = {
  listarProductos: (limite, estado) =>
    prisma.product.findMany({
      where: filtroEstado(estado),
      select: seleccionProducto,
      orderBy: { createdAt: 'desc' },
      take: limite,
    }) as unknown as Promise<ProductoBase[]>,

  obtenerProducto: (productId) =>
    prisma.product.findFirst({
      where: { productId, status: 'active' },
      select: seleccionProducto,
    }) as unknown as Promise<ProductoBase | null>,

  crearProducto: ({ imageUrl, ...datos }) =>
    prisma.product.create({
      data: {
        ...datos,
        // La imagen opcional se guarda como miniatura del producto
        images: imageUrl
          ? { create: [{ imageUrl, isThumbnail: true, sortOrder: 0 }] }
          : undefined,
      },
      select: seleccionProducto,
    }) as unknown as Promise<ProductoBase>,

  listarCursos: (limite, estado) =>
    prisma.course.findMany({
      where: filtroEstado(estado),
      select: seleccionCurso,
      orderBy: { createdAt: 'desc' },
      take: limite,
    }) as unknown as Promise<CursoBase[]>,

  obtenerCurso: (courseId) =>
    prisma.course.findFirst({
      where: { courseId, status: 'active' },
      select: seleccionCurso,
    }) as unknown as Promise<CursoBase | null>,

  crearCurso: (datos) =>
    prisma.course.create({
      data: datos,
      select: seleccionCurso,
    }) as unknown as Promise<CursoBase>,
};

export const crearServicioCatalogo = (deps: DependenciasCatalogo) => ({
  async listarProductos(estado: EstadoListado = 'active'): Promise<ProductoPublico[]> {
    const productos = await deps.listarProductos(LIMITE_LISTADO, estado);
    return productos.map(aProductoPublico);
  },

  async obtenerProducto(productId: number): Promise<ProductoDetallePublico> {
    const producto = await deps.obtenerProducto(productId);
    if (!producto) throw new AppError('Producto no encontrado', 404);
    return aProductoDetallePublico(producto);
  },

  async crearProducto(datos: CrearProductoInput, ownerId: number): Promise<ProductoPublico> {
    if (!ownerId) {
      throw new AppError('No se pudo identificar al usuario que crea el producto', 401);
    }
    const producto = await deps.crearProducto({ ...datos, ownerId });
    return aProductoPublico(producto);
  },

  async listarCursos(estado: EstadoListado = 'active'): Promise<CursoPublico[]> {
    const cursos = await deps.listarCursos(LIMITE_LISTADO, estado);
    return cursos.map(aCursoPublico);
  },

  async obtenerCurso(courseId: number): Promise<CursoPublico> {
    const curso = await deps.obtenerCurso(courseId);
    if (!curso) throw new AppError('Curso no encontrado', 404);
    return aCursoPublico(curso);
  },

  async crearCurso(datos: CrearCursoInput, ownerId: number): Promise<CursoPublico> {
    if (!ownerId) {
      throw new AppError('No se pudo identificar al usuario que crea el curso', 401);
    }
    const curso = await deps.crearCurso({ ...datos, ownerId });
    return aCursoPublico(curso);
  },
});

export const catalogService = crearServicioCatalogo(dependenciasReales);
