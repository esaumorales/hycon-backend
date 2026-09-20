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
router.get('/products/:id', obtenerProducto);
router.post('/products', ...soloAdmin, validate(productoSchema), crearProducto);
router.put('/products/:id', ...soloAdmin, validate(productoSchema), actualizarProducto);
router.delete('/products/:id', ...soloAdmin, eliminarProducto);

router.get('/courses', listarCursos);
router.get('/courses/:id', obtenerCurso);
router.post('/courses', ...soloAdmin, validate(cursoSchema), crearCurso);
router.put('/courses/:id', ...soloAdmin, validate(cursoSchema), actualizarCurso);
router.delete('/courses/:id', ...soloAdmin, eliminarCurso);

export { router as catalogRoutes };
