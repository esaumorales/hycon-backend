import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { lmsService } from './lms.service';

// Los cursos a los que el usuario tiene acceso por haberlos comprado
const misCursos = manejar(async (req, res) => {
  const cursos = await lmsService.misCursos(obtenerUsuarioId(req));
  res.status(200).json({ success: true, data: { cursos } });
});

const router = Router();

router.get('/mis-cursos', protect, misCursos);

export { router as lmsRoutes };
