/**
 * Archivo principal de rutas (Index Router).
 * Se encarga de unificar todas las rutas de la aplicación en un solo lugar
 * para luego ser conectadas al servidor Express principal (app.js).
 */

import { Router } from 'express';
// Importación de los diferentes archivos de rutas (routers) para cada entidad
import userRoutes from './user.routes.js';
import clientRoutes from './client.routes.js';
import projectRoutes from './project.routes.js';
import deliveryNoteRoutes from './deliverynote.routes.js';
import dashboardRoutes from './dashboard.routes.js';

// Creamos la instancia del router principal
const router = Router();

/**
 * Montaje de rutas (Routing):
 * Al acceder a una ruta, por ejemplo '/user/algo', este router principal delega
 * la petición al 'userRoutes' que se encargará de buscar qué hacer con '/algo'.
 */
router.use('/user', userRoutes); // Todas las peticiones a /user irán al userRoutes
router.use('/client', clientRoutes); // Todas las peticiones a /client irán al clientRoutes
router.use('/project', projectRoutes); // Todas las peticiones a /project irán al projectRoutes
router.use('/deliverynote', deliveryNoteRoutes); // Todas las peticiones a /deliverynote irán al deliveryNoteRoutes
router.use('/dashboard', dashboardRoutes); // Todas las peticiones a /dashboard irán al dashboardRoutes

/**
 * Exportamos el router principal configurado para ser importado y usado en app.js.
 */
export default router;
