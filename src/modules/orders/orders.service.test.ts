import { describe, expect, it, vi } from 'vitest';
import { codigoDePedido, crearServicioPedidos, type DependenciasPedidos } from './orders.service';
import type { ArticuloCobrable, PedidoBase, PedidoNuevo } from './orders.types';
import type { PedidoInput } from './orders.schema';

const UUID_CAJA = '7b73989c-0719-4c06-bd1e-8c7ae193a432';
const UUID_SILLA = '01a0e08a-6cf7-726e-bf81-60859ae9882b';
const UUID_CURSO = 'b7b299d8-ee8f-4bea-a618-0a5f8261136f';

// Caja con oferta: 25.90 de lista, 19.90 cobrados
const caja: ArticuloCobrable = {
  uuid: UUID_CAJA,
  id: 3,
  nombre: 'Caja de carton',
  precio: 25.9,
  precioOferta: 19.9,
  status: 'active',
  stock: 5,
};

const silla: ArticuloCobrable = {
  uuid: UUID_SILLA,
  id: 4,
  nombre: 'Silla ergonomica',
  precio: 100,
  precioOferta: null,
  status: 'active',
  stock: 10,
};

const curso: ArticuloCobrable = {
  uuid: UUID_CURSO,
  id: 2,
  nombre: 'Logistica de ultima milla',
  precio: 199,
  precioOferta: 149,
  status: 'active',
  stock: null,
};

const pedidoEnBase = (datos: PedidoNuevo): PedidoBase => ({
  uuid: '0192f0aa-1111-7000-8000-5f3ad2c91e77',
  subtotal: { toString: () => datos.subtotal.toFixed(2) },
  discount: { toString: () => datos.descuento.toFixed(2) },
  total: { toString: () => datos.total.toFixed(2) },
  paymentStatus: datos.estadoPago,
  createdAt: new Date('2026-10-07T12:00:00.000Z'),
  items: datos.lineas.map((linea) => ({
    itemType: linea.tipo === 'producto' ? 'product' : 'course',
    quantity: linea.cantidad,
    price: { toString: () => linea.precio.toFixed(2) },
    product: linea.productId ? { name: 'Caja de carton' } : null,
    course: linea.courseId ? { name: 'Logistica de ultima milla' } : null,
  })),
  payments: [{ provider: datos.metodoPago }],
});

const crearDeps = (cambios: Partial<DependenciasPedidos> = {}): DependenciasPedidos => ({
  buscarProductos: vi.fn().mockResolvedValue([caja, silla]),
  buscarCursos: vi.fn().mockResolvedValue([curso]),
  crear: vi.fn().mockImplementation(async (datos: PedidoNuevo) => pedidoEnBase(datos)),
  listarDelUsuario: vi.fn().mockResolvedValue({ filas: [], total: 0 }),
  ...cambios,
});

const pedido = (items: PedidoInput['items'], metodoPago: PedidoInput['metodoPago'] = 'tarjeta') => ({
  metodoPago,
  items,
});

