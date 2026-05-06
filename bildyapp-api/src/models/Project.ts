/**
 * Importaciones de Mongoose para las definiciones del esquema.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
// Función para sobreescribir métodos y lograr borrado lógico (soft delete)
import { applySoftDelete } from '../utils/softDelete.js';
// Importamos la estructura de dirección desde el usuario
import type { IAddress } from './User.js';

/**
 * Interfaz que define la estructura de un Proyecto (Project).
 */
export interface IProject extends Document {
  // Creador del proyecto
  user: mongoose.Types.ObjectId;
  // Empresa dueña del proyecto
  company: mongoose.Types.ObjectId;
  // Cliente al cual se le hace el proyecto
  client: mongoose.Types.ObjectId;
  // Nombre del proyecto
  name: string;
  // Código único interno del proyecto para esa empresa
  projectCode: string;
  // Dirección física donde se hace el proyecto (opcional)
  address?: IAddress;
  // Email de contacto específico del proyecto (opcional)
  email?: string;
  // Notas adicionales o descripción (opcional)
  notes?: string;
  // Bandera para saber si el proyecto sigue activo o ya terminó
  active: boolean;
  // Bandera de borrado lógico
  deleted: boolean;
  // Fechas automáticas
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interfaz extendida para dotar de métodos propios al modelo (ej. findDeleted).
 */
interface IProjectModel extends Model<IProject> {
  // Método que retornará documentos ignorando el filtro por defecto de "deleted: false"
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IProject>['find']>;
}

/**
 * Subesquema para guardar direcciones estructuradas, sin que genere
 * su propio ObjectID (_id: false).
 */
const addressSchema = new Schema<IAddress>(
  {
    street: { type: String, trim: true },
    number: { type: String, trim: true },
    postal: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Esquema principal para Proyecto.
 */
const projectSchema = new Schema<IProject>(
  {
    // Enlaces obligatorios a otras colecciones
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    
    // Nombre visible del proyecto
    name: { type: String, required: true, trim: true },
    // Código de referencia (ej. PRJ-2023-01)
    projectCode: { type: String, required: true, trim: true },
    
    // Dirección física
    address: addressSchema,
    // Correo de contacto (se guarda en minúsculas)
    email: { type: String, trim: true, lowercase: true },
    // Anotaciones libres
    notes: { type: String, trim: true },
    // Los proyectos nacen activos por defecto
    active: { type: Boolean, default: true },
    // Por defecto no están borrados
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    // Incluir marcas de tiempo de creación y actualización
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * CREACIÓN DE ÍNDICES:
 */

// Garantiza que el código de proyecto sea ÚNICO dentro de la misma empresa.
// Solo aplica a los proyectos que no han sido borrados (deleted != true).
projectSchema.index(
  { company: 1, projectCode: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);

// Índice para listar rápidamente los proyectos de un cliente en una empresa
projectSchema.index({ company: 1, client: 1 });

// Índice para filtrar proyectos activos vs inactivos
projectSchema.index({ active: 1 });

/**
 * Se inyecta la lógica de Soft Delete en las consultas de Mongoose.
 */
applySoftDelete(projectSchema);

/**
 * Se compila el modelo final Project, listo para su uso.
 */
export const Project = mongoose.model<IProject, IProjectModel>('Project', projectSchema);
