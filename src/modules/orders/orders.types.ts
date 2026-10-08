import type { DecimalCompatible } from '../catalog/catalog.types';

// Lo minimo del catalogo que hace falta para cobrar: el precio sale de aqui,
// nunca de lo que mande el navegador
export interface ArticuloCobrable {
  uuid: string;
  id: number;
  nombre: string;
  precio: number;
  precioOferta: number | null;
  status: string;
  // null en los cursos: no tienen unidades
  stock: number | null;
}

export interface LineaNueva {
  tipo: 'producto' | 'curso';
  productId: number | null;
  courseId: number | null;
  cantidad: number;
  precio: number;
}

export interface PedidoNuevo {
  userId: number;
  metodoPago: string;
  estadoPago: string;
  subtotal: number;
  descuento: number;
  total: number;
  lineas: LineaNueva[];
}

export interface LineaBase {
  itemType: string;
  quantity: number;
  price: DecimalCompatible;
  product: { name: string } | null;
  course: { name: string } | null;
}

export interface PedidoBase {
  uuid: string;
  subtotal: DecimalCompatible;
  discount: DecimalCompatible;
  total: DecimalCompatible;
  paymentStatus: string;
  createdAt: Date;
  items: LineaBase[];
  payments: Array<{ provider: string }>;
}

// Forma que se expone por la API
export interface LineaPublica {
  tipo: string;
  nombre: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface PedidoPublico {
  uuid: string;
  // Codigo corto para que el cliente lo mencione al escribirnos
  codigo: string;
  estadoPago: string;
  metodoPago: string;
  subtotal: number;
  descuento: number;
  total: number;
  createdAt: string;
  items: LineaPublica[];
}
