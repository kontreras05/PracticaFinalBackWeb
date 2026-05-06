import mongoose, { Document, Schema, Model } from 'mongoose';
import AppError from '../utils/AppError.js';
import { applySoftDelete } from '../utils/softDelete.js';

interface IWorker {
  name?: string;
  hours?: number;
}

export interface IDeliveryNote extends Document {
  user: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  format: 'material' | 'hours';
  description?: string;
  workDate: Date;
  material?: string;
  quantity?: number;
  unit?: string;
  hours?: number;
  workers?: IWorker[];
  signed: boolean;
  signedAt?: Date;
  signatureUrl?: string;
  pdfUrl?: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IDeliveryNoteModel extends Model<IDeliveryNote> {
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IDeliveryNote>['find']>;
}

const workerSchema = new Schema<IWorker>(
  { name: { type: String, trim: true }, hours: { type: Number } },
  { _id: false }
);

const deliveryNoteSchema = new Schema<IDeliveryNote>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    format: { type: String, enum: ['material', 'hours'], required: true },
    description: { type: String, trim: true },
    workDate: { type: Date, required: true },
    material: {
      type: String,
      trim: true,
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
    hours: {
      type: Number,
      required: function (this: { format: string }) { return this.format === 'hours'; },
    },
    workers: [workerSchema],
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    signatureUrl: { type: String },
    pdfUrl: { type: String },
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

deliveryNoteSchema.pre<IDeliveryNote>('save', async function () {
  if (!this.isNew && !this.isModified('signed') && this.signed) {
    throw AppError.conflict('No se puede modificar un albarán firmado.');
  }
});

deliveryNoteSchema.index({ company: 1, client: 1 });
deliveryNoteSchema.index({ company: 1, project: 1 });
deliveryNoteSchema.index({ signed: 1 });
deliveryNoteSchema.index({ workDate: 1 });

applySoftDelete(deliveryNoteSchema);

export const DeliveryNote = mongoose.model<IDeliveryNote, IDeliveryNoteModel>(
  'DeliveryNote',
  deliveryNoteSchema
);
