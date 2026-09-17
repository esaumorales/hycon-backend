import { describe, expect, it, vi } from 'vitest';
import { crearServicioPublicaciones, type DependenciasPublicaciones } from './posts.service';
import type { PublicacionBase } from './posts.types';
import type { PublicacionInput } from './posts.schema';

const guardada: PublicacionBase = {
  postId: 7,
  authorId: 1,
  title: 'Pausas activas en la oficina',
  slug: 'pausas-activas-en-la-oficina',
  excerpt: 'Cinco ejercicios rapidos',
  content: 'palabra '.repeat(450),
  coverUrl: 'http://localhost:4000/uploads/imagenes/vieja.png',
  status: 'active',
  views: 120,
  publishedAt: new Date('2026-03-01T12:00:00.000Z'),
  createdAt: new Date('2026-02-28T10:00:00.000Z'),
  author: { name: 'Esau', lastname: 'Morales' },
};

const datos: PublicacionInput = {
  title: 'Pausas activas en la oficina',
  content: 'Contenido suficientemente largo para validar.',
  status: 'active',
};

const crearDeps = (sobrescribir: Partial<DependenciasPublicaciones> = {}): DependenciasPublicaciones => ({
  listar: vi.fn().mockResolvedValue({ filas: [guardada], total: 13 }),
  obtener: vi.fn().mockResolvedValue(guardada),
  slugsParecidos: vi.fn().mockResolvedValue([]),
  crear: vi.fn().mockResolvedValue(guardada),
  actualizar: vi.fn().mockResolvedValue({ tipo: 'actualizado', registro: guardada, imagenesAnteriores: [] }),
  eliminar: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [] }),
  eliminarImagen: vi.fn().mockResolvedValue(true),
  ...sobrescribir,
});

describe('postsService.listar', () => {
  it('pagina y expone tiempo de lectura, lecturas y autor', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    const { elementos, paginacion } = await servicio.listar({ estado: 'todos', pagina: 2, porPagina: 6 });

    expect(deps.listar).toHaveBeenCalledWith({ estado: 'todos', saltar: 6, tomar: 6 });
    expect(paginacion).toEqual({ pagina: 2, porPagina: 6, total: 13, totalPaginas: 3 });
    expect(elementos[0]).toMatchObject({
      readingMinutes: 3,
      views: 120,
      authorName: 'Esau Morales',
      publishedAt: '2026-03-01T12:00:00.000Z',
    });
    expect(elementos[0]).not.toHaveProperty('authorId');
  });
});

describe('postsService.crear', () => {
  it('genera el slug desde el titulo y usa al autor del token', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.crear({ ...datos, title: 'Ergonomía: 5 claves' }, 4);

    expect(deps.crear).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'ergonomia-5-claves', authorId: 4 })
    );
  });

  it('numera el slug si ya existe', async () => {
    const deps = crearDeps({
      slugsParecidos: vi.fn().mockResolvedValue(['pausas-activas-en-la-oficina']),
    });
    const servicio = crearServicioPublicaciones(deps);

    await servicio.crear(datos, 4);

    expect(deps.crear).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'pausas-activas-en-la-oficina-2' })
    );
  });

  it('sin fecha publica con la fecha actual; con fecha respeta la elegida', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.crear(datos, 4);
    expect(vi.mocked(deps.crear).mock.calls[0][0].publishedAt).toBeInstanceOf(Date);

    const elegida = new Date('2026-01-15T12:00:00.000Z');
    await servicio.crear({ ...datos, publishedAt: elegida }, 4);
    expect(vi.mocked(deps.crear).mock.calls[1][0].publishedAt).toBe(elegida);
  });

  it('ignora un authorId colado en el cuerpo', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.crear({ ...datos, authorId: 99 } as never, 4);

    expect(vi.mocked(deps.crear).mock.calls[0][0].authorId).toBe(4);
  });

  it('falla con 401 sin autor', async () => {
    const servicio = crearServicioPublicaciones(crearDeps());
    await expect(servicio.crear(datos, 0)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('postsService.actualizar', () => {
  it('conserva el slug si el titulo no cambia', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.actualizar(7, datos);

    expect(deps.slugsParecidos).not.toHaveBeenCalled();
    expect(deps.actualizar).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ slug: 'pausas-activas-en-la-oficina' })
    );
  });

  it('regenera el slug si cambia el titulo, sin contarse a si misma', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.actualizar(7, { ...datos, title: 'Nuevo título' });

    expect(deps.slugsParecidos).toHaveBeenCalledWith('nuevo-titulo', 7);
    expect(deps.actualizar).toHaveBeenCalledWith(7, expect.objectContaining({ slug: 'nuevo-titulo' }));
  });

  it('borra la portada reemplazada pero no la que se conserva', async () => {
    const vieja = 'http://localhost:4000/uploads/imagenes/vieja.png';
    const deps = crearDeps({
      actualizar: vi.fn().mockResolvedValue({
        tipo: 'actualizado',
        registro: guardada,
        imagenesAnteriores: [vieja],
      }),
    });
    const servicio = crearServicioPublicaciones(deps);

    await servicio.actualizar(7, { ...datos, coverUrl: vieja });
    expect(deps.eliminarImagen).not.toHaveBeenCalled();

    await servicio.actualizar(7, { ...datos, coverUrl: 'http://localhost:4000/uploads/imagenes/nueva.png' });
    expect(deps.eliminarImagen).toHaveBeenCalledWith(vieja);
  });

  it('responde 404 si no existe', async () => {
    const servicio = crearServicioPublicaciones(crearDeps({ obtener: vi.fn().mockResolvedValue(null) }));
    await expect(servicio.actualizar(99, datos)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('postsService.eliminar y obtener', () => {
  it('elimina y borra su portada del disco', async () => {
    const deps = crearDeps({
      eliminar: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [guardada.coverUrl] }),
    });
    const servicio = crearServicioPublicaciones(deps);

    await servicio.eliminar(7);

    expect(deps.eliminarImagen).toHaveBeenCalledWith(guardada.coverUrl);
  });

  it('responde 404 al eliminar u obtener algo inexistente', async () => {
    const servicio = crearServicioPublicaciones(
      crearDeps({
        eliminar: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }),
        obtener: vi.fn().mockResolvedValue(null),
      })
    );

    await expect(servicio.eliminar(99)).rejects.toMatchObject({ statusCode: 404 });
    await expect(servicio.obtener(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});
