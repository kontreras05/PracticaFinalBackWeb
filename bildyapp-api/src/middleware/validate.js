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
    
    if (parsed.body) req.body = parsed.body;
    // Express 5 makes req.query a read-only getter — mutate in place instead of replacing
    if (parsed.query) Object.assign(req.query, parsed.query);
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      // Zod v4 uses .issues; v3 used .errors
      const issues = error.issues ?? error.errors ?? [];
      const errorMessages = issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return next(AppError.badRequest(`Validación fallida: ${errorMessages}`));
    }
    next(error);
  }
};
