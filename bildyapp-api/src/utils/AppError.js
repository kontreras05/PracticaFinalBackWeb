/**
 * Clase global para la gestión estructurada de errores operativos (AppError).
 */
export default class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message) {
    return new AppError(message, 400);
  }

  static unauthorized(message) {
    return new AppError(message, 401);
  }

  static forbidden(message) {
    return new AppError(message, 403);
  }

  static notFound(message) {
    return new AppError(message, 404);
  }

  static conflict(message) {
    return new AppError(message, 409);
  }

  static tooManyRequests(message) {
    return new AppError(message, 429);
  }

  static internal(message) {
    return new AppError(message, 500);
  }
}
