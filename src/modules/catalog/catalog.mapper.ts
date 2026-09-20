import { extraerIdYoutube } from '../../core/utils/youtube';
import { resolverAgencias } from './catalog.constants';
import type {
  CursoBase,
  CursoPublico,
  DecimalCompatible,
  Paginacion,
  ProductoBase,
  ProductoDetallePublico,
  ProductoPublico,
} from './catalog.types';

// Prisma devuelve Decimal; el cliente necesita un number plano
const aNumero = (valor: DecimalCompatible | null): number | null =>
  valor === null ? null : Number(valor.toString());

export const aProductoPublico = (producto: ProductoBase): ProductoPublico => {
  const principal =
    producto.images.find((imagen) => imagen.isThumbnail) ?? producto.images[0] ?? null;

  return {
    productId: producto.productId,
    name: producto.name,
    description: producto.description,
    brand: producto.brand,
    model: producto.model,
    color: producto.color,
    price: aNumero(producto.price) as number,
    discountPrice: aNumero(producto.discountPrice),
    stock: producto.stock,
    shippingAgencies: resolverAgencias(producto.shippingAgencies ?? []),
    status: producto.status,
    imageUrl: principal ? principal.imageUrl : null,
    createdAt: producto.createdAt.toISOString(),
  };
};

export const aProductoDetallePublico = (producto: ProductoBase): ProductoDetallePublico => {
  const publico = aProductoPublico(producto);
  return {
    ...publico,
    imageUrls: publico.imageUrl
      ? [publico.imageUrl, ...producto.images.filter((imagen) => imagen.imageUrl !== publico.imageUrl).map((imagen) => imagen.imageUrl)]
      : [],
  };
};

export const aCursoPublico = (curso: CursoBase): CursoPublico => ({
  courseId: curso.courseId,
  name: curso.name,
  description: curso.description,
  videoUrl: curso.videoUrl,
  // Listo para incrustar; null si no hay video o el link no es de YouTube
  youtubeId: extraerIdYoutube(curso.videoUrl),
  thumbnailUrl: curso.thumbnailUrl,
  durationMinutes: curso.durationMinutes,
  price: aNumero(curso.price) as number,
  discountPrice: aNumero(curso.discountPrice),
  status: curso.status,
  createdAt: curso.createdAt.toISOString(),
});

export const aPaginacion = (pagina: number, porPagina: number, total: number): Paginacion => ({
  pagina,
  porPagina,
  total,
  // Aunque no haya filas se informa una pagina, para que el paginador no muestre "de 0"
  totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
});
