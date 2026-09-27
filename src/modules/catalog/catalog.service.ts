import { prisma } from '../../core/database/prisma';
import { AppError } from '../../core/errors/AppError';
import { almacenImagenes } from '../uploads/uploads.service';
import { aCursoPublico, aPaginacion, aProductoPublico } from './catalog.mapper';
import type { CursoInput, ListadoQuery, ProductoInput } from './catalog.schema';
import type {
  CursoBase,
  CursoPublico,
  PaginaDe,
  Paginacion,
  ProductoBase,
  ProductoPublico,
  ResultadoActualizar,
  ResultadoEliminar,
} from './catalog.types';

export type EstadoListado = ListadoQuery['estado'];

export interface ConsultaListado {
  estado: EstadoListado;
  saltar: number;
  tomar: number;
}

// 'todos' no filtra; cualquier otro valor filtra por esa columna status
const filtroEstado = (estado: EstadoListado) =>
  estado === 'todos' ? undefined : { status: estado };

export interface DependenciasCatalogo {
  listarProductos(consulta: ConsultaListado): Promise<PaginaDe<ProductoBase>>;
  obtenerProducto(uuid: string): Promise<ProductoBase | null>;
  crearProducto(datos: ProductoInput & { ownerId: number }): Promise<ProductoBase>;
  actualizarProducto(uuid: string, datos: ProductoInput): Promise<ResultadoActualizar<ProductoBase>>;
  eliminarProducto(uuid: string): Promise<ResultadoEliminar>;

  listarCursos(consulta: ConsultaListado): Promise<PaginaDe<CursoBase>>;
  obtenerCurso(uuid: string): Promise<CursoBase | null>;
  crearCurso(datos: CursoInput & { ownerId: number }): Promise<CursoBase>;
  actualizarCurso(uuid: string, datos: CursoInput): Promise<ResultadoActualizar<CursoBase>>;
  eliminarCurso(uuid: string): Promise<ResultadoEliminar>;

  // Borra del disco una imagen que ya no usa ningun registro
  eliminarImagen(url: string): Promise<unknown>;
}

export interface Listado<T> {
  elementos: T[];
  paginacion: Paginacion;
}

const seleccionProducto = {
  productId: true,
  uuid: true,
  ownerId: true,
  name: true,
  description: true,
  brand: true,
  model: true,
  color: true,
  price: true,
  discountPrice: true,
  stock: true,
  shippingAgencies: true,
  status: true,
  createdAt: true,
  images: { select: { imageUrl: true, isThumbnail: true }, orderBy: { sortOrder: 'asc' } },
} as const;

