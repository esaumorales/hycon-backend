import { z } from 'zod';

export const empresaSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe al menos 2 caracteres para el nombre.').max(150),
});
const numeroOpcional = (max = Number.MAX_SAFE_INTEGER) => z.string().refine(
  v => v === '' || (v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max),
  'Ingresa un número válido, mayor o igual a cero.',
);
const factor = z.looseObject({ aplica: z.boolean().nullable(), duracionDiaria: numeroOpcional(1440) });
const factores = z.record(z.string(), factor);
// Conserva campos históricos y admite resultados pendientes.
const payloadSchema = z.looseObject({
  paso1: z.looseObject({ area: z.string(), puesto: z.string(), resumenPuesto: z.string(), actividad: z.string(), superintendencia: z.string(), gerencia: z.string() }),
  paso2: z.looseObject({ duracionMinutos: numeroOpcional(1440), cotidiana: z.boolean().nullable(), duracionMayor120: z.boolean(), requiereIdentificacion: z.boolean() }),
  paso3: factores,
  paso4: factores,
  paso5: z.looseObject({ esfuerzoManos: factores, movimientosAltaFrecuencia: factores }),
  evaluacion: z.looseObject({
    movimientosRepetitivos: z.looseObject({ dx: numeroOpcional(), ix: numeroOpcional() }),
    posturaForzada: z.looseObject({ d: numeroOpcional(), i: numeroOpcional() }),
    levantamientoCargas: z.looseObject({ niosh: numeroOpcional() }),
  }),
  paso7Adicional: z.looseObject({ sector: z.enum(['', 'mineria', 'industria', 'construccion', 'agricultura']), numeroEvaluaciones: numeroOpcional().refine(v => v === '' || Number.isInteger(Number(v)), 'Ingresa un número entero.') }).optional(),
});
export const fichaSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre de la ficha necesita al menos 2 caracteres.').max(200),
  description: z.string().max(10000).optional(),
  payload: payloadSchema,
});
export const actualizarFichaSchema = fichaSchema.extend({ version: z.iso.datetime() });
export const idErgoSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).refine(Number.isSafeInteger);
export type FichaInput = z.infer<typeof fichaSchema>;
