import { z } from 'zod';

// Reglas compartidas. Los precios llegan como texto desde el formulario,
// por eso se usa coerce antes de validar el rango.
// Un input vacio del formulario debe llegar a la base como NULL, no como cadena vacia
const vacioComoIndefinido = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

const precio = z.coerce
  .number({ message: 'El precio debe ser un numero' })
  .positive('El precio debe ser mayor que cero')
  .max(999999.99, 'El precio supera el maximo permitido');

const precioOpcional = z.preprocess(
  (valor) => vacioComoIndefinido(valor),
  z.coerce
    .number({ message: 'El precio debe ser un numero' })
    .positive('El precio debe ser mayor que cero')
    .max(999999.99, 'El precio supera el maximo permitido')
    .optional()
);

const estado = z.enum(['active', 'inactive']).default('active');

const urlOpcional = z.preprocess(
  vacioComoIndefinido,
  z
    .string()
    .trim()
    .max(500, 'La URL es demasiado larga')
    .url('Debe ser una URL valida')
    .optional()
);

const textoOpcional = (maximo: number) =>
  z.preprocess(
    vacioComoIndefinido,
    z.string().trim().max(maximo, `No puede superar los ${maximo} caracteres`).optional()
  );

// El descuento solo tiene sentido si es menor que el precio de lista
const descuentoCoherente = <T extends { price: number; discountPrice?: number }>(datos: T) =>
  datos.discountPrice === undefined || datos.discountPrice < datos.price;

const MENSAJE_DESCUENTO = {
  message: 'El precio con descuento debe ser menor que el precio',
  path: ['discountPrice'],
};

export const crearProductoSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(200, 'El nombre es demasiado largo'),
    description: textoOpcional(2000),
    brand: textoOpcional(100),
    model: textoOpcional(100),
    price: precio,
    discountPrice: precioOpcional,
    stock: z.preprocess(
      vacioComoIndefinido,
      z.coerce
        .number({ message: 'El stock debe ser un numero' })
        .int('El stock debe ser un numero entero')
        .min(0, 'El stock no puede ser negativo')
        .default(0)
    ),
    status: estado,
    // Si viene, se guarda como imagen principal del producto
    imageUrl: urlOpcional,
  })
  .refine(descuentoCoherente, MENSAJE_DESCUENTO);

export const crearCursoSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(200, 'El nombre es demasiado largo'),
    description: textoOpcional(2000),
    videoUrl: urlOpcional,
    thumbnailUrl: urlOpcional,
    durationMinutes: z.preprocess(
      vacioComoIndefinido,
      z.coerce
        .number({ message: 'La duracion debe ser un numero' })
        .int('La duracion debe ser un numero entero')
        .min(1, 'La duracion debe ser de al menos 1 minuto')
        .max(100000, 'La duracion supera el maximo permitido')
        .optional()
    ),
    price: precio,
    discountPrice: precioOpcional,
    status: estado,
  })
  .refine(descuentoCoherente, MENSAJE_DESCUENTO);

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type CrearCursoInput = z.infer<typeof crearCursoSchema>;

// Filtro de visibilidad de los listados. Por defecto solo se publican los activos:
// el catalogo publico no debe mostrar lo que esta dado de baja.
export const listadoQuerySchema = z.object({
  estado: z.enum(['active', 'inactive', 'todos']).default('active'),
});

export type ListadoQuery = z.infer<typeof listadoQuerySchema>;
