import { describe, expect, it } from 'vitest';
import { leccionSchema, ordenLeccionesSchema } from './lecciones.schema';

const base = { title: 'Qué es la ergonomía' };

const validar = (datos: Record<string, unknown>) => leccionSchema.safeParse({ ...base, ...datos });

describe('video de una leccion', () => {
  it('acepta un enlace de YouTube', () => {
    expect(validar({ videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }).success).toBe(true);
    expect(validar({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }).success).toBe(true);
  });

  it('acepta una referencia a un video ya subido', () => {
    expect(validar({ videoUrl: 'r2:cursos/01a0/parte-1.mp4' }).success).toBe(true);
    expect(validar({ videoUrl: 'stream:ea95132c15732412d22c1476fa83f27a' }).success).toBe(true);
  });

  // Lo que se guarda acaba dentro de una URL firmada o de un iframe: nada mas entra
  it('rechaza cualquier otra cosa', () => {
    expect(validar({ videoUrl: 'https://vimeo.com/12345' }).success).toBe(false);
    expect(validar({ videoUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(validar({ videoUrl: 'data:text/html;base64,PHNjcmlwdD4=' }).success).toBe(false);
    expect(validar({ videoUrl: 'cualquier texto' }).success).toBe(false);
  });

  it('rechaza una referencia con saltos de carpeta', () => {
    expect(validar({ videoUrl: 'r2:../otro-bucket/privado.mp4' }).success).toBe(false);
    expect(validar({ videoUrl: 'r2:cursos/../../secreto.mp4' }).success).toBe(false);
  });

  it('sin video la leccion sigue siendo valida', () => {
    const resultado = validar({ videoUrl: '' });

    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data.videoUrl).toBeUndefined();
  });
});

describe('datos de la leccion', () => {
  it('exige un titulo con sentido', () => {
    expect(leccionSchema.safeParse({ title: 'A' }).success).toBe(false);
    expect(leccionSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false);
    expect(leccionSchema.safeParse({ title: 'Introducción' }).success).toBe(true);
  });

  it('la duracion es un numero entero de minutos', () => {
    expect(validar({ durationMinutes: 0 }).success).toBe(false);
    expect(validar({ durationMinutes: 8.5 }).success).toBe(false);
    expect(validar({ durationMinutes: 2000 }).success).toBe(false);
    expect(validar({ durationMinutes: 8 }).success).toBe(true);
  });

  it('una leccion nace sin ser la muestra gratis', () => {
    const resultado = leccionSchema.safeParse(base);

    expect(resultado.success && resultado.data.esMuestra).toBe(false);
  });
});

describe('orden del temario', () => {
  it('pide uuids y al menos uno', () => {
    expect(ordenLeccionesSchema.safeParse({ orden: [] }).success).toBe(false);
    expect(ordenLeccionesSchema.safeParse({ orden: ['3'] }).success).toBe(false);
    expect(
      ordenLeccionesSchema.safeParse({ orden: ['01a0fef2-19c0-70bf-a4e4-2e1a85443aef'] }).success
    ).toBe(true);
  });
});
