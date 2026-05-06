/**
 * Importamos las clases base de Mongoose para manipular esquemas y modelos.
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
// Importamos la clase AppError personalizada para lanzar errores propios
import AppError from '../utils/AppError.js';
// Función para aplicar borrado lógico
import { applySoftDelete } from '../utils/softDelete.js';

/**
 * Interfaz que define la estructura para un trabajador (Worker)
 * que se asocia a un albarán.
 */
interface IWorker {
  // Nombre del trabajador (opcional)
  name?: string;
  // Horas trabajadas por este trabajador (opcional)
  hours?: number;
}

/**
 * Interfaz principal del Albarán (DeliveryNote)
 * Define todos los campos posibles en el documento.
 */
export interface IDeliveryNote extends Document {
  // ID del usuario que creó el albarán
  user: mongoose.Types.ObjectId;
  // ID de la empresa a la que pertenece el albarán
  company: mongoose.Types.ObjectId;
  // ID del cliente asociado al albarán
  client: mongoose.Types.ObjectId;
  // ID del proyecto al cual se imputa este albarán
  project: mongoose.Types.ObjectId;
  // Formato del albarán: puede ser por 'material' o por 'horas'
  format: 'material' | 'hours';
  // Descripción general del trabajo o material
  description?: string;
  // Fecha en la que se realizó el trabajo o entrega
  workDate: Date;
  // Si format === 'material', aquí se describe el material
  material?: string;
  // Si format === 'material', indica la cantidad
  quantity?: number;
  // Si format === 'material', indica la unidad de medida (kg, m, uds, etc)
  unit?: string;
  // Si format === 'hours', indica el total de horas generales
  hours?: number;
  // Lista de trabajadores específicos con sus horas (subdocumentos)
  workers?: IWorker[];
  // Bandera que indica si el albarán ya fue firmado por el cliente
  signed: boolean;
  // Fecha exacta en la que se firmó
  signedAt?: Date;
  // URL o ruta al archivo de la firma del cliente (imagen)
  signatureUrl?: string;
  // URL o ruta al documento PDF generado de este albarán
  pdfUrl?: string;
  // Bandera para el borrado lógico (soft delete)
  deleted: boolean;
  // Fecha de creación
  createdAt: Date;
  // Fecha de actualización
  updatedAt: Date;
}

/**
 * Interfaz extendida para el modelo, incluye funciones personalizadas
 * como el findDeleted para buscar documentos "borrados" lógicamente.
 */
interface IDeliveryNoteModel extends Model<IDeliveryNote> {
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IDeliveryNote>['find']>;
}

/**
 * Subesquema para la lista de trabajadores (workers).
 * Mongoose no le asignará un _id por defecto a cada trabajador gracias al _id: false.
 */
const workerSchema = new Schema<IWorker>(
  { 
    name: { type: String, trim: true }, // Nombre sin espacios extra
    hours: { type: Number } // Horas (número)
  },
  { _id: false }
);

/**
 * Esquema principal del Albarán (DeliveryNote)
 */
const deliveryNoteSchema = new Schema<IDeliveryNote>(
  {
    // Las referencias a otras colecciones (User, Company, Client, Project) son obligatorias
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    // El formato debe ser estrictamente 'material' o 'hours'
    format: { type: String, enum: ['material', 'hours'], required: true },
    // Descripción de texto opcional
    description: { type: String, trim: true },
    // Fecha de trabajo obligatoria
    workDate: { type: Date, required: true },
    // Campos condicionales dependiendo del formato 'material'
    material: {
      type: String,
      trim: true,
      // Se exige que 'material' exista SOLO si el formato es 'material'
      required: function (this: { format: string }) { return this.format === 'material'; },
    },
    quantity: {
      type: Number,
      required: function (this: { format: string }) { return this.format === 'material'; },
    },
    unit: {
      type: String,
      trim: true,
      required: function (this: { format: string }) { return this.format === 'material'; },
    },
    // Campos condicionales dependiendo del formato 'hours'
    hours: {
      type: Number,
      // Se exige que 'hours' exista SOLO si el formato es 'hours'
      required: function (this: { format: string }) { return this.format === 'hours'; },
    },
    // Arreglo de trabajadores según el subesquema creado antes
    workers: [workerSchema],
    // Control de firmas: por defecto es false
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    // URLs donde se guarda la firma y el PDF, opcionales
    signatureUrl: { type: String },
    pdfUrl: { type: String },
    // Propiedad para el borrado lógico
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // Auto createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Middleware 'pre' save (hook) que se ejecuta antes de guardar el documento.
 * Si el documento no es nuevo, no se está modificando el campo 'signed'
 * pero ya está firmado (signed === true), bloqueamos la edición
 * lanzando un error 409 Conflict. No se puede editar un albarán que ya se firmó.
 */
deliveryNoteSchema.pre<IDeliveryNote>('save', async function () {
  if (!this.isNew && !this.isModified('signed') && this.signed) {
    throw AppError.conflict('No se puede modificar un albarán firmado.');
  }
});

/**
 * CREACIÓN DE ÍNDICES:
 * Para agilizar las búsquedas más comunes.
 */
// Buscar todos los albaranes de una empresa para un cliente concreto
deliveryNoteSchema.index({ company: 1, client: 1 });
// Buscar todos los albaranes de una empresa para un proyecto concreto
deliveryNoteSchema.index({ company: 1, project: 1 });
// Índice por estado de firma para encontrar albaranes pendientes/firmados rápidamente
deliveryNoteSchema.index({ signed: 1 });
// Índice por fecha de trabajo, muy útil para reportes o listados cronológicos
deliveryNoteSchema.index({ workDate: 1 });

/**
 * Aplicamos el plugin o función para el borrado lógico.
 */
applySoftDelete(deliveryNoteSchema);

/**
 * Exportamos el modelo de DeliveryNote para poder usarlo en nuestros controladores.
 */
export const DeliveryNote = mongoose.model<IDeliveryNote, IDeliveryNoteModel>(
  'DeliveryNote',
  deliveryNoteSchema
);
