import AppError from '../utils/AppError.js';

/**
 * Middleware centralizado para manejo de errores de Express.
 */
/**
 * Middleware centralizado de gestión de errores para Express.
 * Detecta tipos específicos de errores (Zod, Mongoose, JWT, MongoDB) y los
 * normaliza en respuestas JSON estandarizadas.
 */
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err, message: err.message, name: err.name };

  // Errores de validación de Zod
  if (error.name === 'ZodError' || (error.issues && Array.isArray(error.issues))) {
    const message = `Validation Error: ${error.issues ? error.issues.map(e => e.message).join('. ') : error.message}`;
    error = new AppError(message, 400);
  }

  // Errores por campos requeridos o checks nativos en Mongoose
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(val => val.message);
    error = new AppError(`Invalid data: ${errors.join('. ')}`, 400);
  }

  // Errores por campos duplicados (MongoDB Duplicate Key, ej: email único o cif)
  if (error.code === 11000) {
    const value = error.errmsg ? error.errmsg.match(/(["'])(\\?.)*?\1/)[0] : 'Campo duplicado';
    error = new AppError(`El valor ${value} ya existe. Por favor utiliza un valor diferente.`, 409);
  }

  // Errores genéricos de JWT
  if (error.name === 'JsonWebTokenError') {
    error = new AppError('Token inválido. Por favor inicia sesión de nuevo.', 401);
  }
  if (error.name === 'TokenExpiredError') {
    error = new AppError('Tu token de sesión ha expirado. Por favor inicia sesión de nuevo.', 401);
  }

  res.status(error.statusCode).json({
    status: error.status,
    message: error.message,
    // Mostrar stack trace solo en desarrollo para debugging
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {})
  });
};
