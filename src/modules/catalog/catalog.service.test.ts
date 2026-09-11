import { describe, expect, it, vi } from 'vitest';
import { crearServicioCatalogo, LIMITE_LISTADO, type DependenciasCatalogo } from './catalog.service';
import type { CursoBase, ProductoBase } from './catalog.types';

const productoEnBase: ProductoBase = {
  productId: 1,
  ownerId: 4,
  name: 'Caja de carton',
  description: null,
  brand: 'Hycon',
  model: 'C-40',
  // Prisma devuelve Decimal: un objeto con toString, no un number
  price: { toString: () => '25.90' },
  discountPrice: { toString: () => '19.90' },
  stock: 12,
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
  thumbnailUrl: null,
  durationMinutes: 90,
  price: { toString: () => '120.00' },
  discountPrice: null,
  status: 'active',
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
};

const crearDeps = (sobrescribir: Partial<DependenciasCatalogo> = {}): DependenciasCatalogo => ({
  listarProductos: vi.fn().mockResolvedValue([productoEnBase]),
  crearProducto: vi.fn().mockResolvedValue(productoEnBase),
  listarCursos: vi.fn().mockResolvedValue([cursoEnBase]),
  crearCurso: vi.fn().mockResolvedValue(cursoEnBase),
  ...sobrescribir,
});

describe('catalogService.listarProductos', () => {
  it('convierte los Decimal de Prisma a number', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const [producto] = await servicio.listarProductos();

    expect(producto.price).toBe(25.9);
    expect(producto.discountPrice).toBe(19.9);
    expect(typeof producto.price).toBe('number');
  });

  it('expone la imagen marcada como miniatura, no la primera de la lista', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const [producto] = await servicio.listarProductos();

    expect(producto.imageUrl).toBe('https://cdn.hycon.lat/principal.webp');
  });

  it('deja imageUrl en null cuando el producto no tiene imagenes', async () => {
    const servicio = crearServicioCatalogo(
      crearDeps({
        listarProductos: vi.fn().mockResolvedValue([{ ...productoEnBase, images: [] }]),
      })
    );

    const [producto] = await servicio.listarProductos();

    expect(producto.imageUrl).toBeNull();
  });

  it('aplica un tope de filas al consultar', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarProductos();

    expect(deps.listarProductos).toHaveBeenCalledWith(LIMITE_LISTADO, 'active');
  });

  it('por defecto solo publica los productos activos', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarProductos();

    // El catalogo publico no debe mostrar lo dado de baja
    expect(deps.listarProductos).toHaveBeenCalledWith(expect.any(Number), 'active');
  });

  it('el panel puede pedir tambien los inactivos', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarProductos('todos');

    expect(deps.listarProductos).toHaveBeenCalledWith(expect.any(Number), 'todos');
  });

  it('no filtra el ownerId hacia el cliente', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const [producto] = await servicio.listarProductos();

    expect(producto).not.toHaveProperty('ownerId');
  });
});

describe('catalogService.crearProducto', () => {
  it('asigna como propietario al usuario autenticado', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.crearProducto(
      { name: 'Caja', price: 25.9, stock: 12, status: 'active' },
      4
    );

    expect(deps.crearProducto).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 4, name: 'Caja' })
    );
  });

  it('ignora cualquier ownerId que venga en el cuerpo de la peticion', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    // Un cliente malicioso podria intentar colar otro propietario
    await servicio.crearProducto(
      { name: 'Caja', price: 25.9, stock: 1, status: 'active', ownerId: 99 } as never,
      4
    );

    const argumentos = (deps.crearProducto as any).mock.calls[0][0];
    expect(argumentos.ownerId).toBe(4);
  });

  it('falla con 401 si no hay usuario identificado', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    await expect(
      servicio.crearProducto({ name: 'Caja', price: 1, stock: 0, status: 'active' }, 0)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('devuelve el producto ya convertido a la forma publica', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const producto = await servicio.crearProducto(
      { name: 'Caja', price: 25.9, stock: 12, status: 'active' },
      4
    );

    expect(producto.productId).toBe(1);
    expect(producto.createdAt).toBe('2026-09-10T12:00:00.000Z');
  });
});

describe('catalogService de cursos', () => {
  it('convierte los precios y conserva la duracion', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    const [curso] = await servicio.listarCursos();

    expect(curso.price).toBe(120);
    expect(curso.discountPrice).toBeNull();
    expect(curso.durationMinutes).toBe(90);
  });

  it('tambien filtra los cursos por estado', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.listarCursos();
    expect(deps.listarCursos).toHaveBeenCalledWith(expect.any(Number), 'active');

    await servicio.listarCursos('todos');
    expect(deps.listarCursos).toHaveBeenLastCalledWith(expect.any(Number), 'todos');
  });

  it('asigna el propietario al crear un curso', async () => {
    const deps = crearDeps();
    const servicio = crearServicioCatalogo(deps);

    await servicio.crearCurso({ name: 'Curso', price: 120, status: 'active' }, 4);

    expect(deps.crearCurso).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 4 }));
  });

  it('falla con 401 sin usuario identificado', async () => {
    const servicio = crearServicioCatalogo(crearDeps());

    await expect(
      servicio.crearCurso({ name: 'Curso', price: 120, status: 'active' }, 0)
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
