import mongoose, { Document, Schema, Model } from 'mongoose';
import { applySoftDelete } from '../utils/softDelete.js';
import type { IAddress } from './User.js';

export interface IProject extends Document {
  user: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  name: string;
  projectCode: string;
  address?: IAddress;
  email?: string;
  notes?: string;
  active: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IProjectModel extends Model<IProject> {
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IProject>['find']>;
}

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

const projectSchema = new Schema<IProject>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    name: { type: String, required: true, trim: true },
    projectCode: { type: String, required: true, trim: true },
    address: addressSchema,
    email: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.index(
  { company: 1, projectCode: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);
projectSchema.index({ company: 1, client: 1 });
projectSchema.index({ active: 1 });

applySoftDelete(projectSchema);

export const Project = mongoose.model<IProject, IProjectModel>('Project', projectSchema);
