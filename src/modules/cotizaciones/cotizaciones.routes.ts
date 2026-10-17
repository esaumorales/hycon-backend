import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { manejar } from '../../core/utils/controlador';
import { listadoQuerySchema } from '../catalog/catalog.schema';
import { cotizacionSchema, cotizacionesService, type CotizacionInput } from './cotizaciones.service';

// El formulario es publico: se limita por IP para que no lo usen de buzon de spam
const limitePorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Ya enviaste varias solicitudes. Espera unos minutos e intentalo de nuevo',
    });
  },
});

const listarEvaluaciones = manejar(async (_req, res) => {
  res.status(200).json({ success: true, data: { evaluaciones: cotizacionesService.evaluaciones() } });
});

const crear = manejar(async (req, res) => {
  const cotizacion = await cotizacionesService.crear(req.body as CotizacionInput);
  res.status(201).json({ success: true, data: { cotizacion } });
});

// El panel ve las solicitudes recibidas
const listar = manejar(async (req, res) => {
  const { pagina, porPagina } = listadoQuerySchema.parse(req.query);
  const { elementos, paginacion } = await cotizacionesService.listar({ pagina, porPagina });
  res.status(200).json({ success: true, data: { cotizaciones: elementos, paginacion } });
});

const router = Router();

router.get('/evaluaciones', listarEvaluaciones);
router.post('/', limitePorIp, validate(cotizacionSchema), crear);
router.get('/', protect, restrictTo('ADMIN'), listar);

export { router as cotizacionesRoutes };
