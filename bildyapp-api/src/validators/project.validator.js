import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

const addressSchema = z.object({
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  postal: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: z.string().trim().optional(),
}).optional();

const projectBodyFields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  projectCode: z.string().trim().min(1, 'El código de proyecto es obligatorio'),
  client: mongoId.describe('ID del cliente'),
  address: addressSchema,
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().trim().optional(),
  active: z.boolean().optional(),
};

export const createProjectSchema = z.object({
  body: z.object(projectBodyFields),
});

export const updateProjectSchema = z.object({
  body: z.object(projectBodyFields).partial().refine(
    (data) => Object.keys(data).length > 0,
    'Se requiere al menos un campo para actualizar'
  ),
  params: z.object({ id: mongoId }),
});

export const listProjectsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    client: mongoId.optional(),
    name: z.string().trim().optional(),
    active: z.coerce.boolean().optional(),
    sort: z.string().trim().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});
