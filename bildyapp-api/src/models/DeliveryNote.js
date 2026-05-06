import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';
import { applySoftDelete } from '../utils/softDelete.js';

const workerSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  hours: { type: Number }
}, { _id: false });

const deliveryNoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  format: { type: String, enum: ['material', 'hours'], required: true },
  description: { type: String, trim: true },
  workDate: { type: Date, required: true },

  // Campos para format: 'material'
  material: {
    type: String,
    trim: true,
    required: function () { return this.format === 'material'; }
  },
  quantity: {
    type: Number,
    required: function () { return this.format === 'material'; }
  },
  unit: {
    type: String,
    trim: true,
    required: function () { return this.format === 'material'; }
  },

  // Campos para format: 'hours'
  hours: {
    type: Number,
    required: function () { return this.format === 'hours'; }
  },
  workers: [workerSchema],

  // Firma
  signed: { type: Boolean, default: false },
  signedAt: { type: Date },
  signatureUrl: { type: String },
  pdfUrl: { type: String },

  deleted: { type: Boolean, default: false, index: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Bloquear modificaciones una vez firmado
deliveryNoteSchema.pre('save', function (next) {
  if (!this.isNew && !this.isModified('signed') && this.signed) {
    return next(AppError.conflict('No se puede modificar un albarán firmado.'));
  }
  next();
});

deliveryNoteSchema.index({ company: 1, client: 1 });
deliveryNoteSchema.index({ company: 1, project: 1 });
deliveryNoteSchema.index({ signed: 1 });
deliveryNoteSchema.index({ workDate: 1 });

applySoftDelete(deliveryNoteSchema);

export const DeliveryNote = mongoose.model('DeliveryNote', deliveryNoteSchema);
