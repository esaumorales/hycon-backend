import { Router } from 'express';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import {
  actualizarCurso,
  actualizarProducto,
  crearCurso,
  crearProducto,
  eliminarCurso,
  eliminarProducto,
  listarAgencias,
  listarCursos,
  listarProductos,
  obtenerCurso,
  obtenerProducto,
} from './catalog.controller';
import { cursoSchema, productoSchema } from './catalog.schema';

const router = Router();
const soloAdmin = [protect, restrictTo('ADMIN')];

// Las lecturas son publicas: la tienda las necesita sin sesion.
// Crear, editar y eliminar solo lo puede hacer un ADMIN autenticado.
router.get('/shipping-agencies', listarAgencias);

router.get('/products', listarProductos);
router.get('/products/:uuid', obtenerProducto);
router.post('/products', ...soloAdmin, validate(productoSchema), crearProducto);
router.put('/products/:uuid', ...soloAdmin, validate(productoSchema), actualizarProducto);
router.delete('/products/:uuid', ...soloAdmin, eliminarProducto);

router.get('/courses', listarCursos);
router.get('/courses/:uuid', obtenerCurso);
router.post('/courses', ...soloAdmin, validate(cursoSchema), crearCurso);
router.put('/courses/:uuid', ...soloAdmin, validate(cursoSchema), actualizarCurso);
router.delete('/courses/:uuid', ...soloAdmin, eliminarCurso);

export { router as catalogRoutes };
