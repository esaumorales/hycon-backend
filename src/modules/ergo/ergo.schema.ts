import { z } from 'zod';

export const empresaSchema = z.object({
  nombre: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres').max(150),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

export const fichaSchema = z.object({
  nombre: z.string().min(2).max(200),
  description: z.string().optional(),
  payload: z.record(z.string(), z.any()),
});

export type FichaInput = z.infer<typeof fichaSchema>;
