import { describe, expect, it, vi } from 'vitest';
import { crearServicioCatalogo, type DependenciasCatalogo } from './catalog.service';
import type { CursoBase, ProductoBase } from './catalog.types';
import type { CursoInput, ProductoInput } from './catalog.schema';

const productoEnBase: ProductoBase = {
  productId: 1,
  ownerId: 4,
  name: 'Caja de carton',
  description: null,
  brand: 'Hycon',
  model: 'C-40',
  color: 'Marron',
  // Prisma devuelve Decimal: un objeto con toString, no un number
  price: { toString: () => '25.90' },
  discountPrice: { toString: () => '19.90' },
  stock: 12,
  shippingAgencies: ['olva', 'shalom', 'agencia-retirada'],
  status: 'active',
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
  images: [
    { imageUrl: 'https://cdn.hycon.lat/secundaria.webp', isThumbnail: false },
    { imageUrl: 'https://cdn.hycon.lat/principal.webp', isThumbnail: true },
  ],
};

const cursoEnBase: CursoBase = {
  courseId: 1,
  ownerId: 4,
  name: 'Logistica basica',
  description: null,
  videoUrl: null,
  thumbnailUrl: 'http://localhost:4000/uploads/imagenes/vieja.png',
  durationMinutes: 90,
  price: { toString: () => '120.00' },
  discountPrice: null,
  status: 'active',
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
};

const datosProducto: ProductoInput = {
  name: 'Caja',
  price: 25.9,
  stock: 12,
  status: 'active',
  shippingAgencies: ['shalom'],
};

const datosCurso: CursoInput = { name: 'Curso', price: 120, status: 'active' };

const primeraPagina = { estado: 'active' as const, pagina: 1, porPagina: 6 };

const crearDeps = (sobrescribir: Partial<DependenciasCatalogo> = {}): DependenciasCatalogo => ({
  listarProductos: vi.fn().mockResolvedValue({ filas: [productoEnBase], total: 1 }),
  obtenerProducto: vi.fn().mockResolvedValue(productoEnBase),
  crearProducto: vi.fn().mockResolvedValue(productoEnBase),
  actualizarProducto: vi.fn().mockResolvedValue({
    tipo: 'actualizado',
    registro: productoEnBase,
    imagenesAnteriores: [],
  }),
  eliminarProducto: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [] }),
  listarCursos: vi.fn().mockResolvedValue({ filas: [cursoEnBase], total: 1 }),
  obtenerCurso: vi.fn().mockResolvedValue(cursoEnBase),
  crearCurso: vi.fn().mockResolvedValue(cursoEnBase),
  actualizarCurso: vi.fn().mockResolvedValue({
    tipo: 'actualizado',
    registro: cursoEnBase,
    imagenesAnteriores: [],
  }),
  eliminarCurso: vi.fn().mockResolvedValue({ tipo: 'eliminado', imagenes: [] }),
  eliminarImagen: vi.fn().mockResolvedValue(true),
  ...sobrescribir,
});

