import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

const commonFields = {
  client: mongoId.describe('ID del cliente'),
  project: mongoId.describe('ID del proyecto'),
  description: z.string().trim().optional(),
  workDate: z.coerce.date({ error: 'Fecha de trabajo inválida' }),
};

const materialSchema = z.object({
  ...commonFields,
  format: z.literal('material'),
  material: z.string().trim().min(1, 'El material es obligatorio'),
  quantity: z.number({ error: 'La cantidad es obligatoria' }).positive('La cantidad debe ser positiva'),
  unit: z.string().trim().min(1, 'La unidad es obligatoria'),
});

const hoursSchema = z.object({
  ...commonFields,
  format: z.literal('hours'),
  hours: z.number({ error: 'Las horas son obligatorias' }).positive('Las horas deben ser positivas'),
  workers: z.array(
    z.object({
      name: z.string().trim().min(1, 'El nombre del trabajador es obligatorio'),
      hours: z.number().positive('Las horas deben ser positivas'),
    })
  ).optional(),
});

export const createDeliveryNoteSchema = z.object({
  body: z.discriminatedUnion('format', [materialSchema, hoursSchema]),
});

export const listDeliveryNotesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    project: mongoId.optional(),
    client: mongoId.optional(),
    format: z.enum(['material', 'hours']).optional(),
    signed: z.preprocess(
      (v) => (v === 'true' ? true : v === 'false' ? false : v),
      z.boolean().optional()
    ),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sort: z.string().trim().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});

// signDeliveryNoteSchema: no valida body (firma viene como archivo Multer), solo el id del param
export const signDeliveryNoteSchema = z.object({
  params: z.object({ id: mongoId }),
});
