import { describe, expect, it } from 'vitest';
import { loginSchema, registroSchema } from './auth.schema';

describe('registroSchema', () => {
  const base = {
    name: 'Ana',
    lastname: 'Quispe',
    email: 'Ana@Hycon.com',
    password: 'Cliente2026',
  };

  it('normaliza el correo a minusculas y recorta espacios', () => {
    const resultado = registroSchema.parse({ ...base, email: '  Ana@Hycon.com  ' });
    expect(resultado.email).toBe('ana@hycon.com');
  });

  it('rechaza correos con formato invalido', () => {
    expect(registroSchema.safeParse({ ...base, email: 'ana-arroba-hycon' }).success).toBe(false);
  });

  it('exige al menos 8 caracteres en la contrasena', () => {
    expect(registroSchema.safeParse({ ...base, password: 'Abc123' }).success).toBe(false);
  });

  it('exige que la contrasena mezcle letras y numeros', () => {
    expect(registroSchema.safeParse({ ...base, password: 'solotexto' }).success).toBe(false);
    expect(registroSchema.safeParse({ ...base, password: '123456789' }).success).toBe(false);
    expect(registroSchema.safeParse({ ...base, password: 'Cliente2026' }).success).toBe(true);
  });

  it('rechaza nombres de un solo caracter', () => {
    expect(registroSchema.safeParse({ ...base, name: 'A' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('acepta cualquier contrasena no vacia', () => {
    // El login no valida fortaleza: solo comprueba que la credencial venga completa
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rechaza contrasena vacia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
