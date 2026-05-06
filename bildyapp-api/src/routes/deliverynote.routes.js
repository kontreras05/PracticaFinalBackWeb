import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploadSignature } from '../middleware/upload-memory.js';
import {
  createDeliveryNoteSchema,
  listDeliveryNotesQuerySchema,
  idParamSchema,
  signDeliveryNoteSchema,
} from '../validators/deliverynote.validator.js';
import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  getDeliveryNotePDF,
  signDeliveryNote,
  deleteDeliveryNote,
} from '../controllers/deliverynote.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

/**
 * @openapi
 * /deliverynote:
 *   post:
 *     tags: [DeliveryNote]
 *     summary: Crear albarán
 *     description: |
 *       Crea un albarán de horas o materiales. El formato condiciona los campos requeridos:
 *       - `format: "hours"` → requerido `hours` (y opcionalmente `workers[]`)
 *       - `format: "material"` → requeridos `material`, `quantity` y `unit`
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [format, workDate, client, project, hours]
 *                 title: Albarán de horas
 *                 properties:
 *                   format:
 *                     type: string
 *                     enum: [hours]
 *                     example: hours
 *                   description:
 *                     type: string
 *                     example: Jornada de montaje
 *                   workDate:
 *                     type: string
 *                     format: date
 *                     example: "2024-06-15"
 *                   client:
 *                     type: string
 *                     example: 664000000000000000000003
 *                   project:
 *                     type: string
 *                     example: 664000000000000000000004
 *                   hours:
 *                     type: number
 *                     example: 8
 *                   workers:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Worker'
 *               - type: object
 *                 required: [format, workDate, client, project, material, quantity, unit]
 *                 title: Albarán de material
 *                 properties:
 *                   format:
 *                     type: string
 *                     enum: [material]
 *                     example: material
 *                   description:
 *                     type: string
 *                     example: Suministro de material
 *                   workDate:
 *                     type: string
 *                     format: date
 *                     example: "2024-06-15"
 *                   client:
 *                     type: string
 *                     example: 664000000000000000000003
 *                   project:
 *                     type: string
 *                     example: 664000000000000000000004
 *                   material:
 *                     type: string
 *                     example: Cemento Portland
 *                   quantity:
 *                     type: number
 *                     example: 50
 *                   unit:
 *                     type: string
 *                     example: kg
 *     responses:
 *       201:
 *         description: Albarán creado
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
 *                     deliveryNote:
 *                       $ref: '#/components/schemas/DeliveryNote'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cliente o proyecto no encontrado en la empresa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/', validate(createDeliveryNoteSchema), createDeliveryNote);

/**
 * @openapi
 * /deliverynote:
 *   get:
 *     tags: [DeliveryNote]
 *     summary: Listar albaranes
 *     description: Devuelve los albaranes de la empresa con paginación y filtros opcionales.
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
 *         name: project
 *         schema:
 *           type: string
 *         description: Filtrar por ID de proyecto
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *         description: Filtrar por ID de cliente
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [hours, material]
 *         description: Filtrar por tipo de albarán
 *       - in: query
 *         name: signed
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado de firma
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Fecha de trabajo desde (workDate >=)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Fecha de trabajo hasta (workDate <=)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: -workDate
 *         description: Campo de ordenación (prefijo - para descendente)
 *     responses:
 *       200:
 *         description: Lista paginada de albaranes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/', validate(listDeliveryNotesQuerySchema), listDeliveryNotes);

/**
 * @openapi
 * /deliverynote/pdf/{id}:
 *   get:
 *     tags: [DeliveryNote]
 *     summary: Descargar PDF del albarán
 *     description: |
 *       - Si el albarán está firmado y tiene `pdfUrl`, redirige a la URL en la nube.
 *       - Si no está firmado, genera el PDF on-the-fly y lo devuelve como stream.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000005
 *         description: ID MongoDB del albarán
 *     responses:
 *       200:
 *         description: PDF del albarán
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       302:
 *         description: Redirige a la URL del PDF firmado en la nube
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/pdf/:id', validate(idParamSchema), getDeliveryNotePDF);

/**
 * @openapi
 * /deliverynote/{id}:
 *   get:
 *     tags: [DeliveryNote]
 *     summary: Obtener albarán por ID
 *     description: Devuelve los datos completos del albarán con populate de usuario, cliente y proyecto.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000005
 *         description: ID MongoDB del albarán
 *     responses:
 *       200:
 *         description: Datos del albarán
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
 *                     deliveryNote:
 *                       $ref: '#/components/schemas/DeliveryNote'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/:id', validate(idParamSchema), getDeliveryNote);

/**
 * @openapi
 * /deliverynote/{id}/sign:
 *   patch:
 *     tags: [DeliveryNote]
 *     summary: Firmar albarán
 *     description: |
 *       Sube la imagen de firma, la optimiza con Sharp y la almacena en la nube.
 *       Genera el PDF final y lo sube también. Devuelve 409 si el albarán ya estaba firmado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000005
 *         description: ID MongoDB del albarán
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Imagen de firma (JPEG, PNG, WebP — máx. 5 MB)
 *     responses:
 *       200:
 *         description: Albarán firmado — se incluyen las URLs de firma y PDF
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
 *                     deliveryNote:
 *                       $ref: '#/components/schemas/DeliveryNote'
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
router.patch('/:id/sign', validate(signDeliveryNoteSchema), uploadSignature, signDeliveryNote);

/**
 * @openapi
 * /deliverynote/{id}:
 *   delete:
 *     tags: [DeliveryNote]
 *     summary: Eliminar albarán
 *     description: |
 *       Elimina el albarán. Está bloqueado si el albarán ya ha sido firmado (`signed: true`).
 *       - `?soft=true` (por defecto): borrado lógico.
 *       - `?soft=false`: borrado físico permanente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: 664000000000000000000005
 *       - in: query
 *         name: soft
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Albarán eliminado
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
 *       409:
 *         description: No se puede eliminar un albarán firmado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.delete('/:id', validate(idParamSchema), deleteDeliveryNote);

export default router;
