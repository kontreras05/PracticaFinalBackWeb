/**
 * Rutas para el Dashboard (Panel de control).
 * Proporciona endpoints para obtener estadísticas y resúmenes de datos.
 */

import { Router } from 'express';
// Middleware de autenticación para asegurar que solo usuarios logueados accedan
import { requireAuth } from '../middleware/auth.middleware.js';
// Controlador que tiene la lógica real de negocio para el dashboard
import { getDashboard } from '../controllers/dashboard.controller.js';

// Instanciamos el router para este recurso específico
const router = Router();

/**
 * Aplicamos el middleware 'requireAuth' a TODAS las rutas de este router.
 * Esto significa que si no hay un token válido, la petición será rechazada
 * con un error 401 antes de llegar a 'getDashboard'.
 */
router.use(requireAuth);

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Estadísticas agregadas de albaranes por mes, cliente y proyecto
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del dashboard
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// Define la ruta GET raíz '/'. Llama a la función 'getDashboard' en el controlador.
router.get('/', getDashboard);

// Exportamos el router configurado
export default router;
