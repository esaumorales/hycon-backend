import { z } from 'zod';

export const buscarSchema = z.preprocess(
  (v) => typeof v === 'string' && !v.trim() ? undefined : v,
  z.string().trim().max(120, 'La búsqueda admite hasta 120 caracteres').optional()
);
export const numeroFiltro = (maximo: number, entero = false) => z.preprocess(
  (v) => v === '' ? undefined : v,
  (entero ? z.coerce.number().int() : z.coerce.number()).min(0).max(maximo).optional()
);
export const fechaFiltro = z.preprocess(
  (v) => v === '' ? undefined : v,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
    const fecha = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === v;
  }, 'La fecha no es válida').optional()
);
