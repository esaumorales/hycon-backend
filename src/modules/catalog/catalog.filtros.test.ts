import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listadoQuerySchema } from './catalog.schema';
import { consultaProductos, consultaCursos } from './catalog.filtros';
vi.mock('../../core/database/prisma', () => ({ prisma: {
  product: { findMany: vi.fn(), count: vi.fn() }, course: { findMany: vi.fn(), count: vi.fn() },
} }));
import { prisma } from '../../core/database/prisma';
import { dependenciasReales } from './catalog.service';
beforeEach(() => vi.clearAllMocks());

describe('Filtros de productos', () => {
  it('combina búsqueda sin distinguir mayúsculas, estado, precio y stock', () => {
    const f = listadoQuerySchema.parse({ estado: 'inactive', buscar: '  Caja  ', precioMin: '0', precioMax: '100', stock: 'agotado', orden: 'precio-asc' });
    const consulta = consultaProductos(f);
    expect(consulta.where).toMatchObject({ status: 'inactive', price: { gte: 0, lte: 100 }, stock: 0 });
    expect(consulta.where.OR).toContainEqual({ name: { contains: 'Caja', mode: 'insensitive' } });
    expect(consulta.where.OR).toContainEqual({ brand: { contains: 'Caja', mode: 'insensitive' } });
    expect(consulta.orderBy).toEqual([{ price: 'asc' }, { productId: 'desc' }]);
  });
  it('disponibilidad excluye stock cero y todos no limita el estado', () => {
    expect(consultaProductos({ estado: 'todos', stock: 'disponible' }).where).toEqual({ stock: { gt: 0 } });
  });
  it.each(['-1', 'NaN', 'Infinity', '1000000'])('rechaza precio inválido %s', (precioMin) => {
    expect(listadoQuerySchema.safeParse({ precioMin }).success).toBe(false);
  });
  it('rechaza un rango de precios invertido', () => {
    expect(listadoQuerySchema.safeParse({ precioMin: 100, precioMax: 50 }).success).toBe(false);
  });
  it('el listado y el total usan los mismos filtros en Prisma', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.count).mockResolvedValue(7);
    const resultado = await dependenciasReales.listarProductos({ estado: 'active', buscar: 'caja', stock: 'disponible', saltar: 12, tomar: 12 });
    expect(resultado).toEqual({ filas: [], total: 7 });
    const consulta = vi.mocked(prisma.product.findMany).mock.calls[0][0]!;
    expect(prisma.product.count).toHaveBeenCalledWith({ where: consulta.where });
    expect(consulta).toMatchObject({ skip: 12, take: 12 });
  });
});
describe('Filtros de cursos', () => {
  it('combina precio y duración máxima en minutos', () => {
    const c = consultaCursos(listadoQuerySchema.parse({ buscar: 'logística', precioMax: 150, duracionMax: '90', orden: 'nombre' }));
    expect(c.where).toMatchObject({ status: 'active', price: { lte: 150 }, durationMinutes: { lte: 90 } });
    expect(c.where.OR).toContainEqual({ description: { contains: 'logística', mode: 'insensitive' } });
    expect(c.orderBy).toEqual([{ name: 'asc' }, { courseId: 'desc' }]);
  });
  it('rechaza duración fraccionaria y negativa', () => {
    expect(listadoQuerySchema.safeParse({ duracionMax: '1.5' }).success).toBe(false);
    expect(listadoQuerySchema.safeParse({ duracionMax: '-2' }).success).toBe(false);
  });
  it('el conteo comparte la consulta filtrada y mantiene paginación', async () => {
    vi.mocked(prisma.course.findMany).mockResolvedValue([]);
    vi.mocked(prisma.course.count).mockResolvedValue(3);
    await dependenciasReales.listarCursos({ estado: 'todos', duracionMax: 120, orden: 'antiguos', saltar: 6, tomar: 6 });
    const consulta = vi.mocked(prisma.course.findMany).mock.calls[0][0]!;
    expect(prisma.course.count).toHaveBeenCalledWith({ where: consulta.where });
    expect(consulta.orderBy).toEqual([{ createdAt: 'asc' }, { courseId: 'desc' }]);
  });
});
