import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploadLogo } from '../middleware/upload.js';

import {
  register,
  validateEmail,
  login,
  updatePersonalData,
  updateCompanyData,
  uploadUserLogo,
  getUser,
  refreshToken,
  logout,
  deleteUser,
  updatePassword,
  inviteUser
} from '../controllers/user.controller.js';

import {
  registerSchema,
  validateAccountSchema,
  loginSchema,
  onboardingPersonalSchema,
  onboardingCompanySchema,
  updatePasswordSchema,
  inviteUserSchema
} from '../validators/user.validator.js';

const router = Router();

// ---- RUTAS PÚBLICAS ----

/**
 * @openapi
 * /user/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     description: Crea un usuario con email y contraseña. Envía un código de 6 dígitos por email para validar la cuenta.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@ejemplo.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "MiPassword1!"
 *     responses:
 *       201:
 *         description: Usuario creado correctamente
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/register', validate(registerSchema), register);

/**
 * @openapi
 * /user/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: Devuelve un par de tokens JWT (access + refresh).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@ejemplo.com
 *               password:
 *                 type: string
 *                 example: "MiPassword1!"
 *     responses:
 *       200:
 *         description: Login correcto
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/login', validate(loginSchema), login);

/**
 * @openapi
 * /user/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token
 *     description: Intercambia un refresh token válido por un nuevo par de tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Tokens renovados
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
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/refresh', refreshToken);

// ---- RUTAS PROTEGIDAS ----
router.use(requireAuth);

/**
 * @openapi
 * /user/validation:
 *   put:
 *     tags: [User]
 *     summary: Validar cuenta por email
 *     description: Confirma el código de 6 dígitos enviado al email para activar la cuenta.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "482917"
 *     responses:
 *       200:
 *         description: Cuenta validada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Cuenta validada correctamente
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.put('/validation', validate(validateAccountSchema), validateEmail);

/**
 * @openapi
 * /user/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 *     description: Invalida el refresh token del usuario.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Sesión cerrada correctamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/logout', logout);

/**
 * @openapi
 * /user/register:
 *   put:
 *     tags: [User]
 *     summary: Completar datos personales (onboarding paso 1)
 *     description: Actualiza nombre, apellidos y NIF del usuario autenticado.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, lastName, nif]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fernando
 *               lastName:
 *                 type: string
 *                 example: Contreras
 *               nif:
 *                 type: string
 *                 example: 12345678A
 *     responses:
 *       200:
 *         description: Datos personales actualizados
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.put('/register', validate(onboardingPersonalSchema), updatePersonalData);

/**
 * @openapi
 * /user/company:
 *   patch:
 *     tags: [User]
 *     summary: Registrar empresa (onboarding paso 2)
 *     description: |
 *       Crea o actualiza los datos de la empresa del usuario. Si `isFreelance` es `true`,
 *       los datos de empresa se toman del propio usuario. Si es `false`, se requieren
 *       `name`, `cif` y `address`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [isFreelance, name, cif, address]
 *                 properties:
 *                   isFreelance:
 *                     type: boolean
 *                     example: false
 *                   name:
 *                     type: string
 *                     example: Mi Empresa S.L.
 *                   cif:
 *                     type: string
 *                     example: B12345678
 *                   address:
 *                     $ref: '#/components/schemas/Address'
 *               - type: object
 *                 required: [isFreelance]
 *                 properties:
 *                   isFreelance:
 *                     type: boolean
 *                     example: true
 *     responses:
 *       200:
 *         description: Empresa registrada correctamente
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
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *                     role:
 *                       type: string
 *                       example: admin
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.patch('/company', validate(onboardingCompanySchema), updateCompanyData);

/**
 * @openapi
 * /user/logo:
 *   patch:
 *     tags: [User]
 *     summary: Subir logo de usuario
 *     description: Sube una imagen como logo del perfil. Se guarda en disco en /uploads.
 *     security:
 *       - bearerAuth: []
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
 *                 description: Imagen (JPEG, PNG, WebP — máx. 2 MB)
 *     responses:
 *       200:
 *         description: Logo actualizado
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
 *                     logo:
 *                       type: string
 *                       example: uploads/logo-abc123.jpg
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.patch('/logo', uploadLogo, uploadUserLogo);

/**
 * @openapi
 * /user/:
 *   get:
 *     tags: [User]
 *     summary: Obtener perfil del usuario autenticado
 *     description: Devuelve los datos del usuario junto con su empresa (populate).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.get('/', getUser);

/**
 * @openapi
 * /user/password:
 *   put:
 *     tags: [User]
 *     summary: Cambiar contraseña
 *     description: Verifica la contraseña actual antes de actualizar. Devuelve nuevos tokens.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "OldPassword1!"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "NewPassword2!"
 *     responses:
 *       200:
 *         description: Contraseña actualizada — devuelve nuevos tokens
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.put('/password', validate(updatePasswordSchema), updatePassword);

/**
 * @openapi
 * /user/:
 *   delete:
 *     tags: [User]
 *     summary: Eliminar cuenta
 *     description: |
 *       Elimina la cuenta del usuario autenticado.
 *       - `?soft=true` (por defecto): borrado lógico — el usuario queda marcado como eliminado.
 *       - `?soft=false`: borrado físico permanente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: soft
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Borrado lógico (true) o físico (false)
 *     responses:
 *       204:
 *         description: Cuenta eliminada — sin contenido
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.delete('/', deleteUser);

/**
 * @openapi
 * /user/invite:
 *   post:
 *     tags: [User]
 *     summary: Invitar usuario (solo admin)
 *     description: Crea un usuario con rol `guest` y envía sus credenciales por email. Solo accesible por administradores.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: nuevo@empresa.com
 *               name:
 *                 type: string
 *                 example: María
 *               lastName:
 *                 type: string
 *                 example: López
 *     responses:
 *       201:
 *         description: Invitación enviada
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/invite', restrictTo('admin'), validate(inviteUserSchema), inviteUser);

export default router;
