/**
 * Importación de Zod para validaciones y tipados en tiempo de ejecución.
 */
import { z } from 'zod';

/**
 * Expresión regular que asegura que los IDs de MongoDB sean válidos.
 */
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

/**
 * Campos comunes compartidos por cualquier tipo de albarán (material o por horas).
 */
const commonFields = {
  client: mongoId.describe('ID del cliente'),
  project: mongoId.describe('ID del proyecto'),
  // Descripción opcional del trabajo realizado
  description: z.string().trim().optional(),
  // coerce.date() intenta convertir el valor de texto a un objeto Date real de JS
  workDate: z.coerce.date(),
};

/**
 * Esquema de validación específico para albaranes en formato MATERIAL.
 * Extiende de commonFields y añade los atributos propios.
 */
const materialSchema = z.object({
  ...commonFields,
  // Obliga a que el formato sea exactamente el string 'material'
  format: z.literal('material'),
  // material, cantidad y unidad son campos obligatorios
  material: z.string().trim().min(1, 'El material es obligatorio'),
  quantity: z.number().positive('La cantidad debe ser positiva'),
  unit: z.string().trim().min(1, 'La unidad es obligatoria'),
});

/**
 * Esquema de validación específico para albaranes en formato HOURS (Horas).
 */
const hoursSchema = z.object({
  ...commonFields,
  // Obliga a que el formato sea exactamente el string 'hours'
  format: z.literal('hours'),
  hours: z.number().positive('Las horas deben ser positivas'),
  // Posibilidad de detallar individualmente horas por trabajador de forma opcional
  workers: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'El nombre del trabajador es obligatorio'),
        hours: z.number().positive('Las horas deben ser positivas'),
      })
    )
    .optional(),
});

/**
 * Validación para crear albaranes.
 * discriminatedUnion mira la propiedad 'format' para decidir qué esquema de validación aplicar
 * (si usar materialSchema o usar hoursSchema). Es muy útil para validaciones condicionales.
 */
export const createDeliveryNoteSchema = z.object({
  body: z.discriminatedUnion('format', [materialSchema, hoursSchema]),
});

/**
 * Validación para la querystring a la hora de listar albaranes.
 */
export const listDeliveryNotesQuerySchema = z.object({
  query: z.object({
    // Paginación estándar
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    // Filtrar por proyecto o cliente
    project: mongoId.optional(),
    client: mongoId.optional(),
    // Filtro por formato
    format: z.enum(['material', 'hours']).optional(),
    // z.preprocess toma el dato crudo antes de validarlo.
    // Esto es necesario porque en la querystring los booleanos viajan como strings ("true" / "false").
    signed: z.preprocess(
      (v) => (v === 'true' ? true : v === 'false' ? false : v),
      z.boolean().optional()
    ),
    // Rangos de fecha
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    // Criterio de ordenación
    sort: z.string().trim().optional(),
  }),
});

/**
 * Esquema para validar IDs enviados por parámetros en la URL.
 */
export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});

/**
 * Esquema específico para la ruta de firma de albarán (aprovechamos validando que el ID sea correcto).
 */
export const signDeliveryNoteSchema = z.object({
  params: z.object({ id: mongoId }),
});

/**
 * Tipos generados a partir de los esquemas Zod para autocompletado en TypeScript.
 */
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>['body'];
export type ListDeliveryNotesQuery = z.infer<typeof listDeliveryNotesQuerySchema>['query'];
