import { describe, expect, it } from 'vitest';
import { loginSchema, registroSchema } from './auth.schema';

describe('registroSchema', () => {
  const base = {
    name: 'Ana',
    lastname: 'Quispe',
    email: 'Ana@Hycon.com',
    password: 'cafe con leche y pan',
  };

  it('normaliza el correo a minusculas y recorta espacios', () => {
    const resultado = registroSchema.parse({ ...base, email: '  Ana@Hycon.com  ' });
    expect(resultado.email).toBe('ana@hycon.com');
  });

  it('rechaza correos con formato invalido', () => {
    expect(registroSchema.safeParse({ ...base, email: 'ana-arroba-hycon' }).success).toBe(false);
  });

  it('aplica la politica de contrasenas indicando el campo', () => {
    const corta = registroSchema.safeParse({ ...base, password: 'Cliente2026' });
    expect(corta.success).toBe(false);
    expect(corta.error?.issues[0]).toMatchObject({ path: ['password'] });

    expect(registroSchema.safeParse({ ...base, password: 'contrasena123' }).success).toBe(false);
  });

  it('rechaza una contrasena con el apellido de quien se registra', () => {
    expect(registroSchema.safeParse({ ...base, password: 'quispe-quispe-99' }).success).toBe(false);
  });

  it('recordar es falso si no se indica', () => {
    expect(registroSchema.parse(base).recordar).toBe(false);
  });

  it('rechaza nombres de un solo caracter', () => {
    expect(registroSchema.safeParse({ ...base, name: 'A' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('no aplica la politica: las cuentas antiguas pueden seguir entrando', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123456' }).success).toBe(true);
  });

  it('exige correo y contrasena', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
  });

  it('acota el tamano de la contrasena para no gastar CPU en bcrypt', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(5000) }).success).toBe(false);
  });

  it('acepta recordar como booleano y lo deja en falso por defecto', () => {
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x' }).recordar).toBe(false);
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x', recordar: true }).recordar).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x', recordar: 'si' }).success).toBe(false);
  });
});
