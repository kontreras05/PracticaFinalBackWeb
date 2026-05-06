import AppError from '../utils/AppError.js';

/**
 * Middleware para validar el cuerpo, parámetros o query de la petición
 * utilizando un esquema de Zod.
 * @param {z.ZodObject} schema - El esquema de validación.
 */
export const validate = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Remplazamos con los datos validados y posiblemente transformados (trim, lowercase, etc.)
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;
    
    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      // Extraemos los mensajes de error de forma legible
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return next(AppError.badRequest(`Validación fallida: ${errorMessages}`));
    }
    next(error);
  }
};
