import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { manejar, obtenerUsuarioId } from '../../core/utils/controlador';
import { lmsService } from './lms.service';
import { misCursosQuerySchema } from './lms.schema';

// Los cursos a los que el usuario tiene acceso por haberlos comprado
const misCursos = manejar(async (req, res) => {
  const consulta = misCursosQuerySchema.parse(req.query);
  const { elementos, paginacion } = await lmsService.misCursos(obtenerUsuarioId(req), consulta);
  res.status(200).json({ success: true, data: { cursos: elementos, paginacion } });
});

const router = Router();

router.get('/mis-cursos', protect, misCursos);

export { router as lmsRoutes };
