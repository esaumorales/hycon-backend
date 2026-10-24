import { describe, expect, it } from 'vitest';
import { aCursoPublico, aPaginacion } from './catalog.mapper';
import type { CursoBase } from './catalog.types';

const curso = (cambios: Partial<CursoBase> = {}): CursoBase => ({
  courseId: 3,
  uuid: 'b7b299d8-ee8f-4bea-a618-0a5f8261136f',
  previewSeconds: 60,
  ownerId: 1,
  name: 'Ergonomía en oficinas',
  description: null,
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: null,
  durationMinutes: 150,
  price: '219.00',
  discountPrice: null,
  status: 'active',
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
  ...cambios,
});

describe('aCursoPublico', () => {
  it('deja el video listo para incrustar y los precios como numeros', () => {
    const publico = aCursoPublico(curso({ discountPrice: '199.90' }));

    expect(publico).toMatchObject({
      youtubeId: 'dQw4w9WgXcQ',
      price: 219,
      discountPrice: 199.9,
    });
  });

  // El correlativo de la base no sale nunca: por la API solo viaja el uuid
  it('no expone el identificador interno', () => {
    const publico = aCursoPublico(curso());

    expect(publico).not.toHaveProperty('courseId');
    expect(publico).not.toHaveProperty('ownerId');
  });

  it('cuenta las partes del temario', () => {
    expect(aCursoPublico(curso({ _count: { lessons: 4 } })).partes).toBe(4);
  });

  it('un curso sin partes informa cero, no undefined', () => {
    expect(aCursoPublico(curso()).partes).toBe(0);
  });
});

describe('aPaginacion', () => {
  it('calcula las paginas que hacen falta', () => {
    expect(aPaginacion(2, 6, 25)).toEqual({
      pagina: 2,
      porPagina: 6,
      total: 25,
      totalPaginas: 5,
    });
  });

  // Sin resultados se informa una pagina, para no mostrar "pagina 1 de 0"
  it('sin resultados sigue habiendo una pagina', () => {
    expect(aPaginacion(1, 6, 0).totalPaginas).toBe(1);
  });
});
