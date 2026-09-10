import { Router } from 'express';
import { protect } from '../../core/middlewares/auth.middleware';
import { validate } from '../../core/middlewares/validate.middleware';
import { iniciarSesion, perfil, registrar } from './auth.controller';
import { loginSchema, registroSchema } from './auth.schema';

const router = Router();

router.post('/register', validate(registroSchema), registrar);
router.post('/login', validate(loginSchema), iniciarSesion);
router.get('/me', protect, perfil);

export { router as authRoutes };
