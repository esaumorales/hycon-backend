import { prisma } from '../../core/database/prisma';
import { listarConTotal } from '../../core/database/consultas';
import { AppError } from '../../core/errors/AppError';
import { aPaginacion } from '../catalog/catalog.mapper';
import type { ConsultaListado, Listado } from '../catalog/catalog.service';
import type { PaginaDe } from '../catalog/catalog.types';
import type { MetodoPago, PedidoInput } from './orders.schema';
import type {
  ArticuloCobrable,
  LineaNueva,
  PedidoBase,
  PedidoNuevo,
  PedidoPublico,
} from './orders.types';

export interface DependenciasPedidos {
  buscarProductos(uuids: string[]): Promise<ArticuloCobrable[]>;
  buscarCursos(uuids: string[]): Promise<ArticuloCobrable[]>;
  crear(datos: PedidoNuevo): Promise<PedidoBase>;
  listarDelUsuario(userId: number, consulta: ConsultaListado): Promise<PaginaDe<PedidoBase>>;
}

const aNumero = (valor: { toString(): string }): number => Number(valor.toString());

// Dos decimales: sumar centimos en coma flotante arrastra errores (19.90 por 3)
const redondear = (valor: number): number => Math.round(valor * 100) / 100;

const seleccionPedido = {
  uuid: true,
  subtotal: true,
  discount: true,
  total: true,
  paymentStatus: true,
  createdAt: true,
  items: {
    select: {
      itemType: true,
      quantity: true,
      price: true,
      product: { select: { name: true } },
      course: { select: { name: true } },
    },
  },
  payments: { select: { provider: true }, take: 1 },
} as const;

const seleccionArticulo = {
  uuid: true,
  name: true,
  price: true,
  discountPrice: true,
  status: true,
} as const;

export const dependenciasReales: DependenciasPedidos = {
  async buscarProductos(uuids) {
    const filas = await prisma.product.findMany({
      where: { uuid: { in: uuids } },
      select: { ...seleccionArticulo, productId: true, stock: true },
    });
    return filas.map((fila) => ({
      uuid: fila.uuid,
      id: fila.productId,
      nombre: fila.name,
      precio: aNumero(fila.price),
      precioOferta: fila.discountPrice === null ? null : aNumero(fila.discountPrice),
      status: fila.status,
      stock: fila.stock,
    }));
  },

  async buscarCursos(uuids) {
    const filas = await prisma.course.findMany({
      where: { uuid: { in: uuids } },
      select: { ...seleccionArticulo, courseId: true },
    });
    return filas.map((fila) => ({
      uuid: fila.uuid,
      id: fila.courseId,
      nombre: fila.name,
      precio: aNumero(fila.price),
      precioOferta: fila.discountPrice === null ? null : aNumero(fila.discountPrice),
      status: fila.status,
      stock: null,
    }));
  },

  crear: ({ userId, metodoPago, estadoPago, subtotal, descuento, total, lineas }) =>
    prisma.order.create({
      data: {
        userId,
        subtotal,
        discount: descuento,
        total,
        paymentStatus: estadoPago,
        items: {
          create: lineas.map((linea) => ({
            itemType: linea.tipo === 'producto' ? 'product' : 'course',
            productId: linea.productId,
            courseId: linea.courseId,
            quantity: linea.cantidad,
            price: linea.precio,
          })),
        },
        // El cobro se guarda aparte, como en cualquier pasarela: un pedido, un pago
        payments: { create: [{ provider: metodoPago, amount: total, status: estadoPago }] },
      },
      select: seleccionPedido,
    }),

  listarDelUsuario: (userId, { saltar, tomar }) =>
    listarConTotal(
      () =>
        prisma.order.findMany({
          where: { userId },
          select: seleccionPedido,
          orderBy: { createdAt: 'desc' },
          skip: saltar,
          take: tomar,
        }),
      () => prisma.order.count({ where: { userId } })
    ),
};

// El codigo sale del final del uuid: su cabecera es la hora de creacion y dos
// pedidos del mismo rato compartirian codigo
export const codigoDePedido = (uuid: string): string => `PED-${uuid.slice(-6).toUpperCase()}`;

