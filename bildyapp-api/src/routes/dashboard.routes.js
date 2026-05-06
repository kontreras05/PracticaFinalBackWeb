import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

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
router.get('/', getDashboard);

export default router;
