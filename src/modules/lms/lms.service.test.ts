import { describe, expect, it, vi } from 'vitest';
import { crearServicioLms, type CursoCompradoBase, type DependenciasLms } from './lms.service';
import type { MisCursosQuery } from './lms.schema';

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

const consulta = (cambios: Partial<MisCursosQuery> = {}): MisCursosQuery => ({
  buscar: undefined,
  orden: 'recientes',
  pagina: 1,
  porPagina: 6,
  ...cambios,
});

const listar = (cursos: CursoCompradoBase[], cambios: Partial<MisCursosQuery> = {}) =>
  crearServicioLms(crearDeps(cursos)).misCursos(7, consulta(cambios));

describe('misCursos', () => {
  it('pide solo los cursos del usuario de la sesion', async () => {
    const deps = crearDeps([]);

    await crearServicioLms(deps).misCursos(7, consulta());

    expect(deps.cursosComprados).toHaveBeenCalledWith(7);
  });

  it('devuelve el curso listo para mostrarlo, con el id del video y la fecha de compra', async () => {
    const { elementos } = await listar([base()]);

    expect(elementos[0]).toMatchObject({
      name: 'Logistica de ultima milla',
      youtubeId: 'dQw4w9WgXcQ',
      durationMinutes: 150,
      compradoEl: '2026-10-07T12:00:00.000Z',
    });
  });

  it('un curso sin video no trae id que incrustar', async () => {
    const { elementos } = await listar([base({ videoUrl: null })]);

    expect(elementos[0].youtubeId).toBeNull();
  });

  it('sin compras devuelve una lista vacia y una sola pagina', async () => {
    const { elementos, paginacion } = await listar([]);

    expect(elementos).toEqual([]);
    expect(paginacion).toMatchObject({ pagina: 1, total: 0, totalPaginas: 1 });
  });
});

describe('busqueda dentro de mis cursos', () => {
  const cursos = [
    base({ uuid: 'a', name: 'Logistica de ultima milla' }),
    base({ uuid: 'b', name: 'Ergonomía en oficinas', description: 'Pausas activas' }),
    base({ uuid: 'c', name: 'Manejo de cargas', description: null }),
  ];

  it('busca en el nombre sin distinguir mayusculas ni acentos', async () => {
    const { elementos } = await listar(cursos, { buscar: 'ERGONOMIA' });

    expect(elementos).toHaveLength(1);
    expect(elementos[0].name).toBe('Ergonomía en oficinas');
  });

  it('tambien busca en la descripcion', async () => {
    const { elementos } = await listar(cursos, { buscar: 'pausas' });

    expect(elementos.map((curso) => curso.name)).toEqual(['Ergonomía en oficinas']);
  });

  it('si no hay coincidencias el total queda en cero', async () => {
    const { elementos, paginacion } = await listar(cursos, { buscar: 'soldadura' });

    expect(elementos).toEqual([]);
    expect(paginacion.total).toBe(0);
  });
});

describe('orden de mis cursos', () => {
  const cursos = [
    base({
      uuid: 'a',
      name: 'Zapatos de seguridad',
      compradoEl: new Date('2026-01-01T00:00:00.000Z'),
    }),
    base({ uuid: 'b', name: 'Ergonomía', compradoEl: new Date('2026-06-01T00:00:00.000Z') }),
    base({
      uuid: 'c',
      name: 'Manejo de cargas',
      compradoEl: new Date('2026-03-01T00:00:00.000Z'),
    }),
  ];

  it('por defecto manda la compra mas reciente', async () => {
    const { elementos } = await listar(cursos);

    expect(elementos.map((curso) => curso.uuid)).toEqual(['b', 'c', 'a']);
  });

  it('se puede ver primero lo mas antiguo', async () => {
    const { elementos } = await listar(cursos, { orden: 'antiguos' });

    expect(elementos.map((curso) => curso.uuid)).toEqual(['a', 'c', 'b']);
  });

  it('o por nombre, respetando los acentos del español', async () => {
    const { elementos } = await listar(cursos, { orden: 'nombre' });

    expect(elementos.map((curso) => curso.name)).toEqual([
      'Ergonomía',
      'Manejo de cargas',
      'Zapatos de seguridad',
    ]);
  });
});

describe('paginacion de mis cursos', () => {
  const cursos = Array.from({ length: 7 }, (_, indice) =>
    base({
      uuid: `curso-${indice}`,
      name: `Curso ${indice}`,
      compradoEl: new Date(2026, 0, indice + 1),
    })
  );

  it('corta la primera pagina y cuenta el total', async () => {
    const { elementos, paginacion } = await listar(cursos, { porPagina: 3 });

    expect(elementos).toHaveLength(3);
    expect(paginacion).toMatchObject({ pagina: 1, porPagina: 3, total: 7, totalPaginas: 3 });
  });

  it('la ultima pagina trae lo que queda', async () => {
    const { elementos } = await listar(cursos, { porPagina: 3, pagina: 3 });

    expect(elementos).toHaveLength(1);
  });

  it('una pagina mas alla del final viene vacia, sin romperse', async () => {
    const { elementos, paginacion } = await listar(cursos, { porPagina: 3, pagina: 9 });

    expect(elementos).toEqual([]);
    expect(paginacion.totalPaginas).toBe(3);
  });

  // El total es el de lo filtrado, no el de todo lo comprado
  it('el total respeta la busqueda', async () => {
    const { paginacion } = await listar(cursos, { buscar: 'Curso 1', porPagina: 3 });

    expect(paginacion.total).toBe(1);
  });
});
