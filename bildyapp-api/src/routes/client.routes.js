import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
  idParamSchema,
} from '../validators/client.validator.js';
import {
  createClient,
  updateClient,
  listClients,
  listArchivedClients,
  getClient,
  deleteClient,
  restoreClient,
} from '../controllers/client.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

/**
 * @openapi
 * /client:
 *   post:
 *     tags: [Client]
 *     summary: Crear cliente
 *     description: Crea un cliente en la empresa del usuario autenticado. El CIF debe ser único dentro de la empresa (excluye borrados).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cif]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Constructora Sur S.A.
 *               cif:
 *                 type: string
 *                 example: A87654321
 *               email:
 *                 type: string
 *                 format: email
 *                 example: info@constructorasur.com
 *               phone:
 *                 type: string
 *                 example: "954123456"
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Cliente creado
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
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/', restrictTo('admin'), validate(createClientSchema), createClient);

/**
 * @openapi
 * /client/{id}:
 *   put:
 *     tags: [Client]
 *     summary: Actualizar cliente
 *     description: Actualiza los campos enviados del cliente. Sólo si pertenece a la empresa del usuario.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000003
 *         description: ID MongoDB del cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nuevo Nombre S.L.
 *               cif:
 *                 type: string
 *                 example: B99999999
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Cliente actualizado
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
 *                     client:
 *                       $ref: '#/components/schemas/Client'
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
router.put('/:id', restrictTo('admin'), validate(updateClientSchema), updateClient);

/**
 * @openapi
 * /client:
 *   get:
 *     tags: [Client]
 *     summary: Listar clientes activos
 *     description: Devuelve los clientes no eliminados de la empresa con paginación y filtros opcionales.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Resultados por página
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrar por nombre (búsqueda parcial, insensible a mayúsculas)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: name
 *         description: Campo de ordenación (prefijo - para descendente, ej. -createdAt)
 *     responses:
 *       200:
 *         description: Lista paginada de clientes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/', validate(listClientsQuerySchema), listClients);

/**
 * @openapi
 * /client/archived:
 *   get:
 *     tags: [Client]
 *     summary: Listar clientes archivados
 *     description: Devuelve únicamente los clientes con borrado lógico de la empresa del usuario.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes archivados
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
 *                     clients:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/archived', listArchivedClients);

/**
 * @openapi
 * /client/{id}:
 *   get:
 *     tags: [Client]
 *     summary: Obtener cliente por ID
 *     description: Devuelve los datos de un cliente activo de la empresa.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000003
 *         description: ID MongoDB del cliente
 *     responses:
 *       200:
 *         description: Datos del cliente
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
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/:id', validate(idParamSchema), getClient);

/**
 * @openapi
 * /client/{id}:
 *   delete:
 *     tags: [Client]
 *     summary: Eliminar cliente
 *     description: |
 *       Elimina un cliente de la empresa.
 *       - `?soft=true` (por defecto): borrado lógico (archivado).
 *       - `?soft=false`: borrado físico permanente (solo si no hay proyectos o albaranes asociados).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000003
 *         description: ID MongoDB del cliente
 *       - in: query
 *         name: soft
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Borrado lógico (true) o físico (false)
 *     responses:
 *       200:
 *         description: Cliente eliminado
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
router.delete('/:id', restrictTo('admin'), validate(idParamSchema), deleteClient);

/**
 * @openapi
 * /client/{id}/restore:
 *   patch:
 *     tags: [Client]
 *     summary: Restaurar cliente archivado
 *     description: Revierte el borrado lógico de un cliente, volviéndolo a estado activo.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000003
 *         description: ID MongoDB del cliente
 *     responses:
 *       200:
 *         description: Cliente restaurado
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
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.patch('/:id/restore', restrictTo('admin'), validate(idParamSchema), restoreClient);

export default router;
