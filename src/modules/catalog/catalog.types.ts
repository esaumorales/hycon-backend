// Los campos Decimal de Prisma llegan como objeto; el mapper los pasa a number
export interface DecimalCompatible {
  toString(): string;
}

export interface ProductoBase {
  productId: number;
  ownerId: number;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  price: DecimalCompatible;
  discountPrice: DecimalCompatible | null;
  stock: number;
  status: string;
  createdAt: Date;
  images: Array<{ imageUrl: string; isThumbnail: boolean }>;
}

export interface CursoBase {
  courseId: number;
  ownerId: number;
  name: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  price: DecimalCompatible;
  discountPrice: DecimalCompatible | null;
  status: string;
  createdAt: Date;
}

// Forma que se expone por la API: precios ya convertidos a number
export interface ProductoPublico {
  productId: number;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  status: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface CursoPublico {
  courseId: number;
  name: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  price: number;
  discountPrice: number | null;
  status: string;
  createdAt: string;
}
