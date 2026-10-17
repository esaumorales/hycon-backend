import { z } from 'zod';
import { evaluarPassword, LARGO_MAXIMO_PASSWORD } from './auth.politica';

const email = z
  .string({ message: 'El correo es obligatorio' })
  .trim()
  .min(1, 'El correo es obligatorio')
  .max(150, 'El correo es demasiado largo')
  .email('El correo no tiene un formato valido')
  .toLowerCase();

export const registroSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    lastname: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres').max(100),
    email,
    password: z.string({ message: 'La contrasena es obligatoria' }),
    phone: z.string().trim().max(30).optional(),
    recordar: z.boolean().default(false),
  })
  // La politica necesita el nombre y el correo para rechazar contrasenas que los contengan
  .superRefine((datos, contexto) => {
    const motivo = evaluarPassword(datos.password, datos);
    if (motivo) contexto.addIssue({ code: 'custom', path: ['password'], message: motivo });
  });

export const loginSchema = z.object({
  email,
  // En login no se aplica la politica: la credencial coincide o no. Solo se acota el
  // tamano para no gastar CPU de bcrypt con cuerpos enormes.
  password: z
    .string({ message: 'La contrasena es obligatoria' })
    .min(1, 'La contrasena es obligatoria')
    .max(LARGO_MAXIMO_PASSWORD, 'Correo o contrasena incorrectos'),
  // Sin marcar, la sesion termina al cerrar el navegador
  recordar: z.boolean().default(false),
});

// Datos que el usuario puede cambiar de su perfil. El correo no esta aqui:
// cambiarlo sin verificar el nuevo buzon permitiria secuestrar la cuenta.
export const perfilSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  lastname: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres').max(100),
  phone: z
    .string()
    .trim()
    .max(30, 'El telefono es demasiado largo')
    .regex(/^[\d+()\s-]*$/, 'El telefono solo admite numeros y los signos + ( ) -')
    .optional(),
});

export const cambioPasswordSchema = z
  .object({
    actual: z.string({ message: 'Escribe tu contrasena actual' }).min(1, 'Escribe tu contrasena actual'),
    nueva: z.string({ message: 'La contrasena es obligatoria' }),
  })
  .superRefine((datos, contexto) => {
    const motivo = evaluarPassword(datos.nueva);
    if (motivo) contexto.addIssue({ code: 'custom', path: ['nueva'], message: motivo });
    if (datos.actual === datos.nueva) {
      contexto.addIssue({
        code: 'custom',
        path: ['nueva'],
        message: 'La contrasena nueva debe ser distinta de la actual',
      });
    }
  });

// El navegador sube la foto a Cloudinary y aqui solo llega su URL
export const avatarSchema = z.object({
  avatarUrl: z
    .string({ message: 'Falta la direccion de la imagen' })
    .trim()
    .url('La direccion de la imagen no es valida')
    .max(500, 'La direccion es demasiado larga'),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PerfilInput = z.infer<typeof perfilSchema>;
export type CambioPasswordInput = z.infer<typeof cambioPasswordSchema>;
export type AvatarInput = z.infer<typeof avatarSchema>;
