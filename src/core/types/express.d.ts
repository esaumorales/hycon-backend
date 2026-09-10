import type { TokenPayload } from '../utils/jwt';

// Amplia Request para exponer el usuario autenticado que inyecta el middleware
declare global {
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

export {};
