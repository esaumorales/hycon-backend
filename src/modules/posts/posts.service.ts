import { prisma } from '../../core/database/prisma';
import { listarConTotal } from '../../core/database/consultas';
import { AppError } from '../../core/errors/AppError';
import { almacenImagenes } from '../uploads/uploads.service';
import { aPaginacion } from '../catalog/catalog.mapper';
import type { ListadoPublicaciones } from './posts.schema';
import type { ConsultaListado, Listado } from '../catalog/catalog.service';
import type { PaginaDe, ResultadoActualizar, ResultadoEliminar } from '../catalog/catalog.types';
import type { PublicacionInput } from './posts.schema';
import type { PublicacionBase, PublicacionPublica } from './posts.types';
import { generarSlug, minutosDeLectura, slugDisponible } from './posts.utils';

type DatosGuardado = Omit<PublicacionInput, 'publishedAt'> & { slug: string; publishedAt?: Date };

export type OrdenPublicaciones = ListadoPublicaciones['orden'];

export interface ConsultaPublicaciones extends ConsultaListado {
  orden: OrdenPublicaciones;
}

export interface DependenciasPublicaciones {
  listar(consulta: ConsultaPublicaciones): Promise<PaginaDe<PublicacionBase>>;
  obtener(uuid: string): Promise<PublicacionBase | null>;
  // La web publica llega por la URL legible del articulo
  obtenerPorSlug(slug: string): Promise<PublicacionBase | null>;
  // Suma una lectura sin bloquear la respuesta del articulo
  sumarLectura(postId: number): Promise<unknown>;
  // Slugs que empiezan por la base, sin contar el del propio articulo al editar
  slugsParecidos(base: string, excluirUuid?: string): Promise<string[]>;
  crear(datos: DatosGuardado & { authorId: number }): Promise<PublicacionBase>;
  actualizar(uuid: string, datos: DatosGuardado): Promise<ResultadoActualizar<PublicacionBase>>;
  eliminar(uuid: string): Promise<ResultadoEliminar>;
  eliminarImagen(url: string): Promise<unknown>;
}

export const aPublicacionPublica = (publicacion: PublicacionBase): PublicacionPublica => ({
  uuid: publicacion.uuid,
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
  uuid: true,
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
  async listar({ estado, saltar, tomar, orden }) {
    const where = estado === 'todos' ? undefined : { status: estado };
    return listarConTotal(
      () =>
        prisma.post.findMany({
          where,
          select: seleccion,
          orderBy:
            orden === 'leidos'
              ? [{ views: 'desc' }, { publishedAt: 'desc' }]
              : [{ publishedAt: 'desc' }, { postId: 'desc' }],
          skip: saltar,
          take: tomar,
        }),
      () => prisma.post.count({ where })
    );
  },

  obtener: (uuid) => prisma.post.findUnique({ where: { uuid }, select: seleccion }),

  obtenerPorSlug: (slug) => prisma.post.findUnique({ where: { slug }, select: seleccion }),

  sumarLectura: (postId) => prisma.post.update({ where: { postId }, data: { views: { increment: 1 } } }),

  async slugsParecidos(base, excluirUuid) {
    const filas = await prisma.post.findMany({
      where: {
        slug: { startsWith: base },
        ...(excluirUuid ? { NOT: { uuid: excluirUuid } } : {}),
      },
      select: { slug: true },
    });
    return filas.map((fila) => fila.slug);
  },

  crear: ({ authorId, ...datos }) =>
    prisma.post.create({ data: { ...columnas(datos), authorId }, select: seleccion }),

  async actualizar(uuid, datos) {
    const previo = await prisma.post.findUnique({ where: { uuid }, select: { coverUrl: true } });
    if (!previo) return { tipo: 'no-encontrado' };

    const registro = await prisma.post.update({
      where: { uuid },
      data: columnas(datos),
      select: seleccion,
    });
    return {
      tipo: 'actualizado',
      registro,
      imagenesAnteriores: previo.coverUrl ? [previo.coverUrl] : [],
    };
  },

  async eliminar(uuid) {
    try {
      const borrado = await prisma.post.delete({ where: { uuid }, select: { coverUrl: true } });
      return { tipo: 'eliminado', imagenes: borrado.coverUrl ? [borrado.coverUrl] : [] };
    } catch (error) {
      if (codigoPrisma(error) === 'P2025') return { tipo: 'no-encontrado' };
      throw error;
    }
  },

  eliminarImagen: (url) => almacenImagenes.eliminar(url),
};

export const crearServicioPublicaciones = (deps: DependenciasPublicaciones) => {
  const resolverSlug = async (titulo: string, excluirUuid?: string) => {
    const base = generarSlug(titulo);
    return slugDisponible(base, await deps.slugsParecidos(base, excluirUuid));
  };

  const limpiarPortadas = async (anteriores: string[], vigente?: string) => {
    await Promise.all(
      anteriores.filter((url) => url !== vigente).map((url) => deps.eliminarImagen(url))
    );
  };

  return {
    async listar({ estado, pagina, porPagina, orden }: ListadoPublicaciones): Promise<Listado<PublicacionPublica>> {
      const { filas, total } = await deps.listar({
        estado,
        orden,
        saltar: (pagina - 1) * porPagina,
        tomar: porPagina,
      });
      return {
        elementos: filas.map(aPublicacionPublica),
        paginacion: aPaginacion(pagina, porPagina, total),
      };
    },

    /** Acepta el uuid del panel o el slug legible de la URL publica. */
    async obtener(
      referencia: { uuid: string } | { slug: string },
      opciones: { registrarLectura?: boolean } = {}
    ): Promise<PublicacionPublica> {
      const publicacion =
        'uuid' in referencia
          ? await deps.obtener(referencia.uuid)
          : await deps.obtenerPorSlug(referencia.slug);
      if (!publicacion) throw new AppError('Publicacion no encontrada', 404);

      if (opciones.registrarLectura && publicacion.status === 'active') {
        // Un fallo al contar no debe impedir leer el articulo
        await deps.sumarLectura(publicacion.postId).catch(() => undefined);
        return aPublicacionPublica({ ...publicacion, views: publicacion.views + 1 });
      }
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

    async actualizar(uuid: string, datos: PublicacionInput): Promise<PublicacionPublica> {
      const actual = await deps.obtener(uuid);
      if (!actual) throw new AppError('Publicacion no encontrada', 404);

      // El slug solo cambia si cambia el titulo, para no romper enlaces ya compartidos
      const slug =
        actual.title === datos.title ? actual.slug : await resolverSlug(datos.title, uuid);

      const resultado = await deps.actualizar(uuid, { ...datos, slug });
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Publicacion no encontrada', 404);
      }
      await limpiarPortadas(resultado.imagenesAnteriores, datos.coverUrl);
      return aPublicacionPublica(resultado.registro);
    },

    async eliminar(uuid: string): Promise<void> {
      const resultado = await deps.eliminar(uuid);
      if (resultado.tipo !== 'eliminado') {
        throw new AppError('Publicacion no encontrada', 404);
      }
      await limpiarPortadas(resultado.imagenes);
    },
  };
};

export const postsService = crearServicioPublicaciones(dependenciasReales);