const seleccionCurso = {
  courseId: true,
  uuid: true,
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

// Codigos de Prisma: P2025 registro inexistente, P2003 clave foranea en uso
const codigoPrisma = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

// En la base se guarda la imagen principal con orden 0; el resto no se gestiona desde el panel
const imagenPrincipal = (imageUrl?: string) =>
  imageUrl ? { create: [{ imageUrl, isThumbnail: true, sortOrder: 0 }] } : undefined;

// Al editar, los valores opcionales ausentes deben vaciar la columna, no conservar el anterior
const columnasProducto = (datos: Omit<ProductoInput, 'imageUrl'>) => ({
  name: datos.name,
  description: datos.description ?? null,
  brand: datos.brand ?? null,
  model: datos.model ?? null,
  color: datos.color ?? null,
  price: datos.price,
  discountPrice: datos.discountPrice ?? null,
  stock: datos.stock,
  shippingAgencies: datos.shippingAgencies,
  status: datos.status,
});

const columnasCurso = (datos: CursoInput) => ({
  name: datos.name,
  description: datos.description ?? null,
  videoUrl: datos.videoUrl ?? null,
  thumbnailUrl: datos.thumbnailUrl ?? null,
  durationMinutes: datos.durationMinutes ?? null,
  price: datos.price,
  discountPrice: datos.discountPrice ?? null,
  status: datos.status,
});

export const dependenciasReales: DependenciasCatalogo = {
  async listarProductos({ estado, saltar, tomar }) {
    const where = filtroEstado(estado);
    const [filas, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        select: seleccionProducto,
        // productId desempata los creados en el mismo instante: sin eso una fila
        // podria aparecer en dos paginas seguidas
        orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }],
        skip: saltar,
        take: tomar,
      }),
      prisma.product.count({ where }),
    ]);
    return { filas: filas as unknown as ProductoBase[], total };
  },

  obtenerProducto: (uuid) =>
    prisma.product.findUnique({
      where: { uuid },
      select: seleccionProducto,
    }) as unknown as Promise<ProductoBase | null>,

  crearProducto: ({ imageUrl, ownerId, ...datos }) =>
    prisma.product.create({
      data: { ...columnasProducto(datos), ownerId, images: imagenPrincipal(imageUrl) },
      select: seleccionProducto,
    }) as unknown as Promise<ProductoBase>,

  async actualizarProducto(uuid, { imageUrl, ...datos }) {
    const previo = await prisma.product.findUnique({
      where: { uuid },
      select: { images: { select: { imageUrl: true } } },
    });
    if (!previo) return { tipo: 'no-encontrado' };

    const registro = await prisma.product.update({
      where: { uuid },
      data: {
        ...columnasProducto(datos),
        // Se reemplaza la imagen principal completa: borrar y volver a crear es mas simple
        // que comparar, y la tabla solo guarda la URL
        images: { deleteMany: {}, ...imagenPrincipal(imageUrl) },
      },
      select: seleccionProducto,
    });

    return {
      tipo: 'actualizado',
      registro: registro as unknown as ProductoBase,
      imagenesAnteriores: previo.images.map((imagen) => imagen.imageUrl),
    };
  },

  async eliminarProducto(uuid) {
    // Las imagenes cuelgan del correlativo, asi que primero se traduce el uuid
    const producto = await prisma.product.findUnique({ where: { uuid }, select: { productId: true } });
    if (!producto) return { tipo: 'no-encontrado' };
    const productId = producto.productId;

    try {
      const [imagenes] = await prisma.$transaction([
        prisma.productImage.findMany({ where: { productId }, select: { imageUrl: true } }),
        prisma.productImage.deleteMany({ where: { productId } }),
        prisma.product.delete({ where: { productId } }),
      ]);
      return { tipo: 'eliminado', imagenes: imagenes.map((imagen) => imagen.imageUrl) };
    } catch (error) {
      if (codigoPrisma(error) === 'P2025') return { tipo: 'no-encontrado' };
      if (codigoPrisma(error) === 'P2003') return { tipo: 'en-uso' };
      throw error;
    }
  },

  async listarCursos({ estado, saltar, tomar }) {
    const where = filtroEstado(estado);
    const [filas, total] = await prisma.$transaction([
      prisma.course.findMany({
        where,
        select: seleccionCurso,
        orderBy: [{ createdAt: 'desc' }, { courseId: 'desc' }],
        skip: saltar,
        take: tomar,
      }),
      prisma.course.count({ where }),
    ]);
    return { filas: filas as unknown as CursoBase[], total };
  },

  obtenerCurso: (uuid) =>
    prisma.course.findUnique({
      where: { uuid },
      select: seleccionCurso,
    }) as unknown as Promise<CursoBase | null>,

  crearCurso: ({ ownerId, ...datos }) =>
    prisma.course.create({
      data: { ...columnasCurso(datos), ownerId },
      select: seleccionCurso,
    }) as unknown as Promise<CursoBase>,

  async actualizarCurso(uuid, datos) {
    const previo = await prisma.course.findUnique({
      where: { uuid },
      select: { thumbnailUrl: true },
    });
    if (!previo) return { tipo: 'no-encontrado' };

    const registro = await prisma.course.update({
      where: { uuid },
      data: columnasCurso(datos),
      select: seleccionCurso,
    });

    return {
      tipo: 'actualizado',
      registro: registro as unknown as CursoBase,
      imagenesAnteriores: previo.thumbnailUrl ? [previo.thumbnailUrl] : [],
    };
  },

  async eliminarCurso(uuid) {
    try {
      const curso = await prisma.course.delete({
        where: { uuid },
        select: { thumbnailUrl: true },
      });
      return { tipo: 'eliminado', imagenes: curso.thumbnailUrl ? [curso.thumbnailUrl] : [] };
    } catch (error) {
      if (codigoPrisma(error) === 'P2025') return { tipo: 'no-encontrado' };
      if (codigoPrisma(error) === 'P2003') return { tipo: 'en-uso' };
      throw error;
    }
  },

  eliminarImagen: (url) => almacenImagenes.eliminar(url),
};

