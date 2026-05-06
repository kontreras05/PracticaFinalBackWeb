/**
 * Importación de la librería de validación Zod.
 */
import { z } from 'zod';

/**
 * Verifica formato estándar de un ID de base de datos MongoDB.
 */
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

/**
 * Esquema de dirección (opcional).
 */
const addressSchema = z
  .object({
    street: z.string().trim().optional(),
    number: z.string().trim().optional(),
    postal: z.string().trim().optional(),
    city: z.string().trim().optional(),
    province: z.string().trim().optional(),
  })
  .optional();

/**
 * Definición central de los campos esperados al manipular un Proyecto en el body.
 */
const projectBodyFields = {
  // El nombre de proyecto es requerido
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  // El código también es requerido (ej: 'PROJ-01')
  projectCode: z.string().trim().min(1, 'El código de proyecto es obligatorio'),
  // El cliente asociado se recibe como un ObjectId
  client: mongoId.describe('ID del cliente'),
  // Añadimos dirección y email del proyecto (con posibilidad de mandar string vacío)
  address: addressSchema,
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  // Campo de notas adicionales
  notes: z.string().trim().optional(),
  // Permite desactivar/activar el proyecto explícitamente
  active: z.boolean().optional(),
};

/**
 * Validación para CREAR un proyecto.
 */
export const createProjectSchema = z.object({
  body: z.object(projectBodyFields),
});

/**
 * Validación para ACTUALIZAR un proyecto.
 * Al usar '.partial()', todos los campos en 'projectBodyFields' se vuelven opcionales,
 * porque para actualizar podemos enviar solo uno o varios datos.
 */
export const updateProjectSchema = z.object({
  body: z
    .object(projectBodyFields)
    .partial()
    .refine(
      (data) => Object.keys(data).length > 0,
      'Se requiere al menos un campo para actualizar' // Evita envíos de cuerpos vacíos
    ),
  params: z.object({ id: mongoId }), // Además, la URL debe traer un ID válido
});

/**
 * Validación para LISTAR o filtrar proyectos.
 */
export const listProjectsQuerySchema = z.object({
  query: z.object({
    // Variables de paginación transformadas de string a número entero positivo
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    // Filtros opcionales
    client: mongoId.optional(),
    name: z.string().trim().optional(),
    active: z.coerce.boolean().optional(), // Coerción de "true" a boolean real
    sort: z.string().trim().optional(),
  }),
});

/**
 * Validador para endpoints que simplemente requieren el ID del proyecto.
 */
export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});

/**
 * Tipos de Typescript exportados inferidos desde los validadores para usar en controladores.
 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>['query'];