export const aPedidoPublico = (pedido: PedidoBase): PedidoPublico => ({
  uuid: pedido.uuid,
  codigo: codigoDePedido(pedido.uuid),
  estadoPago: pedido.paymentStatus,
  metodoPago: pedido.payments[0]?.provider ?? 'desconocido',
  subtotal: aNumero(pedido.subtotal),
  descuento: aNumero(pedido.discount),
  total: aNumero(pedido.total),
  createdAt: pedido.createdAt.toISOString(),
  items: pedido.items.map((linea) => ({
    tipo: linea.itemType === 'product' ? 'producto' : 'curso',
    nombre: linea.product?.name ?? linea.course?.name ?? 'Articulo retirado',
    cantidad: linea.quantity,
    precio: aNumero(linea.price),
    total: redondear(aNumero(linea.price) * linea.quantity),
  })),
});

// Tarjeta y Yape dejan el pedido cobrado; por WhatsApp queda pendiente de cobro
const estadoSegunMetodo = (metodo: MetodoPago) => (metodo === 'whatsapp' ? 'pendiente' : 'pagado');

export const crearServicioPedidos = (deps: DependenciasPedidos) => ({
  async crear(datos: PedidoInput, userId: number): Promise<PedidoPublico> {
    if (!userId) throw new AppError('Inicia sesion para completar la compra', 401);

    const distintos = new Set(datos.items.map((item) => item.uuid));
    if (distintos.size !== datos.items.length) {
      throw new AppError('El pedido repite un mismo articulo', 422);
    }

    const uuidsProducto = datos.items.filter((i) => i.tipo === 'producto').map((i) => i.uuid);
    const uuidsCurso = datos.items.filter((i) => i.tipo === 'curso').map((i) => i.uuid);

    const [productos, cursos] = await Promise.all([
      uuidsProducto.length > 0 ? deps.buscarProductos(uuidsProducto) : Promise.resolve([]),
      uuidsCurso.length > 0 ? deps.buscarCursos(uuidsCurso) : Promise.resolve([]),
    ]);
    const catalogo = new Map([...productos, ...cursos].map((articulo) => [articulo.uuid, articulo]));

    let subtotal = 0;
    let descuento = 0;
    const lineas: LineaNueva[] = [];

    for (const item of datos.items) {
      const articulo = catalogo.get(item.uuid);
      // El precio y la disponibilidad salen de la base: lo que mande el navegador no cuenta
      if (!articulo || articulo.status !== 'active') {
        throw new AppError('Un articulo del pedido ya no esta disponible', 409);
      }
      if (item.tipo === 'curso' && item.cantidad !== 1) {
        throw new AppError(`El curso "${articulo.nombre}" es una sola inscripcion`, 422);
      }
      if (articulo.stock !== null && item.cantidad > articulo.stock) {
        throw new AppError(`Solo quedan ${articulo.stock} unidades de "${articulo.nombre}"`, 409);
      }

      const precioFinal = articulo.precioOferta ?? articulo.precio;
      subtotal += articulo.precio * item.cantidad;
      descuento += (articulo.precio - precioFinal) * item.cantidad;
      lineas.push({
        tipo: item.tipo,
        productId: item.tipo === 'producto' ? articulo.id : null,
        courseId: item.tipo === 'curso' ? articulo.id : null,
        cantidad: item.cantidad,
        precio: precioFinal,
      });
    }

    const pedido = await deps.crear({
      userId,
      metodoPago: datos.metodoPago,
      estadoPago: estadoSegunMetodo(datos.metodoPago),
      subtotal: redondear(subtotal),
      descuento: redondear(descuento),
      total: redondear(subtotal - descuento),
      lineas,
    });

    return aPedidoPublico(pedido);
  },

  async listarMios(
    userId: number,
    { pagina, porPagina }: { pagina: number; porPagina: number }
  ): Promise<Listado<PedidoPublico>> {
    const { filas, total } = await deps.listarDelUsuario(userId, {
      estado: 'todos',
      saltar: (pagina - 1) * porPagina,
      tomar: porPagina,
    });
    return {
      elementos: filas.map(aPedidoPublico),
      paginacion: aPaginacion(pagina, porPagina, total),
    };
  },
});

export const ordersService = crearServicioPedidos(dependenciasReales);
