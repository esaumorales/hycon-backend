import { Router } from 'express';
import { identificar, protect, restrictTo } from '../../core/middlewares/auth.middleware';
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
  listarLecciones,
  listarLeccionesAdmin,
  crearLeccion,
  actualizarLeccion,
  eliminarLeccion,
  reordenarLecciones,
} from './catalog.controller';
import { cursoSchema, productoSchema } from './catalog.schema';
import { leccionSchema, ordenLeccionesSchema } from './lecciones.schema';

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

// Temario del curso. La lectura publica solo devuelve el video de lo que
// ese visitante puede ver; el panel lo ve completo.
router.get('/courses/:uuid/lecciones', identificar, listarLecciones);
router.get('/courses/:uuid/lecciones/admin', ...soloAdmin, listarLeccionesAdmin);
router.post('/courses/:uuid/lecciones', ...soloAdmin, validate(leccionSchema), crearLeccion);
router.put('/courses/:uuid/lecciones/orden', ...soloAdmin, validate(ordenLeccionesSchema), reordenarLecciones);
router.put('/courses/:uuid/lecciones/:leccionUuid', ...soloAdmin, validate(leccionSchema), actualizarLeccion);
router.delete('/courses/:uuid/lecciones/:leccionUuid', ...soloAdmin, eliminarLeccion);

export { router as catalogRoutes };