describe('pedidos: crear', () => {
  it('cobra el precio de la base, no el que manda el navegador', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    const resultado = await servicio.crear(
      // El cliente podria mandar cualquier precio: aqui ni se mira
      pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 2, precio: 1 } as never]),
      4
    );

    expect(resultado.subtotal).toBe(51.8);
    expect(resultado.descuento).toBe(12);
    expect(resultado.total).toBe(39.8);
    expect(resultado.items[0]).toMatchObject({ cantidad: 2, precio: 19.9, total: 39.8 });
  });

  it('suma productos y cursos en el mismo pedido', async () => {
    const servicio = crearServicioPedidos(crearDeps());

    const resultado = await servicio.crear(
      pedido([
        { tipo: 'producto', uuid: UUID_SILLA, cantidad: 1 },
        { tipo: 'curso', uuid: UUID_CURSO, cantidad: 1 },
      ]),
      4
    );

    // 100 sin oferta + 199 con 50 de descuento
    expect(resultado.subtotal).toBe(299);
    expect(resultado.descuento).toBe(50);
    expect(resultado.total).toBe(249);
    expect(resultado.items).toHaveLength(2);
  });

  it('guarda el pedido con el usuario de la sesion y el metodo de pago', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    await servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }], 'yape'), 7);

    expect(deps.crear).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, metodoPago: 'yape', estadoPago: 'pagado' })
    );
  });

  it('pagar por WhatsApp deja el pedido pendiente de cobro', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    const resultado = await servicio.crear(
      pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }], 'whatsapp'),
      4
    );

    expect(resultado.estadoPago).toBe('pendiente');
  });

  it('no deja comprar mas unidades de las que hay', async () => {
    const servicio = crearServicioPedidos(crearDeps());

    await expect(
      servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 6 }]), 4)
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Solo quedan 5') });
  });

  it('rechaza lo que ya no esta publicado', async () => {
    const servicio = crearServicioPedidos(
      crearDeps({ buscarProductos: vi.fn().mockResolvedValue([{ ...caja, status: 'inactive' }]) })
    );

    await expect(
      servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }]), 4)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rechaza un articulo que ya no existe', async () => {
    const servicio = crearServicioPedidos(crearDeps({ buscarProductos: vi.fn().mockResolvedValue([]) }));

    await expect(
      servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }]), 4)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('un curso es una sola inscripcion', async () => {
    const servicio = crearServicioPedidos(crearDeps());

    await expect(
      servicio.crear(pedido([{ tipo: 'curso', uuid: UUID_CURSO, cantidad: 2 }]), 4)
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza el mismo articulo repetido en dos lineas', async () => {
    const servicio = crearServicioPedidos(crearDeps());

    await expect(
      servicio.crear(
        pedido([
          { tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 },
          { tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 },
        ]),
        4
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('sin sesion no se puede comprar', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    await expect(
      servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }]), 0)
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(deps.crear).not.toHaveBeenCalled();
  });

  it('no pide al catalogo lo que no hace falta', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    await servicio.crear(pedido([{ tipo: 'producto', uuid: UUID_CAJA, cantidad: 1 }]), 4);

    expect(deps.buscarProductos).toHaveBeenCalledWith([UUID_CAJA]);
    expect(deps.buscarCursos).not.toHaveBeenCalled();
  });
});

describe('pedidos: mis compras', () => {
  it('pide solo los pedidos del usuario de la sesion', async () => {
    const deps = crearDeps();
    const servicio = crearServicioPedidos(deps);

    await servicio.listarMios(7, { pagina: 2, porPagina: 6 });

    expect(deps.listarDelUsuario).toHaveBeenCalledWith(7, {
      estado: 'todos',
      saltar: 6,
      tomar: 6,
    });
  });

  it('devuelve cada compra con su codigo corto y su detalle', async () => {
    const guardado = pedidoEnBase({
      userId: 4,
      metodoPago: 'tarjeta',
      estadoPago: 'pagado',
      subtotal: 51.8,
      descuento: 12,
      total: 39.8,
      lineas: [{ tipo: 'producto', productId: 3, courseId: null, cantidad: 2, precio: 19.9 }],
    });
    const servicio = crearServicioPedidos(
      crearDeps({ listarDelUsuario: vi.fn().mockResolvedValue({ filas: [guardado], total: 1 }) })
    );

    const { elementos, paginacion } = await servicio.listarMios(4, { pagina: 1, porPagina: 6 });

    expect(elementos[0]).toMatchObject({
      codigo: 'PED-C91E77',
      metodoPago: 'tarjeta',
      estadoPago: 'pagado',
      total: 39.8,
    });
    expect(elementos[0].items[0]).toMatchObject({ nombre: 'Caja de carton', cantidad: 2 });
    expect(paginacion.totalPaginas).toBe(1);
  });
});


describe('codigo del pedido', () => {
  it('sale del final del uuid, no de la hora de creacion', () => {
    // Dos pedidos creados en el mismo rato comparten cabecera en un uuid v7
    const primero = codigoDePedido('01a1187d-6ef3-735b-9d52-7a79a28c66b3');
    const segundo = codigoDePedido('01a1187d-9aaa-735b-9d52-111111111111');

    expect(primero).toBe('PED-8C66B3');
    expect(segundo).toBe('PED-111111');
    expect(primero).not.toBe(segundo);
  });
});
