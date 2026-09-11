import { Router } from 'express';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import {
  crearCurso,
  crearProducto,
  listarCursos,
  listarProductos,
} from './catalog.controller';
import { crearCursoSchema, crearProductoSchema } from './catalog.schema';

const router = Router();

// Los listados son publicos: la tienda los necesitara sin sesion.
// Crear solo lo puede hacer un ADMIN autenticado.
router.get('/products', listarProductos);
router.post('/products', protect, restrictTo('ADMIN'), validate(crearProductoSchema), crearProducto);

router.get('/courses', listarCursos);
router.post('/courses', protect, restrictTo('ADMIN'), validate(crearCursoSchema), crearCurso);

export { router as catalogRoutes };
