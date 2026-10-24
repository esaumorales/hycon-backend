import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { manejar } from '../../core/utils/controlador';
import { env } from '../../core/config/env';
import { almacenVideos, EXTENSIONES_VIDEO } from './videos.service';

export const firmaVideoSchema = z.object({
  cursoUuid: z.string().uuid('Indica el curso al que pertenece el video'),
  nombre: z.string().trim().min(1, 'Falta el nombre del archivo').max(300),
});

type FirmaVideoInput = z.infer<typeof firmaVideoSchema>;

const router = Router();

const soloAdmin = [protect, restrictTo('ADMIN')] as const;

// El panel pregunta esto para saber si ofrece subir archivos o solo pedir un enlace
const describirAlmacen = manejar(async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      almacen: {
        proveedor: almacenVideos.proveedor,
        aceptaSubidas: almacenVideos.aceptaSubidas,
        maximoMb: env.VIDEO_MAXIMO_MB,
        extensiones: EXTENSIONES_VIDEO,
      },
    },
  });
});

// Subida directa: el archivo va del navegador al almacen sin pasar por el servidor
const firmarVideo = manejar(async (req, res) => {
  const { cursoUuid, nombre } = req.body as FirmaVideoInput;
  const subida = await almacenVideos.firmarSubida(cursoUuid, nombre);
  res.status(200).json({ success: true, data: { subida } });
});

router.get('/videos', ...soloAdmin, describirAlmacen);
router.post('/videos/firma', ...soloAdmin, validate(firmaVideoSchema), firmarVideo);

export { router as mediaRoutes };