describe('catalogService.listarProductos', () => {
  it('convierte los Decimal de Prisma a number', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const { elementos } = await servicio.listarProductos(primeraPagina);

    expect(elementos[0].price).toBe(25.9);
    expect(elementos[0].discountPrice).toBe(19.9);
  });

  it('expone la imagen marcada como miniatura, no la primera de la lista', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const { elementos } = await servicio.listarProductos(primeraPagina);

    expect(elementos[0].imageUrl).toBe('https://cdn.hycon.lat/principal.webp');
  });

  it('deja imageUrl en null cuando el producto no tiene imagenes', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({
        listarProductos: vi
          .fn()
          .mockResolvedValue({ filas: [{ ...productoEnBase, images: [] }], total: 1 }),
      })
    );

    const { elementos } = await servicio.listarProductos(primeraPagina);

    expect(elementos[0].imageUrl).toBeNull();
  });

  it('devuelve color y agencias con su nombre, descartando codigos retirados', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const { elementos } = await servicio.listarProductos(primeraPagina);

    expect(elementos[0].color).toBe('Marron');
    expect(elementos[0].shippingAgencies).toEqual([
      { code: 'shalom', name: 'Shalom' },
      { code: 'olva', name: 'Olva Courier' },
    ]);
  });

  it('traduce pagina y porPagina a saltar y tomar', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarProductos({ estado: 'todos', pagina: 3, porPagina: 6 });

    expect(deps.listarProductos).toHaveBeenCalledWith({ estado: 'todos', saltar: 12, tomar: 6 });
  });

  it('calcula el total de paginas con lo que cuenta la base', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({
        listarProductos: vi.fn().mockResolvedValue({ filas: [productoEnBase], total: 13 }),
      })
    );

    const { paginacion } = await servicio.listarProductos(primeraPagina);

    expect(paginacion).toEqual({ pagina: 1, porPagina: 6, total: 13, totalPaginas: 3 });
  });

  it('informa una pagina aunque el catalogo este vacio', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({ listarProductos: vi.fn().mockResolvedValue({ filas: [], total: 0 }) })
    );

    const { paginacion } = await servicio.listarProductos(primeraPagina);

    expect(paginacion.totalPaginas).toBe(1);
  });

  it('no filtra el ownerId hacia el cliente', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const { elementos } = await servicio.listarProductos(primeraPagina);

    expect(elementos[0]).not.toHaveProperty('ownerId');
  });
});

describe('catalogService.obtenerProducto', () => {
  it('devuelve el producto en su forma publica', async () => {
    const servicio = crearServicioCatalogo(crearDeps());
    expect((await servicio.obtenerProducto(1)).productId).toBe(1);
  });

  it('responde 404 si no existe', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({ obtenerProducto: vi.fn().mockResolvedValue(null) })
    );
    await expect(servicio.obtenerProducto(99)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('catalogService.crearProducto', () => {
  it('asigna como propietario al usuario autenticado', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.crearProducto(datosProducto, 4);

    expect(deps.crearProducto).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 4, name: 'Caja', shippingAgencies: ['shalom'] })
    );
  });

  it('ignora cualquier ownerId que venga en el cuerpo de la peticion', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.crearProducto({ ...datosProducto, ownerId: 99 } as never, 4);

    expect(vi.mocked(deps.crearProducto).mock.calls[0][0].ownerId).toBe(4);
  });

  it('falla con 401 si no hay usuario identificado', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    await expect(servicio.crearProducto(datosProducto, 0)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe('catalogService.actualizarProducto', () => {
  it('devuelve el producto actualizado', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    const producto = await servicio.actualizarProducto(1, datosProducto);

    expect(deps.actualizarProducto).toHaveBeenCalledWith(1, datosProducto);
    expect(producto.productId).toBe(1);
  });

  it('responde 404 si el producto no existe', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({ actualizarProducto: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }) })
    );

    await expect(servicio.actualizarProducto(99, datosProducto)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('borra del disco la imagen que se reemplazo', async () => {
    const deps = crearDeps({
      actualizarProducto: vi.fn().mockResolvedValue({
        tipo: 'actualizado',
        registro: productoEnBase,
        imagenesAnteriores: ['http://localhost:4000/uploads/imagenes/vieja.png'],
      }),
    });
    const servicio = crearServicioCatalogo(deps);

    await servicio.actualizarProducto(1, {
      ...datosProducto,
      imageUrl: 'http://localhost:4000/uploads/imagenes/nueva.png',
    });

    expect(deps.eliminarImagen).toHaveBeenCalledWith(
      'http://localhost:4000/uploads/imagenes/vieja.png'
    );
  });

  it('no borra la imagen si se conserva la misma', async () => {
    const url = 'http://localhost:4000/uploads/imagenes/misma.png';
    const deps = crearDeps({
      actualizarProducto: vi.fn().mockResolvedValue({
        tipo: 'actualizado',
        registro: productoEnBase,
        imagenesAnteriores: [url],
      }),
    });
    const servicio = crearServicioCatalogo(deps);

    await servicio.actualizarProducto(1, { ...datosProducto, imageUrl: url });

    expect(deps.eliminarImagen).not.toHaveBeenCalled();
  });
});

