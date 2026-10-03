import { describe, expect, it, vi } from 'vitest';
import { listadoPublicacionesSchema } from './posts.schema';
import { consultaPublicaciones } from './posts.filtros';
vi.mock('../../core/database/prisma', () => ({ prisma: { post: { findMany: vi.fn(), count: vi.fn() } } }));
import { prisma } from '../../core/database/prisma';
import { dependenciasReales } from './posts.service';
describe('Filtros de publicaciones', () => {
  it('busca en título, resumen y contenido junto con el estado', () => {
    const consulta = consultaPublicaciones(listadoPublicacionesSchema.parse({ buscar: '  inventario  ', estado: 'inactive', orden: 'titulo' }));
    expect(consulta.where.status).toBe('inactive');
    expect(consulta.where.OR).toContainEqual({ title: { contains: 'inventario', mode: 'insensitive' } });
    expect(consulta.where.OR).toContainEqual({ content: { contains: 'inventario', mode: 'insensitive' } });
    expect(consulta.orderBy).toEqual([{ title: 'asc' }, { postId: 'desc' }]);
  });
  it('incluye el día final completo con el calendario de Perú', () => {
    const c = consultaPublicaciones(listadoPublicacionesSchema.parse({ desde: '2026-10-02', hasta: '2026-10-02' }));
    expect(c.where.publishedAt).toEqual({ gte: new Date('2026-10-02T05:00:00Z'), lt: new Date('2026-10-03T05:00:00Z') });
  });
  it.each(['2026-02-30', '2026-13-01', 'ayer'])('rechaza fechas imposibles %s', (desde) => {
    expect(listadoPublicacionesSchema.safeParse({ desde }).success).toBe(false);
  });
  it('rechaza el rango invertido', () => {
    expect(listadoPublicacionesSchema.safeParse({ desde: '2026-10-03', hasta: '2026-10-01' }).success).toBe(false);
  });
  it('desempata el orden por lecturas para evitar duplicados entre páginas', () => {
    expect(consultaPublicaciones({ estado: 'todos', orden: 'leidos' }).orderBy).toEqual([{ views: 'desc' }, { publishedAt: 'desc' }, { postId: 'desc' }]);
  });
  it('usa los mismos filtros para contar y listar', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([]);
    vi.mocked(prisma.post.count).mockResolvedValue(2);
    await dependenciasReales.listar({ estado: 'todos', orden: 'antiguos', buscar: 'caja', desde: '2026-09-01', saltar: 9, tomar: 9 });
    const c = vi.mocked(prisma.post.findMany).mock.calls[0][0]!;
    expect(prisma.post.count).toHaveBeenCalledWith({ where: c.where });
    expect(c).toMatchObject({ skip: 9, take: 9 });
  });
});
