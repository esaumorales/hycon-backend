import { z } from 'zod';

// Reglas compartidas por registro e inicio de sesion
const email = z
  .string()
  .trim()
  .min(1, 'El correo es obligatorio')
  .max(150, 'El correo es demasiado largo')
  .email('El correo no tiene un formato valido')
  .toLowerCase();

const password = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(72, 'La contrasena no puede superar los 72 caracteres')
  .regex(/[A-Za-z]/, 'La contrasena debe incluir al menos una letra')
  .regex(/[0-9]/, 'La contrasena debe incluir al menos un numero');

export const registroSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  lastname: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres').max(100),
  email,
  password,
  phone: z.string().trim().max(30).optional(),
});

export const loginSchema = z.object({
  email,
  // En login no se aplican las reglas de fortaleza: la credencial simplemente coincide o no
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
