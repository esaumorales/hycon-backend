import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './core/config/env';

// Import Middlewares
import { errorHandler } from './core/middlewares/error.middleware';

// Import OpenAPI Spec and Scalar
import { apiReference } from '@scalar/express-api-reference';
import { openApiSpec } from './core/config/openapi';

// Import Modular Routes
import { authRoutes } from './modules/auth/auth.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { cartRoutes } from './modules/cart/cart.routes';
import { orderRoutes } from './modules/orders/orders.routes';
import { paymentRoutes } from './modules/payments/payments.routes';
import { lmsRoutes } from './modules/lms/lms.routes';
import { ergoRoutes } from './modules/ergo/ergo.routes';

const app: Application = express();

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://api.scalar.com"],
      },
    },
  })
);
// Solo se aceptan peticiones desde los origenes declarados en CORS_ORIGINS.
// Se permiten las peticiones sin origen (curl, Postman, health checks).
app.use(
  cors({
    origin: (origen, callback) => {
      if (!origen || env.CORS_ORIGINS.includes(origen)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origen}`));
    },
    credentials: true,
  })
);

// Logging Middleware
app.use(morgan('dev'));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes Registration
const API_PREFIX = '/api/v1';

// Documentación de la API (Scalar)
app.use(
  '/docs-secrets-a1b2c3d4e5f6',
  apiReference({
    spec: {
      content: openApiSpec,
    },
  })
);

// Sonda de salud para comprobar que el servidor responde
app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, estado: 'ok', entorno: env.NODE_ENV });
});

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/catalog`, catalogRoutes);
app.use(`${API_PREFIX}/cart`, cartRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/lms`, lmsRoutes);
app.use(`${API_PREFIX}/ergo`, ergoRoutes);

// Global Error Handler
app.use(errorHandler);

export { app };
