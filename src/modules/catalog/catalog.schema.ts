import { z } from 'zod';
import { esEnlaceYoutube } from '../../core/utils/youtube';
import { CODIGOS_AGENCIA, POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO } from './catalog.constants';

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

// El video se reproduce dentro de la web con el reproductor de YouTube,
// asi que solo se aceptan links de YouTube
const urlYoutubeOpcional = z.preprocess(
  vacioComoIndefinido,
  z
    .string()
    .trim()
    .max(500, 'La URL es demasiado larga')
    .refine(esEnlaceYoutube, 'Debe ser un link de YouTube valido')
    .optional()
);

const textoOpcional = (maximo: number) =>
  z.preprocess(
    vacioComoIndefinido,
    z.string().trim().max(maximo, `No puede superar los ${maximo} caracteres`).optional()
  );

// Se aceptan solo agencias conocidas y se eliminan los repetidos
const agenciasEnvio = z
  .array(z.enum(CODIGOS_AGENCIA, { message: 'Agencia de envio no reconocida' }))
  .default([])
  .transform((codigos) => [...new Set(codigos)]);

// El descuento solo tiene sentido si es menor que el precio de lista
const descuentoCoherente = <T extends { price: number; discountPrice?: number }>(datos: T) =>
  datos.discountPrice === undefined || datos.discountPrice < datos.price;

const MENSAJE_DESCUENTO = {
  message: 'El precio con descuento debe ser menor que el precio',
  path: ['discountPrice'],
};

const nombre = z
  .string({ message: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(200, 'El nombre es demasiado largo');

// Crear y editar comparten esquema: el formulario siempre envia el registro completo
export const productoSchema = z
  .object({
    name: nombre,
    description: textoOpcional(2000),
    brand: textoOpcional(100),
    model: textoOpcional(100),
    color: textoOpcional(50),
    price: precio,
    discountPrice: precioOpcional,
    stock: z.preprocess(
      vacioComoIndefinido,
      z.coerce
        .number({ message: 'La cantidad debe ser un numero' })
        .int('La cantidad debe ser un numero entero')
        .min(0, 'La cantidad no puede ser negativa')
        .default(0)
    ),
    shippingAgencies: agenciasEnvio,
    status: estado,
    // Si viene, se guarda como imagen principal del producto
    imageUrl: urlOpcional,
  })
  .refine(descuentoCoherente, MENSAJE_DESCUENTO);

export const cursoSchema = z
  .object({
    name: nombre,
    description: textoOpcional(2000),
    videoUrl: urlYoutubeOpcional,
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

export type ProductoInput = z.infer<typeof productoSchema>;
export type CursoInput = z.infer<typeof cursoSchema>;

// Filtros del listado. Cada parametro invalido cae a su valor por defecto por separado,
// asi un ?pagina=abc no invalida tambien el estado.
// Por defecto solo se publican los activos: el catalogo publico no muestra lo dado de baja.
export const listadoQuerySchema = z.object({
  estado: z.enum(['active', 'inactive', 'todos']).catch('active'),
  pagina: z.coerce.number().int().min(1).catch(1),
  porPagina: z.coerce.number().int().min(1).max(POR_PAGINA_MAXIMO).catch(POR_PAGINA_DEFECTO),
});

export type ListadoQuery = z.infer<typeof listadoQuerySchema>;

export const idSchema = z.coerce.number().int().positive();
