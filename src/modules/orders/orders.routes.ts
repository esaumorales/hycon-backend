import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { listadoQuerySchema } from '../catalog/catalog.schema';
import { pedidoSchema, type PedidoInput } from './orders.schema';
import { ordersService } from './orders.service';

const crear = manejar(async (req, res) => {
  const pedido = await ordersService.crear(req.body as PedidoInput, obtenerUsuarioId(req));
  res.status(201).json({ success: true, data: { pedido } });
});

// Cada quien ve solo sus compras: el usuario sale del token, nunca de la URL
const listarMios = manejar(async (req, res) => {
  const { pagina, porPagina } = listadoQuerySchema.parse(req.query);
  const { elementos, paginacion } = await ordersService.listarMios(obtenerUsuarioId(req), {
    pagina,
    porPagina,
  });
  res.status(200).json({ success: true, data: { pedidos: elementos, paginacion } });
});

const router = Router();

router.get('/mios', protect, listarMios);
router.post('/', protect, validate(pedidoSchema), crear);

export { router as orderRoutes };
