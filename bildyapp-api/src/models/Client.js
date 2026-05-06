import mongoose from 'mongoose';
import { applySoftDelete } from '../utils/softDelete.js';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  number: { type: String, trim: true },
  postal: { type: String, trim: true },
  city: { type: String, trim: true },
  province: { type: String, trim: true }
}, { _id: false });

const clientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true },
  cif: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: addressSchema,
  deleted: { type: Boolean, default: false, index: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unicidad (company, cif) solo para documentos no borrados
clientSchema.index(
  { company: 1, cif: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);
clientSchema.index({ company: 1, deleted: 1 });
clientSchema.index({ name: 'text' });

applySoftDelete(clientSchema);

export const Client = mongoose.model('Client', clientSchema);
