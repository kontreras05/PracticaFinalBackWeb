/**
 * Importamos mongoose y los tipos necesarios para definir el esquema de la base de datos.
 * Document y Schema son proporcionados por mongoose.
 */
import mongoose, { Document, Schema } from 'mongoose';
// Importamos el tipo IAddress desde el modelo User para reutilizar su estructura
import type { IAddress } from './User.js';

/**
 * Definimos la interfaz ICompany, la cual hereda de Document de Mongoose.
 * Esta interfaz describe la forma de los documentos de empresa (Company) en la base de datos,
 * asegurando el tipado estático en TypeScript.
 */
export interface ICompany extends Document {
  // Referencia al ID del usuario que es propietario de la empresa
  owner: mongoose.Types.ObjectId;
  // Nombre de la empresa
  name: string;
  // Código de identificación fiscal de la empresa
  cif: string;
  // Dirección de la empresa (es opcional)
  address?: IAddress;
  // URL o ruta al logo de la empresa (es opcional)
  logo?: string;
  // Indica si el registro pertenece a un trabajador autónomo (freelance)
  isFreelance: boolean;
  // Bandera para indicar si la empresa ha sido eliminada lógicamente (soft delete)
  deleted: boolean;
  // Fecha de creación del documento (generada automáticamente)
  createdAt: Date;
  // Fecha de la última actualización del documento (generada automáticamente)
  updatedAt: Date;
}

/**
 * Definimos el esquema (Schema) de la empresa para Mongoose.
 * Este esquema mapea las propiedades a tipos y define reglas de validación en la base de datos.
 */
const companySchema = new Schema<ICompany>(
  {
    // El propietario es un ObjectId que hace referencia obligatoria al modelo 'User'
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // El nombre de la empresa es un texto obligatorio y se eliminan espacios en blanco al inicio y final
    name: { type: String, required: true, trim: true },
    // El CIF es obligatorio, debe ser único en la colección y también se recorta
    cif: { type: String, required: true, unique: true, trim: true },
    // Estructura anidada para la dirección, todos los campos son textos opcionales y se recortan
    address: {
      street: { type: String, trim: true }, // Calle
      number: { type: String, trim: true }, // Número de puerta/edificio
      postal: { type: String, trim: true }, // Código postal
      city: { type: String, trim: true },   // Ciudad
      province: { type: String, trim: true },// Provincia
    },
    // El logo se almacena como una cadena de texto (generalmente una URL)
    logo: { type: String },
    // Por defecto, asumimos que no es autónomo a menos que se indique lo contrario
    isFreelance: { type: Boolean, default: false },
    // La eliminación lógica (soft delete) se marca en falso por defecto al crear un documento
    deleted: { type: Boolean, default: false },
  },
  { 
    // Habilita la creación automática de campos createdAt y updatedAt cada vez que se guarda o actualiza
    timestamps: true 
  }
);

/**
 * Exportamos el modelo compilado de Mongoose con el nombre 'Company'.
 * Esto permite utilizar el modelo para realizar operaciones CRUD (crear, leer, actualizar, borrar)
 * sobre la colección 'companies' en MongoDB.
 */
export const Company = mongoose.model<ICompany>('Company', companySchema);
