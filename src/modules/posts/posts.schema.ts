import { z } from 'zod';
import { sanitizarContenido, textoPlano } from './posts.contenido';

const vacioComoIndefinido = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

// Una fecha sola (YYYY-MM-DD) se guarda a mediodia UTC: asi no cambia de dia
// al mostrarse en la hora de Peru (UTC-5)
const fechaAMediodia = (valor: unknown) =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())
    ? `${valor.trim()}T12:00:00.000Z`
    : valor;

export const MAXIMO_RESUMEN = 300;
export const MAXIMO_CONTENIDO = 50000;

// Crear y editar comparten esquema: el formulario envia el articulo completo
export const publicacionSchema = z.object({
  title: z
    .string({ message: 'El titulo es obligatorio' })
    .trim()
    .min(3, 'El titulo debe tener al menos 3 caracteres')
    .max(200, 'El titulo es demasiado largo'),
  excerpt: z.preprocess(
    vacioComoIndefinido,
    z.string().trim().max(MAXIMO_RESUMEN, `El resumen no puede superar los ${MAXIMO_RESUMEN} caracteres`).optional()
  ),
  // HTML del editor: se limpia antes de validar y lo que se guarda es la version limpia.
  // El minimo se mide sobre el texto visible, no sobre las etiquetas.
  content: z
    .string({ message: 'El contenido es obligatorio' })
    .max(MAXIMO_CONTENIDO, 'El contenido es demasiado largo')
    .transform(sanitizarContenido)
    .refine((html) => textoPlano(html).length >= 20, 'El contenido debe tener al menos 20 caracteres'),
  coverUrl: z.preprocess(
    vacioComoIndefinido,
    z.string().trim().max(500, 'La URL es demasiado larga').url('Debe ser una URL valida').optional()
  ),
  status: z.enum(['active', 'inactive']).default('active'),
  // Si no llega: al crear se usa la fecha actual; al editar se conserva la que habia
  publishedAt: z.preprocess(
    (valor) => fechaAMediodia(vacioComoIndefinido(valor)),
    z.coerce.date({ message: 'La fecha de publicacion no es valida' }).optional()
  ),
});

export type PublicacionInput = z.infer<typeof publicacionSchema>;
