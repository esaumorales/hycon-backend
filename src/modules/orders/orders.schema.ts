import { z } from 'zod';

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
