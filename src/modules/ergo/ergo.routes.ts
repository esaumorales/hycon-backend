import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { crearEmpresa, obtenerEmpresas, obtenerEmpresa, obtenerFichas, obtenerFicha, crearFicha, actualizarFicha } from './ergo.controller';

const router = Router();

// Todas las rutas de ergo requieren autenticacion
router.use(protect);

router.get('/empresas', obtenerEmpresas);
router.post('/empresas', crearEmpresa);
router.get('/empresas/:id', obtenerEmpresa);
router.get('/empresas/:id/fichas', obtenerFichas);
router.post('/empresas/:id/fichas', crearFicha);
router.get('/empresas/:id/fichas/:fichaId', obtenerFicha);
router.put('/empresas/:id/fichas/:fichaId', actualizarFicha);

export { router as ergoRoutes };
