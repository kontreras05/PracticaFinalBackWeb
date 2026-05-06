import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

const addressSchema = z.object({
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  postal: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: z.string().trim().optional(),
}).optional();

const clientBodyFields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  cif: z.string().trim().min(1, 'El CIF es obligatorio'),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  address: addressSchema,
};

export const createClientSchema = z.object({
  body: z.object(clientBodyFields),
});

export const updateClientSchema = z.object({
  body: z.object(clientBodyFields).partial().refine(
    (data) => Object.keys(data).length > 0,
    'Se requiere al menos un campo para actualizar'
  ),
  params: z.object({ id: mongoId }),
});

export const listClientsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    name: z.string().trim().optional(),
    sort: z.string().trim().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});
