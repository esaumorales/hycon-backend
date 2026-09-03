import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import Middlewares
import { errorHandler } from './core/middlewares/error.middleware';

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
app.use(helmet());
app.use(cors());

// Logging Middleware
app.use(morgan('dev'));

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes Registration
const API_PREFIX = '/api';
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
