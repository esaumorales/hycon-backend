import type {
  CursoBase,
  CursoPublico,
  DecimalCompatible,
  ProductoBase,
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
    price: aNumero(producto.price) as number,
    discountPrice: aNumero(producto.discountPrice),
    stock: producto.stock,
    status: producto.status,
    imageUrl: principal ? principal.imageUrl : null,
    createdAt: producto.createdAt.toISOString(),
  };
};

export const aCursoPublico = (curso: CursoBase): CursoPublico => ({
  courseId: curso.courseId,
  name: curso.name,
  description: curso.description,
  videoUrl: curso.videoUrl,
  thumbnailUrl: curso.thumbnailUrl,
  durationMinutes: curso.durationMinutes,
  price: aNumero(curso.price) as number,
  discountPrice: aNumero(curso.discountPrice),
  status: curso.status,
  createdAt: curso.createdAt.toISOString(),
});
