import { z } from 'zod';
import { esVideoValido } from '../media/referencias';

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor));

export const leccionSchema = z.object({
  title: z.string().trim().min(2, 'El titulo debe tener al menos 2 caracteres').max(200),
  description: textoOpcional(2000),
  // Vale un enlace de YouTube o la referencia de un video ya subido a nuestro almacen
  videoUrl: textoOpcional(500).refine((valor) => !valor || esVideoValido(valor), {
    message: 'El video debe ser un link de YouTube o un archivo subido',
  }),
  durationMinutes: z.number().int().min(1).max(1000).optional(),
  // La leccion de muestra es la unica que ve quien aun no compro el curso
  esMuestra: z.boolean().default(false),
});

// Reordenar: se envia la lista de uuids en el orden deseado
export const ordenLeccionesSchema = z.object({
  orden: z.array(z.string().uuid()).min(1, 'Envia al menos una leccion').max(200),
});

export type LeccionInput = z.infer<typeof leccionSchema>;
export type OrdenLeccionesInput = z.infer<typeof ordenLeccionesSchema>;
