import { describe, expect, it, vi } from 'vitest';
import { crearServicioLms, type CursoCompradoBase, type DependenciasLms } from './lms.service';

const base = (cambios: Partial<CursoCompradoBase> = {}): CursoCompradoBase => ({
  uuid: 'b7b299d8-ee8f-4bea-a618-0a5f8261136f',
  name: 'Logistica de ultima milla',
  description: 'Ruteo y tiempos de entrega',
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  thumbnailUrl: null,
  durationMinutes: 150,
  compradoEl: new Date('2026-10-07T12:00:00.000Z'),
  ...cambios,
});

const crearDeps = (cursos: CursoCompradoBase[]): DependenciasLms => ({
  cursosComprados: vi.fn().mockResolvedValue(cursos),
});

describe('misCursos', () => {
  it('pide solo los cursos del usuario de la sesion', async () => {
    const deps = crearDeps([]);

    await crearServicioLms(deps).misCursos(7);

    expect(deps.cursosComprados).toHaveBeenCalledWith(7);
  });

  it('devuelve el curso listo para mostrarlo, con el id del video y la fecha de compra', async () => {
    const [curso] = await crearServicioLms(crearDeps([base()])).misCursos(7);

    expect(curso).toMatchObject({
      name: 'Logistica de ultima milla',
      youtubeId: 'dQw4w9WgXcQ',
      durationMinutes: 150,
      compradoEl: '2026-10-07T12:00:00.000Z',
    });
  });

  it('un curso sin video no trae id que incrustar', async () => {
    const [curso] = await crearServicioLms(crearDeps([base({ videoUrl: null })])).misCursos(7);

    expect(curso.youtubeId).toBeNull();
  });

  it('sin compras devuelve una lista vacia', async () => {
    await expect(crearServicioLms(crearDeps([])).misCursos(7)).resolves.toEqual([]);
  });
});
