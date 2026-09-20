import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import { almacenImagenes } from '../uploads/uploads.service';
import { aPaginacion } from '../catalog/catalog.mapper';
import type { ListadoQuery } from '../catalog/catalog.schema';
import type { ConsultaListado, Listado } from '../catalog/catalog.service';
import type { PaginaDe, ResultadoActualizar, ResultadoEliminar } from '../catalog/catalog.types';
import type { PublicacionInput } from './posts.schema';
import type { PublicacionBase, PublicacionPublica } from './posts.types';
import { generarSlug, minutosDeLectura, slugDisponible } from './posts.utils';

type DatosGuardado = Omit<PublicacionInput, 'publishedAt'> & { slug: string; publishedAt?: Date };

export interface DependenciasPublicaciones {
  listar(consulta: ConsultaListado): Promise<PaginaDe<PublicacionBase>>;
  obtener(id: number): Promise<PublicacionBase | null>;
  // Slugs que empiezan por la base, sin contar el del propio articulo al editar
  slugsParecidos(base: string, excluirId?: number): Promise<string[]>;
  crear(datos: DatosGuardado & { authorId: number }): Promise<PublicacionBase>;
  actualizar(id: number, datos: DatosGuardado): Promise<ResultadoActualizar<PublicacionBase>>;
  eliminar(id: number): Promise<ResultadoEliminar>;
  eliminarImagen(url: string): Promise<unknown>;
}

export const aPublicacionPublica = (publicacion: PublicacionBase): PublicacionPublica => ({
  postId: publicacion.postId,
  title: publicacion.title,
  slug: publicacion.slug,
  excerpt: publicacion.excerpt,
  content: publicacion.content,
  coverUrl: publicacion.coverUrl,
  status: publicacion.status,
  views: publicacion.views,
  readingMinutes: minutosDeLectura(publicacion.content),
  authorName: `${publicacion.author.name} ${publicacion.author.lastname}`.trim(),
  publishedAt: publicacion.publishedAt.toISOString(),
  createdAt: publicacion.createdAt.toISOString(),
});

const seleccion = {
  postId: true,
  authorId: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverUrl: true,
  status: true,
  views: true,
  publishedAt: true,
  createdAt: true,
  author: { select: { name: true, lastname: true } },
} as const;

const codigoPrisma = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

const columnas = (datos: DatosGuardado) => ({
  title: datos.title,
  slug: datos.slug,
  excerpt: datos.excerpt ?? null,
  content: datos.content,
  coverUrl: datos.coverUrl ?? null,
  status: datos.status,
  // undefined en Prisma significa "no tocar": al editar sin fecha se conserva
  publishedAt: datos.publishedAt,
});

export const dependenciasReales: DependenciasPublicaciones = {
  async listar({ estado, saltar, tomar }) {
    const where = estado === 'todos' ? undefined : { status: estado };
    const [filas, total] = await prisma.$transaction([
      prisma.post.findMany({
        where,
        select: seleccion,
        orderBy: [{ publishedAt: 'desc' }, { postId: 'desc' }],
        skip: saltar,
        take: tomar,
      }),
      prisma.post.count({ where }),
    ]);
    return { filas, total };
  },

  obtener: (id) => prisma.post.findUnique({ where: { postId: id }, select: seleccion }),

  async slugsParecidos(base, excluirId) {
    const filas = await prisma.post.findMany({
      where: {
        slug: { startsWith: base },
        ...(excluirId ? { NOT: { postId: excluirId } } : {}),
      },
      select: { slug: true },
    });
    return filas.map((fila) => fila.slug);
  },

  crear: ({ authorId, ...datos }) =>
    prisma.post.create({ data: { ...columnas(datos), authorId }, select: seleccion }),

  async actualizar(id, datos) {
    const previo = await prisma.post.findUnique({ where: { postId: id }, select: { coverUrl: true } });
    if (!previo) return { tipo: 'no-encontrado' };

    const registro = await prisma.post.update({
      where: { postId: id },
      data: columnas(datos),
      select: seleccion,
    });
    return {
      tipo: 'actualizado',
      registro,
      imagenesAnteriores: previo.coverUrl ? [previo.coverUrl] : [],
    };
  },

  async eliminar(id) {
    try {
      const borrado = await prisma.post.delete({ where: { postId: id }, select: { coverUrl: true } });
      return { tipo: 'eliminado', imagenes: borrado.coverUrl ? [borrado.coverUrl] : [] };
    } catch (error) {
      if (codigoPrisma(error) === 'P2025') return { tipo: 'no-encontrado' };
      throw error;
    }
  },

  eliminarImagen: (url) => almacenImagenes.eliminar(url),
};

export const crearServicioPublicaciones = (deps: DependenciasPublicaciones) => {
  const resolverSlug = async (titulo: string, excluirId?: number) => {
    const base = generarSlug(titulo);
    return slugDisponible(base, await deps.slugsParecidos(base, excluirId));
  };

  const limpiarPortadas = async (anteriores: string[], vigente?: string) => {
    await Promise.all(
      anteriores.filter((url) => url !== vigente).map((url) => deps.eliminarImagen(url))
    );
  };

  return {
    async listar({ estado, pagina, porPagina }: ListadoQuery): Promise<Listado<PublicacionPublica>> {
      const { filas, total } = await deps.listar({
        estado,
        saltar: (pagina - 1) * porPagina,
        tomar: porPagina,
      });
      return {
        elementos: filas.map(aPublicacionPublica),
        paginacion: aPaginacion(pagina, porPagina, total),
      };
    },

    async obtener(id: number): Promise<PublicacionPublica> {
      const publicacion = await deps.obtener(id);
      if (!publicacion) throw new AppError('Publicacion no encontrada', 404);
      return aPublicacionPublica(publicacion);
    },

    async crear(datos: PublicacionInput, authorId: number): Promise<PublicacionPublica> {
      if (!authorId) {
        throw new AppError('No se pudo identificar al autor de la publicacion', 401);
      }
      const slug = await resolverSlug(datos.title);
      const creada = await deps.crear({
        ...datos,
        slug,
        publishedAt: datos.publishedAt ?? new Date(),
        authorId,
      });
      return aPublicacionPublica(creada);
    },

    async actualizar(id: number, datos: PublicacionInput): Promise<PublicacionPublica> {
      const actual = await deps.obtener(id);
      if (!actual) throw new AppError('Publicacion no encontrada', 404);

      // El slug solo cambia si cambia el titulo, para no romper enlaces ya compartidos
      const slug =
        actual.title === datos.title ? actual.slug : await resolverSlug(datos.title, id);

      const resultado = await deps.actualizar(id, { ...datos, slug });
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Publicacion no encontrada', 404);
      }
      await limpiarPortadas(resultado.imagenesAnteriores, datos.coverUrl);
      return aPublicacionPublica(resultado.registro);
    },

    async eliminar(id: number): Promise<void> {
      const resultado = await deps.eliminar(id);
      if (resultado.tipo !== 'eliminado') {
        throw new AppError('Publicacion no encontrada', 404);
      }
      await limpiarPortadas(resultado.imagenes);
    },
  };
};

export const postsService = crearServicioPublicaciones(dependenciasReales);
