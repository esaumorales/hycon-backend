import { describe, expect, it, vi } from 'vitest';
import { crearServicioPublicaciones, type DependenciasPublicaciones } from './posts.service';
const UUID = '3f1d9d6a-2c47-4f0a-9d4b-6f0c3b8a1e22';
const UUID_AJENO = '00000000-0000-4000-8000-000000000999';

import type { PublicacionBase } from './posts.types';
import type { PublicacionInput } from './posts.schema';

const guardada: PublicacionBase = {
  postId: 7,
  uuid: UUID,
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
  obtenerPorSlug: vi.fn().mockResolvedValue(guardada),
  sumarLectura: vi.fn().mockResolvedValue(undefined),
  slugsParecidos: vi.fn().mockResolvedValue([]),
  crear: vi.fn().mockResolvedValue(guardada),
  actualizar: vi.fn().mockResolvedValue({ tipo: 'actualizado', registro: guardada, imagenesAnteriores: [] }),
  eliminar: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [] }),
  eliminarImagen: vi.fn().mockResolvedValue(true),
  ...sobrescribir,
});

describe('postsService.listar', () => {
  it('pasa al listado el orden pedido', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.listar({ estado: 'active', pagina: 1, porPagina: 3, orden: 'leidos' });

    expect(deps.listar).toHaveBeenCalledWith({ estado: 'active', orden: 'leidos', saltar: 0, tomar: 3 });
  });

  it('pagina y expone tiempo de lectura, lecturas y autor', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    const { elementos, paginacion } = await servicio.listar({ estado: 'todos', pagina: 2, porPagina: 6, orden: 'recientes' });

    expect(deps.listar).toHaveBeenCalledWith({ estado: 'todos', orden: 'recientes', saltar: 6, tomar: 6 });
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

describe('postsService.obtener', () => {
  it('por slug devuelve el articulo y suma una lectura', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    const publicacion = await servicio.obtener({ slug: 'pausas-activas-en-la-oficina' }, { registrarLectura: true });

    expect(deps.obtenerPorSlug).toHaveBeenCalledWith('pausas-activas-en-la-oficina');
    expect(deps.sumarLectura).toHaveBeenCalledWith(7);
    // El contador que se devuelve ya incluye esta lectura
    expect(publicacion.views).toBe(121);
  });

  it('por uuid no suma lecturas: es la vista del panel', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.obtener({ uuid: UUID });

    expect(deps.obtener).toHaveBeenCalledWith(UUID);
    expect(deps.sumarLectura).not.toHaveBeenCalled();
  });

  it('un borrador no suma lecturas aunque se pida', async () => {
    const deps = crearDeps({
      obtenerPorSlug: vi.fn().mockResolvedValue({ ...guardada, status: 'inactive' }),
    });
    const servicio = crearServicioPublicaciones(deps);

    await servicio.obtener({ slug: 'borrador' }, { registrarLectura: true });

    expect(deps.sumarLectura).not.toHaveBeenCalled();
  });

  it('si falla el contador el articulo se lee igual', async () => {
    const deps = crearDeps({ sumarLectura: vi.fn().mockRejectedValue(new Error('base caida')) });
    const servicio = crearServicioPublicaciones(deps);

    await expect(
      servicio.obtener({ slug: 'slug' }, { registrarLectura: true })
    ).resolves.toMatchObject({ uuid: UUID });
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

    await servicio.actualizar(UUID, datos);

    expect(deps.slugsParecidos).not.toHaveBeenCalled();
    expect(deps.actualizar).toHaveBeenCalledWith(
      UUID,
      expect.objectContaining({ slug: 'pausas-activas-en-la-oficina' })
    );
  });

  it('regenera el slug si cambia el titulo, sin contarse a si misma', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPublicaciones(deps);

    await servicio.actualizar(UUID, { ...datos, title: 'Nuevo título' });

    expect(deps.slugsParecidos).toHaveBeenCalledWith('nuevo-titulo', UUID);
    expect(deps.actualizar).toHaveBeenCalledWith(UUID, expect.objectContaining({ slug: 'nuevo-titulo' }));
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

    await servicio.actualizar(UUID, { ...datos, coverUrl: vieja });
    expect(deps.eliminarImagen).not.toHaveBeenCalled();

    await servicio.actualizar(UUID, { ...datos, coverUrl: 'http://localhost:4000/uploads/imagenes/nueva.png' });
    expect(deps.eliminarImagen).toHaveBeenCalledWith(vieja);
  });

  it('responde 404 si no existe', async () => {
    const servicio = crearServicioPublicaciones(crearDeps({ obtener: vi.fn().mockResolvedValue(null) }));
    await expect(servicio.actualizar(UUID_AJENO, datos)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('postsService.eliminar y obtener', () => {
  it('elimina y borra su portada del disco', async () => {
    const deps = crearDeps({
      eliminar: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [guardada.coverUrl] }),
    });
    const servicio = crearServicioPublicaciones(deps);

    await servicio.eliminar(UUID);

    expect(deps.eliminarImagen).toHaveBeenCalledWith(guardada.coverUrl);
  });

  it('responde 404 al eliminar u obtener algo inexistente', async () => {
    const servicio = crearServicioPublicaciones(
      crearDeps({
        eliminar: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }),
        obtener: vi.fn().mockResolvedValue(null),
      })
    );

    await expect(servicio.eliminar(UUID_AJENO)).rejects.toMatchObject({ statusCode: 404 });
    await expect(servicio.obtener({ uuid: UUID_AJENO })).rejects.toMatchObject({ statusCode: 404 });
  });
});
