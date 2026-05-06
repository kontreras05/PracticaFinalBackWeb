import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';

import { errorHandler } from './middleware/error-handler.js';
import AppError from './utils/AppError.js';
import userRoutes from './routes/user.routes.js';

/**
 * Punto de entrada de la aplicación Express.
 * Aquí se configuran los middlewares globales, seguridad y rutas.
 */
const app = express();

// Middlewares de Seguridad HTTP
app.use(helmet());

// Limit requests from same API (Rate Limit) -> max 100 requests per 15 minutes
const limiter = rateLimit({
  limit: 100,
  windowMs: 15 * 60 * 1000, 
  message: 'Demasiadas peticiones desde esta IP, por favor inténtalo de nuevo en 15 minutos.'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// RUTAS
app.use('/api/user', userRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res, next) => {
  next(AppError.notFound(`No se puede encontrar ${req.originalUrl} en este servidor.`));
});

// Middleware centralizado de errores
app.use(errorHandler);

export default app;