const exigirPropietario = (ownerId: number, entidad: string) => {
  if (!ownerId) {
    throw new AppError(`No se pudo identificar al usuario que crea el ${entidad}`, 401);
  }
};

export const crearServicioCatalogo = (deps: DependenciasCatalogo) => {
  // Solo se borran las imagenes que el registro ya no usa tras el cambio
  const limpiarImagenes = async (anteriores: string[], vigentes: Array<string | undefined>) => {
    const sobrantes = anteriores.filter((url) => !vigentes.includes(url));
    await Promise.all(sobrantes.map((url) => deps.eliminarImagen(url)));
  };

  const listar = async <B, P>(
    consultar: (consulta: ConsultaListado) => Promise<PaginaDe<B>>,
    mapear: (fila: B) => P,
    { estado, pagina, porPagina }: ListadoQuery
  ): Promise<Listado<P>> => {
    const { filas, total } = await consultar({
      estado,
      saltar: (pagina - 1) * porPagina,
      tomar: porPagina,
    });
    return { elementos: filas.map(mapear), paginacion: aPaginacion(pagina, porPagina, total) };
  };

  return {
    listarProductos: (consulta: ListadoQuery) =>
      listar(deps.listarProductos, aProductoPublico, consulta),

    async obtenerProducto(uuid: string): Promise<ProductoPublico> {
      const producto = await deps.obtenerProducto(uuid);
      if (!producto) throw new AppError('Producto no encontrado', 404);
      return aProductoPublico(producto);
    },

    async crearProducto(datos: ProductoInput, ownerId: number): Promise<ProductoPublico> {
      exigirPropietario(ownerId, 'producto');
      // El propietario sale siempre del token, aunque el cuerpo intente colar otro
      const producto = await deps.crearProducto({ ...datos, ownerId });
      return aProductoPublico(producto);
    },

    async actualizarProducto(uuid: string, datos: ProductoInput): Promise<ProductoPublico> {
      const resultado = await deps.actualizarProducto(uuid, datos);
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Producto no encontrado', 404);
      }
      await limpiarImagenes(resultado.imagenesAnteriores, [datos.imageUrl]);
      return aProductoPublico(resultado.registro);
    },

    async eliminarProducto(uuid: string): Promise<void> {
      const resultado = await deps.eliminarProducto(uuid);
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Producto no encontrado', 404);
      }
      if (resultado.tipo === 'en-uso') {
        throw new AppError(
          'Este producto ya tiene pedidos o carritos asociados. Desactivalo en lugar de eliminarlo',
          409
        );
      }
      await limpiarImagenes(resultado.imagenes, []);
    },

    listarCursos: (consulta: ListadoQuery) => listar(deps.listarCursos, aCursoPublico, consulta),

    async obtenerCurso(uuid: string): Promise<CursoPublico> {
      const curso = await deps.obtenerCurso(uuid);
      if (!curso) throw new AppError('Curso no encontrado', 404);
      return aCursoPublico(curso);
    },

    async crearCurso(datos: CursoInput, ownerId: number): Promise<CursoPublico> {
      exigirPropietario(ownerId, 'curso');
      const curso = await deps.crearCurso({ ...datos, ownerId });
      return aCursoPublico(curso);
    },

    async actualizarCurso(uuid: string, datos: CursoInput): Promise<CursoPublico> {
      const resultado = await deps.actualizarCurso(uuid, datos);
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Curso no encontrado', 404);
      }
      await limpiarImagenes(resultado.imagenesAnteriores, [datos.thumbnailUrl]);
      return aCursoPublico(resultado.registro);
    },

    async eliminarCurso(uuid: string): Promise<void> {
      const resultado = await deps.eliminarCurso(uuid);
      if (resultado.tipo === 'no-encontrado') {
        throw new AppError('Curso no encontrado', 404);
      }
      if (resultado.tipo === 'en-uso') {
        throw new AppError(
          'Este curso ya tiene matriculas, pedidos o certificados. Desactivalo en lugar de eliminarlo',
          409
        );
      }
      await limpiarImagenes(resultado.imagenes, []);
    },
  };
};

export const catalogService = crearServicioCatalogo(dependenciasReales);
