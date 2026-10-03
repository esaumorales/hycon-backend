import { Router } from 'express';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { leerUuid, manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { AppError } from '../../core/errors/AppError';
import { listadoPublicacionesSchema, publicacionSchema, type PublicacionInput } from './posts.schema';
import { postsService } from './posts.service';

const listar = manejar(async (req, res) => {
  const consulta = listadoPublicacionesSchema.safeParse(req.query);
  if (!consulta.success) throw new AppError(consulta.error.issues[0].message, 400);
  const { elementos, paginacion } = await postsService.listar(consulta.data);
  res.status(200).json({ success: true, data: { publicaciones: elementos, paginacion } });
});

// Formato de uuid: distingue la peticion del panel de la de la web publica
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La web publica pide por slug y suma la lectura; el panel pide por uuid y no la suma
const obtener = manejar(async (req, res) => {
  const parametro = String(req.params.referencia ?? '');
  const publicacion = ES_UUID.test(parametro)
    ? await postsService.obtener({ uuid: parametro })
    : await postsService.obtener({ slug: parametro }, { registrarLectura: true });
  res.status(200).json({ success: true, data: { publicacion } });
});

const crear = manejar(async (req, res) => {
  const publicacion = await postsService.crear(req.body as PublicacionInput, obtenerUsuarioId(req));
  res.status(201).json({ success: true, data: { publicacion } });
});

const actualizar = manejar(async (req, res) => {
  const publicacion = await postsService.actualizar(leerUuid(req), req.body as PublicacionInput);
  res.status(200).json({ success: true, data: { publicacion } });
});

const eliminar = manejar(async (req, res) => {
  await postsService.eliminar(leerUuid(req));
  res.status(204).end();
});

const router = Router();
const soloAdmin = [protect, restrictTo('ADMIN')];

// Leer es publico (la web de articulos lo necesitara); escribir solo el ADMIN
router.get('/', listar);
router.get('/:referencia', obtener);
router.post('/', ...soloAdmin, validate(publicacionSchema), crear);
router.put('/:uuid', ...soloAdmin, validate(publicacionSchema), actualizar);
router.delete('/:uuid', ...soloAdmin, eliminar);

export { router as postsRoutes };
