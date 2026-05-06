/**
 * Importamos Zod, una librería para la validación y declaración de esquemas en TypeScript.
 * Se utiliza para validar que los datos recibidos en las peticiones (req.body, req.query, req.params)
 * tengan el formato y los tipos correctos antes de llegar al controlador.
 */
import { z } from 'zod';

/**
 * Esquema base para validar que un string sea un ObjectId válido de MongoDB.
 * Se asegura que tenga exactamente 24 caracteres hexadecimales.
 */
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido');

/**
 * Esquema de validación para direcciones (address).
 * Todos los campos son opcionales y se les aplica un trim() para borrar espacios iniciales/finales.
 */
const addressSchema = z
  .object({
    street: z.string().trim().optional(), // Calle
    number: z.string().trim().optional(), // Número
    postal: z.string().trim().optional(), // Código postal
    city: z.string().trim().optional(),   // Ciudad
    province: z.string().trim().optional(),// Provincia
  })
  .optional(); // Toda la dirección en sí es opcional

/**
 * Agrupamos los campos principales para la validación del cuerpo (body) de un Cliente.
 * Esto nos permite reutilizar estos campos tanto al crear como al actualizar.
 */
const clientBodyFields = {
  // El nombre es un string obligatorio con al menos 1 caracter
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  // El CIF es un string obligatorio
  cif: z.string().trim().min(1, 'El CIF es obligatorio'),
  // El email puede ser un email válido, opcional, o puede venir como string vacío (literal '')
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  // Teléfono opcional
  phone: z.string().trim().optional(),
  // Dirección que reutiliza el esquema de arriba
  address: addressSchema,
};

/**
 * Esquema para VALIDAR LA CREACIÓN de un cliente.
 * Exige que req.body cumpla con los campos de 'clientBodyFields'.
 */
export const createClientSchema = z.object({
  body: z.object(clientBodyFields),
});

/**
 * Esquema para VALIDAR LA ACTUALIZACIÓN de un cliente.
 */
export const updateClientSchema = z.object({
  // Transformamos todos los campos a .partial() (hace que todos los campos sean opcionales)
  body: z
    .object(clientBodyFields)
    .partial()
    // refine() permite añadir validación lógica a todo el objeto.
    // Aquí verificamos que se envíe al menos un campo a modificar.
    .refine(
      (data) => Object.keys(data).length > 0,
      'Se requiere al menos un campo para actualizar'
    ),
  // También validamos que el parámetro de ruta (req.params.id) sea un Mongo ID válido
  params: z.object({ id: mongoId }),
});

/**
 * Esquema para VALIDAR LA BÚSQUEDA / LISTADO de clientes.
 * Se aplica sobre req.query (los parámetros en la URL, ej: ?page=1&limit=10).
 */
export const listClientsQuerySchema = z.object({
  query: z.object({
    // coerce.number() intenta convertir el valor de la query (que llega como string) a número.
    // Además, debe ser positivo y por defecto es 1 si no se envía.
    page: z.coerce.number().int().positive().default(1),
    // Límite por página: máximo 100 y por defecto 10
    limit: z.coerce.number().int().positive().max(100).default(10),
    // Buscar por nombre opcionalmente
    name: z.string().trim().optional(),
    // Parámetro de ordenación opcional
    sort: z.string().trim().optional(),
  }),
});

/**
 * Esquema general para validar que cualquier ruta que reciba un ID por parámetro lo tenga en formato Mongo.
 */
export const idParamSchema = z.object({
  params: z.object({ id: mongoId }),
});

/**
 * Extraemos los tipos de TypeScript automáticamente desde los esquemas Zod.
 * Esto evita tener que escribir una "interface" manual y mantiene código y tipos sincronizados.
 */
export type CreateClientInput = z.infer<typeof createClientSchema>['body'];
export type UpdateClientInput = z.infer<typeof updateClientSchema>['body'];
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>['query'];
