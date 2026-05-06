import mongoose, { Document, Schema, Model } from 'mongoose';
import { applySoftDelete } from '../utils/softDelete.js';
import type { IAddress } from './User.js';

export interface IClient extends Document {
  user: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  name: string;
  cif: string;
  email?: string;
  phone?: string;
  address?: IAddress;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IClientModel extends Model<IClient> {
  findDeleted(filter?: Record<string, unknown>): ReturnType<Model<IClient>['find']>;
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

const clientSchema = new Schema<IClient>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    cif: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: addressSchema,
    deleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

clientSchema.index(
  { company: 1, cif: 1 },
  { unique: true, partialFilterExpression: { deleted: { $ne: true } } }
);
clientSchema.index({ company: 1, deleted: 1 });
clientSchema.index({ name: 'text' });

applySoftDelete(clientSchema);

export const Client = mongoose.model<IClient, IClientModel>('Client', clientSchema);
