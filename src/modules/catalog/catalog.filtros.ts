import type { Prisma } from '../../generated/prisma/client';
import type { ListadoQuery } from './catalog.schema';

type Filtros = Omit<ListadoQuery, 'pagina' | 'porPagina'>;
export function consultaProductos(f: Filtros) {
  const where: Prisma.ProductWhereInput = {};
  if (f.estado !== 'todos') where.status = f.estado;
  if (f.buscar) where.OR = ['name', 'description', 'brand', 'model'].map((campo) =>
    ({ [campo]: { contains: f.buscar, mode: 'insensitive' } }));
  if (f.precioMin !== undefined || f.precioMax !== undefined) where.price = { gte: f.precioMin, lte: f.precioMax };
  if (f.stock) where.stock = f.stock === 'disponible' ? { gt: 0 } : 0;
  const principal: Prisma.ProductOrderByWithRelationInput = f.orden === 'nombre' ? { name: 'asc' }
    : f.orden === 'precio-asc' ? { price: 'asc' } : f.orden === 'precio-desc' ? { price: 'desc' }
    : { createdAt: f.orden === 'antiguos' ? 'asc' : 'desc' };
  return { where, orderBy: [principal, { productId: 'desc' as const }] };
}
export function consultaCursos(f: Filtros) {
  const where: Prisma.CourseWhereInput = {};
  if (f.estado !== 'todos') where.status = f.estado;
  if (f.buscar) where.OR = ['name', 'description'].map((campo) =>
    ({ [campo]: { contains: f.buscar, mode: 'insensitive' } }));
  if (f.precioMin !== undefined || f.precioMax !== undefined) where.price = { gte: f.precioMin, lte: f.precioMax };
  if (f.duracionMax !== undefined) where.durationMinutes = { lte: f.duracionMax };
  const principal: Prisma.CourseOrderByWithRelationInput = f.orden === 'nombre' ? { name: 'asc' }
    : f.orden === 'precio-asc' ? { price: 'asc' } : f.orden === 'precio-desc' ? { price: 'desc' }
    : { createdAt: f.orden === 'antiguos' ? 'asc' : 'desc' };
  return { where, orderBy: [principal, { courseId: 'desc' as const }] };
}
