import type { Prisma } from '../../generated/prisma/client';
import type { ListadoPublicaciones } from './posts.schema';
export function consultaPublicaciones(f: Omit<ListadoPublicaciones, 'pagina' | 'porPagina'>) {
  const where: Prisma.PostWhereInput = {};
  if (f.estado !== 'todos') where.status = f.estado;
  if (f.buscar) where.OR = ['title', 'excerpt', 'content'].map((campo) =>
    ({ [campo]: { contains: f.buscar, mode: 'insensitive' } }));
  // Dates follow Peru's calendar: midnight at UTC-5, exclusive next-day end.
  if (f.desde || f.hasta) where.publishedAt = {
    gte: f.desde ? new Date(`${f.desde}T00:00:00-05:00`) : undefined,
    lt: f.hasta ? new Date(new Date(`${f.hasta}T00:00:00-05:00`).getTime() + 86400000) : undefined,
  };
  const orderBy: Prisma.PostOrderByWithRelationInput[] = f.orden === 'leidos'
    ? [{ views: 'desc' }, { publishedAt: 'desc' }]
    : f.orden === 'titulo' ? [{ title: 'asc' }]
    : [{ publishedAt: f.orden === 'antiguos' ? 'asc' : 'desc' }];
  orderBy.push({ postId: 'desc' });
  return { where, orderBy };
}
