import { describe, expect, it } from 'vitest';
import { publicacionSchema } from './posts.schema';

const base = {
  title: 'Pausas activas en la oficina',
  content: 'Levantarse cada hora reduce la tension en cuello y espalda.',
};

describe('publicacionSchema', () => {
  it('acepta lo minimo y publica por defecto', () => {
    const resultado = publicacionSchema.parse(base);
    expect(resultado.status).toBe('active');
    expect(resultado.publishedAt).toBeUndefined();
  });

  it('exige titulo y contenido con un largo razonable', () => {
    expect(publicacionSchema.safeParse({ ...base, title: 'Ok' }).success).toBe(false);
    expect(publicacionSchema.safeParse({ ...base, content: 'muy corto' }).success).toBe(false);
    expect(publicacionSchema.safeParse({ content: base.content }).success).toBe(false);
  });

  it('guarda el contenido limpio de scripts pero con su formato', () => {
    const resultado = publicacionSchema.parse({
      ...base,
      content: '<p>Texto con <strong>negrita</strong> suficiente</p><script>alert(1)</script>',
    });
    expect(resultado.content).toBe('<p>Texto con <strong>negrita</strong> suficiente</p>');
  });

  it('mide el minimo sobre el texto visible, no sobre las etiquetas', () => {
    const soloEtiquetas = '<p></p><p><strong></strong></p><ul><li><p></p></li></ul>';
    expect(publicacionSchema.safeParse({ ...base, content: soloEtiquetas }).success).toBe(false);
    // Un script largo no cuenta como contenido
    expect(
      publicacionSchema.safeParse({ ...base, content: `<script>${'x'.repeat(50)}</script>` }).success
    ).toBe(false);
  });

  it('trata resumen y portada vacios como ausentes', () => {
    const resultado = publicacionSchema.parse({ ...base, excerpt: '  ', coverUrl: '' });
    expect(resultado.excerpt).toBeUndefined();
    expect(resultado.coverUrl).toBeUndefined();
  });

  it('limita el resumen a 300 caracteres', () => {
    expect(publicacionSchema.safeParse({ ...base, excerpt: 'a'.repeat(301) }).success).toBe(false);
    expect(publicacionSchema.safeParse({ ...base, excerpt: 'a'.repeat(300) }).success).toBe(true);
  });

  it('rechaza una portada que no es URL', () => {
    expect(publicacionSchema.safeParse({ ...base, coverUrl: 'portada.png' }).success).toBe(false);
  });

  it('guarda una fecha sola a mediodia UTC para no cambiar de dia en Peru', () => {
    const resultado = publicacionSchema.parse({ ...base, publishedAt: '2026-03-01' });
    expect(resultado.publishedAt?.toISOString()).toBe('2026-03-01T12:00:00.000Z');
  });

  it('rechaza fechas invalidas', () => {
    expect(publicacionSchema.safeParse({ ...base, publishedAt: '2026-13-45' }).success).toBe(false);
    expect(publicacionSchema.safeParse({ ...base, publishedAt: 'ayer' }).success).toBe(false);
  });

  it('solo admite los estados conocidos', () => {
    expect(publicacionSchema.safeParse({ ...base, status: 'borrador' }).success).toBe(false);
    expect(publicacionSchema.parse({ ...base, status: 'inactive' }).status).toBe('inactive');
  });
});
