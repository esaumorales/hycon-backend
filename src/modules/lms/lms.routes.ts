import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { manejar, leerUuid, obtenerUsuarioId } from '../../core/utils/controlador';
import {
  certificadosService,
  certificadoSchema,
  type CertificadoInput,
} from './certificados.service';
import { lmsService } from './lms.service';
import { misCursosQuerySchema } from './lms.schema';

// Los cursos a los que el usuario tiene acceso por haberlos comprado
const misCursos = manejar(async (req, res) => {
  const consulta = misCursosQuerySchema.parse(req.query);
  const { elementos, paginacion } = await lmsService.misCursos(obtenerUsuarioId(req), consulta);
  res.status(200).json({ success: true, data: { cursos: elementos, paginacion } });
});

// Partes vistas del curso y, si ya esta, el certificado
const progreso = manejar(async (req, res) => {
  const datos = await certificadosService.progreso(leerUuid(req), obtenerUsuarioId(req));
  res.status(200).json({ success: true, data: { progreso: datos } });
});

const marcarVista = manejar(async (req, res) => {
  const datos = await certificadosService.marcarVista(
    leerUuid(req),
    String(req.params.leccionUuid ?? ''),
    obtenerUsuarioId(req)
  );
  res.status(200).json({ success: true, data: { progreso: datos } });
});

// El certificado se emite una sola vez, con el nombre que confirma el alumno
const emitirCertificado = manejar(async (req, res) => {
  const certificado = await certificadosService.emitir(
    leerUuid(req),
    obtenerUsuarioId(req),
    req.body as CertificadoInput
  );
  res.status(201).json({ success: true, data: { certificado } });
});

const router = Router();

router.get('/mis-cursos', protect, misCursos);
router.get('/cursos/:uuid/progreso', protect, progreso);
router.post('/cursos/:uuid/partes/:leccionUuid/vista', protect, marcarVista);
router.post('/cursos/:uuid/certificado', protect, validate(certificadoSchema), emitirCertificado);

export { router as lmsRoutes };
