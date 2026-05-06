import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';

import { errorHandler } from './middleware/error-handler.js';
import AppError from './utils/AppError.js';
import apiRoutes from './routes/index.js';
import { spec } from './config/swagger.js';

const app = express();

// Middlewares de Seguridad HTTP
app.use(helmet());

// Swagger UI — CSP relajada solo para /api-docs
app.use('/api-docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;"
  );
  next();
}, swaggerUi.serve, swaggerUi.setup(spec, {
  customSiteTitle: 'BildyApp API Docs',
  swaggerOptions: { persistAuthorization: true }
}));

// Limit requests from same API (Rate Limit) -> max 100 requests per 15 minutes
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    limit: 100,
    windowMs: 15 * 60 * 1000,
    message: 'Demasiadas peticiones desde esta IP, por favor inténtalo de nuevo en 15 minutos.'
  });
  app.use('/api', limiter);
}

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Express 5: req.query is a read-only getter — convert to writable before mongoSanitize
app.use((req, res, next) => {
  const query = req.query;
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });
  next();
});
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check — excluido de auth y rate limit
app.get('/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.status(200).json({
    status: 'ok',
    db: dbState[mongoose.connection.readyState] ?? 'unknown',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// RUTAS
app.use('/api', apiRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res, next) => {
  next(AppError.notFound(`No se puede encontrar ${req.originalUrl} en este servidor.`));
});

// Middleware centralizado de errores
app.use(errorHandler);

export default app;
