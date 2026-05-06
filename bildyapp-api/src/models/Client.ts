/**
 * Importamos las clases y tipos necesarios de Mongoose para construir esquemas, documentos y modelos.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
// Importamos una función utilitaria para aplicar borrado lógico (soft delete) en vez de borrado real
import { applySoftDelete } from '../utils/softDelete.js';
// Importamos la interfaz IAddress desde el modelo User para reutilizar su definición
import type { IAddress } from './User.js';

/**
 * Interfaz que define la estructura del documento 'Client' (Cliente) en MongoDB.
 * Asegura que TypeScript conozca todos los campos que existirán.
 */
export interface IClient extends Document {
  // Referencia al ID del usuario creador o asociado
  user: mongoose.Types.ObjectId;
  // Referencia al ID de la empresa a la que pertenece este cliente
  company: mongoose.Types.ObjectId;
  // Nombre del cliente
  name: string;
  // Código de identificación fiscal del cliente
  cif: string;
  // Correo electrónico de contacto (opcional)
  email?: string;
  // Teléfono de contacto (opcional)
  phone?: string;
  // Dirección física del cliente utilizando la interfaz IAddress (opcional)
  address?: IAddress;
  // Bandera para indicar si el cliente está borrado lógicamente
  deleted: boolean;
  // Fecha de creación del registro
  createdAt: Date;
  // Fecha de la última actualización del registro
  updatedAt: Date;
}

/**
 * Interfaz para el modelo extendido, útil para agregar métodos personalizados a nivel del modelo,
 * en este caso un método para encontrar registros borrados lógicamente.
 */
interface IClientModel extends Model<IClient> {
  // Función para buscar documentos excluidos usando el filtro de "deleted"
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IClient>['find']>;
}

/**
 * Esquema separado solo para la dirección (address).
 * Al poner { _id: false }, evitamos que Mongoose genere un ID por cada dirección anidada.
 */
const addressSchema = new Schema<IAddress>(
  {
    street: { type: String, trim: true }, // Calle
    number: { type: String, trim: true }, // Número de la calle/puerta
    postal: { type: String, trim: true }, // Código postal
    city: { type: String, trim: true },   // Ciudad
    province: { type: String, trim: true }, // Provincia
  },
  { _id: false } // No crear ObjectId interno
);

/**
 * Esquema principal para el modelo Client.
 * Describe cómo se guardarán y validarán los datos en la base de datos.
 */
const clientSchema = new Schema<IClient>(
  {
    // 'user' hace referencia obligatoria a la colección de usuarios
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // 'company' hace referencia obligatoria a la colección de empresas
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    // El nombre es obligatorio y se le aplica trim (elimina espacios a los lados)
    name: { type: String, required: true, trim: true },
    // El CIF es obligatorio y se le aplica trim
    cif: { type: String, required: true, trim: true },
    // Correo: opcional, se recorta y se pasa a minúsculas automáticamente
    email: { type: String, trim: true, lowercase: true },
    // Teléfono: opcional, se recorta
    phone: { type: String, trim: true },
    // Adjuntamos el subesquema addressSchema
    address: addressSchema,
    // La propiedad deleted sirve para no borrar los datos definitivamente (Soft Delete)
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    // Mongoose gestiona createdAt y updatedAt automáticamente
    timestamps: true,
    // Permite que las propiedades virtuales se envíen cuando el documento pasa a formato JSON u Objeto literal
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * CREACIÓN DE ÍNDICES:
 * Los índices ayudan a acelerar consultas en la base de datos o asegurar restricciones.
 */

// Se asegura que no existan dos clientes con el mismo CIF en una MISMA empresa.
// Además, la regla se aplica solo a aquellos que NO están borrados lógicamente (partialFilterExpression).
clientSchema.index(
  { company: 1, cif: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);

// Índice para mejorar la velocidad al buscar clientes de una empresa por su estado 'deleted'
clientSchema.index({ company: 1, deleted: 1 });

// Índice de texto sobre el nombre para poder realizar búsquedas (text search) de forma más eficiente
clientSchema.index({ name: 'text' });

/**
 * Se aplica el plugin o función auxiliar 'applySoftDelete' a nuestro esquema.
 * Esto modifica el comportamiento por defecto de 'find', 'findOne', etc.,
 * para ignorar los documentos con deleted: true, a menos que especifiquemos lo contrario.
 */
applySoftDelete(clientSchema);

/**
 * Exportamos el modelo compilado con la interfaz IClient y IClientModel.
 */
export const Client = mongoose.model<IClient, IClientModel>('Client', clientSchema);
