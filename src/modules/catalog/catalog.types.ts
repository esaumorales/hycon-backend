// Los campos Decimal de Prisma llegan como objeto; el mapper los pasa a number
export interface DecimalCompatible {
  toString(): string;
}

export interface ProductoBase {
  productId: number;
  uuid: string;
  ownerId: number;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  price: DecimalCompatible;
  discountPrice: DecimalCompatible | null;
  stock: number;
  shippingAgencies: string[];
  status: string;
  createdAt: Date;
  images: Array<{ imageUrl: string; isThumbnail: boolean }>;
}

export interface CursoBase {
  courseId: number;
  uuid: string;
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

export interface AgenciaEnvio {
  code: string;
  name: string;
}

// Forma que se expone por la API: precios ya convertidos a number y el uuid
// como unico identificador (el correlativo no sale de la base)
export interface ProductoPublico {
  uuid: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  price: number;
  discountPrice: number | null;
  stock: number;
  shippingAgencies: AgenciaEnvio[];
  status: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface CursoPublico {
  uuid: string;
  name: string;
  description: string | null;
  videoUrl: string | null;
  youtubeId: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  price: number;
  discountPrice: number | null;
  status: string;
  createdAt: string;
}

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface PaginaDe<T> {
  filas: T[];
  total: number;
}

// Resultado de borrar: la base se niega si el registro ya tiene pedidos o matriculas
export type ResultadoEliminar =
  | { tipo: 'eliminado'; imagenes: string[] }
  | { tipo: 'no-encontrado' }
  | { tipo: 'en-uso' };

// Resultado de editar: se devuelven las imagenes previas para limpiarlas del disco
export type ResultadoActualizar<T> =
  | { tipo: 'actualizado'; registro: T; imagenesAnteriores: string[] }
  | { tipo: 'no-encontrado' };
