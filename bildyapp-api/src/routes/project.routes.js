import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  idParamSchema,
} from '../validators/project.validator.js';
import {
  createProject,
  updateProject,
  listProjects,
  listArchivedProjects,
  getProject,
  deleteProject,
  restoreProject,
} from '../controllers/project.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

/**
 * @openapi
 * /project:
 *   post:
 *     tags: [Project]
 *     summary: Crear proyecto
 *     description: Crea un proyecto asociado a un cliente de la empresa. El `projectCode` debe ser único dentro de la empresa (excluye borrados).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, projectCode, client]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Reforma Nave Industrial
 *               projectCode:
 *                 type: string
 *                 example: PRJ-001
 *               client:
 *                 type: string
 *                 example: 664000000000000000000003
 *                 description: ID MongoDB del cliente (debe pertenecer a la misma empresa)
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: obras@empresa.com
 *               notes:
 *                 type: string
 *                 example: Acceso por puerta lateral
 *               active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Proyecto creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cliente no encontrado en la empresa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/', validate(createProjectSchema), createProject);

/**
 * @openapi
 * /project/{id}:
 *   put:
 *     tags: [Project]
 *     summary: Actualizar proyecto
 *     description: Actualiza los campos enviados del proyecto. Sólo si pertenece a la empresa del usuario.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000004
 *         description: ID MongoDB del proyecto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nombre Actualizado
 *               projectCode:
 *                 type: string
 *                 example: PRJ-002
 *               client:
 *                 type: string
 *                 example: 664000000000000000000003
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *               email:
 *                 type: string
 *                 format: email
 *               notes:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Proyecto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.put('/:id', validate(updateProjectSchema), updateProject);

/**
 * @openapi
 * /project:
 *   get:
 *     tags: [Project]
 *     summary: Listar proyectos activos
 *     description: Devuelve los proyectos no eliminados de la empresa con paginación y filtros.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrar por nombre (parcial, insensible a mayúsculas)
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *           example: 664000000000000000000003
 *         description: Filtrar por ID de cliente
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: -createdAt
 *         description: Campo de ordenación (prefijo - para descendente)
 *     responses:
 *       200:
 *         description: Lista paginada de proyectos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/', validate(listProjectsQuerySchema), listProjects);

/**
 * @openapi
 * /project/archived:
 *   get:
 *     tags: [Project]
 *     summary: Listar proyectos archivados
 *     description: Devuelve únicamente los proyectos con borrado lógico de la empresa del usuario.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de proyectos archivados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/archived', listArchivedProjects);

/**
 * @openapi
 * /project/{id}:
 *   get:
 *     tags: [Project]
 *     summary: Obtener proyecto por ID
 *     description: Devuelve los datos de un proyecto activo de la empresa.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000004
 *         description: ID MongoDB del proyecto
 *     responses:
 *       200:
 *         description: Datos del proyecto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/:id', validate(idParamSchema), getProject);

/**
 * @openapi
 * /project/{id}:
 *   delete:
 *     tags: [Project]
 *     summary: Eliminar proyecto
 *     description: |
 *       Elimina un proyecto de la empresa.
 *       - `?soft=true` (por defecto): borrado lógico (archivado).
 *       - `?soft=false`: borrado físico permanente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000004
 *       - in: query
 *         name: soft
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Proyecto eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: string
 *                   nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.delete('/:id', validate(idParamSchema), deleteProject);

/**
 * @openapi
 * /project/{id}/restore:
 *   patch:
 *     tags: [Project]
 *     summary: Restaurar proyecto archivado
 *     description: Revierte el borrado lógico de un proyecto, volviéndolo a estado activo.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000004
 *     responses:
 *       200:
 *         description: Proyecto restaurado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.patch('/:id/restore', validate(idParamSchema), restoreProject);

export default router;
