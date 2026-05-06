import mongoose, { Document, Schema } from 'mongoose';
import type { IAddress } from './User.js';

export interface ICompany extends Document {
  owner: mongoose.Types.ObjectId;
  name: string;
  cif: string;
  address?: IAddress;
  logo?: string;
  isFreelance: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    cif: { type: String, required: true, unique: true, trim: true },
    address: {
      street: { type: String, trim: true },
      number: { type: String, trim: true },
      postal: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
    },
    logo: { type: String },
    isFreelance: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Company = mongoose.model<ICompany>('Company', companySchema);
