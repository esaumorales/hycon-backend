import { Router } from 'express';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { leerId, manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { listadoQuerySchema } from '../catalog/catalog.schema';
import { publicacionSchema, type PublicacionInput } from './posts.schema';
import { postsService } from './posts.service';

const listar = manejar(async (req, res) => {
  const { elementos, paginacion } = await postsService.listar(listadoQuerySchema.parse(req.query));
  res.status(200).json({ success: true, data: { publicaciones: elementos, paginacion } });
});

const obtener = manejar(async (req, res) => {
  const publicacion = await postsService.obtener(leerId(req));
  res.status(200).json({ success: true, data: { publicacion } });
});

const crear = manejar(async (req, res) => {
  const publicacion = await postsService.crear(req.body as PublicacionInput, obtenerUsuarioId(req));
  res.status(201).json({ success: true, data: { publicacion } });
});

const actualizar = manejar(async (req, res) => {
  const publicacion = await postsService.actualizar(leerId(req), req.body as PublicacionInput);
  res.status(200).json({ success: true, data: { publicacion } });
});

const eliminar = manejar(async (req, res) => {
  await postsService.eliminar(leerId(req));
  res.status(204).end();
});

const router = Router();
const soloAdmin = [protect, restrictTo('ADMIN')];

// Leer es publico (la web de articulos lo necesitara); escribir solo el ADMIN
router.get('/', listar);
router.get('/:id', obtener);
router.post('/', ...soloAdmin, validate(publicacionSchema), crear);
router.put('/:id', ...soloAdmin, validate(publicacionSchema), actualizar);
router.delete('/:id', ...soloAdmin, eliminar);

export { router as postsRoutes };