describe('catalogService.eliminarProducto', () => {
  it('elimina y limpia sus imagenes', async () => {
    const deps = crearDeps({
      eliminarProducto: vi
        .fn()
        .mockResolvedValue({ tipo: 'eliminado', imagenes: ['http://x/uploads/imagenes/a.png'] }),
    });
    const servicio = crearServicioCatalogo(deps);

    await servicio.eliminarProducto(1);

    expect(deps.eliminarImagen).toHaveBeenCalledWith('http://x/uploads/imagenes/a.png');
  });

  it('responde 404 si no existe', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({ eliminarProducto: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }) })
    );
    await expect(servicio.eliminarProducto(99)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('responde 409 si el producto ya tiene pedidos y no toca las imagenes', async () => {
    const deps = crearDeps({ eliminarProducto: vi.fn().mockResolvedValue({ tipo: 'en-uso' }) });
    const servicio = crearServicioCatalogo(deps);

    await expect(servicio.eliminarProducto(1)).rejects.toMatchObject({ statusCode: 409 });
    expect(deps.eliminarImagen).not.toHaveBeenCalled();
  });
});

describe('catalogService de cursos', () => {
  it('convierte los precios y conserva la duracion', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const { elementos } = await servicio.listarCursos(primeraPagina);

    expect(elementos[0].price).toBe(120);
    expect(elementos[0].discountPrice).toBeNull();
    expect(elementos[0].durationMinutes).toBe(90);
  });

  it('pagina los cursos igual que los productos', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarCursos({ estado: 'todos', pagina: 2, porPagina: 6 });

    expect(deps.listarCursos).toHaveBeenCalledWith({ estado: 'todos', saltar: 6, tomar: 6 });
  });

  it('asigna el propietario al crear un curso', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.crearCurso(datosCurso, 4);

    expect(deps.crearCurso).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 4 }));
  });

  it('falla con 401 sin usuario identificado', async () => {
    const servicio = crearServicioCatalogo(crearDeps());
    await expect(servicio.crearCurso(datosCurso, 0)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('al editar borra la miniatura anterior si cambio', async () => {
    const deps = crearDeps({
      actualizarCurso: vi.fn().mockResolvedValue({
        tipo: 'actualizado',
        registro: cursoEnBase,
        imagenesAnteriores: ['http://localhost:4000/uploads/imagenes/vieja.png'],
      }),
    });
    const servicio = crearServicioCatalogo(deps);

    await servicio.actualizarCurso(1, datosCurso);

    expect(deps.eliminarImagen).toHaveBeenCalledWith(
      'http://localhost:4000/uploads/imagenes/vieja.png'
    );
  });

  it('responde 404 al editar o eliminar un curso inexistente', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({
        actualizarCurso: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }),
        eliminarCurso: vi.fn().mockResolvedValue({ tipo: 'no-encontrado' }),
        obtenerCurso: vi.fn().mockResolvedValue(null),
      })
    );

    await expect(servicio.actualizarCurso(9, datosCurso)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(servicio.eliminarCurso(9)).rejects.toMatchObject({ statusCode: 404 });
    await expect(servicio.obtenerCurso(9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('responde 409 si el curso tiene matriculas', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({ eliminarCurso: vi.fn().mockResolvedValue({ tipo: 'en-uso' }) })
    );
    await expect(servicio.eliminarCurso(1)).rejects.toMatchObject({ statusCode: 409 });
  });
});
