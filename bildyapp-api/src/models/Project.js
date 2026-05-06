import mongoose from 'mongoose';
import { applySoftDelete } from '../utils/softDelete.js';

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  number: { type: String, trim: true },
  postal: { type: String, trim: true },
  city: { type: String, trim: true },
  province: { type: String, trim: true }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  name: { type: String, required: true, trim: true },
  projectCode: { type: String, required: true, trim: true },
  address: addressSchema,
  email: { type: String, trim: true, lowercase: true },
  notes: { type: String, trim: true },
  active: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false, index: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unicidad (company, projectCode) solo para documentos no borrados
projectSchema.index(
  { company: 1, projectCode: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);
projectSchema.index({ company: 1, client: 1 });
projectSchema.index({ active: 1 });

applySoftDelete(projectSchema);

export const Project = mongoose.model('Project', projectSchema);
