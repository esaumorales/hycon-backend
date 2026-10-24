import { z } from 'zod';
import {
  buscarSchema,
  fechaFiltro,
  paginaSchema,
  porPaginaSchema,
} from '../../core/utils/filtros-listado';
import { POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO } from '../catalog/catalog.constants';

// Medios de pago aceptados. 'whatsapp' deja el pedido pendiente de cobro.
export const METODOS_PAGO = ['tarjeta', 'yape', 'whatsapp'] as const;

export const pedidoSchema = z.object({
  metodoPago: z.enum(METODOS_PAGO),
  items: z
    .array(
      z.object({
        tipo: z.enum(['producto', 'curso']),
        uuid: z.string().uuid('El identificador del articulo no es valido'),
        cantidad: z.number().int().min(1).max(99),
      })
    )
    .min(1, 'El pedido no tiene articulos')
    .max(50, 'Demasiados articulos en un mismo pedido'),
});

export type PedidoInput = z.infer<typeof pedidoSchema>;
export type MetodoPago = PedidoInput['metodoPago'];

// Estados en los que puede quedar un pedido al crearse
export const ESTADOS_PAGO = ['pagado', 'pendiente'] as const;

// Filtros de "mis compras". Un parametro invalido cae a su valor por defecto
// por separado, sin invalidar el resto de la consulta.
export const misPedidosQuerySchema = z
  .object({
    buscar: buscarSchema,
    estado: z.enum(['todos', ...ESTADOS_PAGO]).catch('todos'),
    orden: z.enum(['recientes', 'antiguos']).catch('recientes'),
    desde: fechaFiltro,
    hasta: fechaFiltro,
    pagina: paginaSchema,
    porPagina: porPaginaSchema(POR_PAGINA_DEFECTO, POR_PAGINA_MAXIMO),
  })
  .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
    message: 'La fecha inicial no puede superar la final',
    path: ['hasta'],
  });

export type MisPedidosQuery = z.infer<typeof misPedidosQuerySchema>;
