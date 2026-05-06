import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress {
  street?: string;
  number?: string;
  postal?: string;
  city?: string;
  province?: string;
}

export interface IUser extends Document {
  email: string;
  password: string;
  name?: string;
  lastName?: string;
  nif?: string;
  role: 'admin' | 'guest';
  status: 'pending' | 'verified';
  verificationCode?: string;
  verificationAttempts: number;
  company?: mongoose.Types.ObjectId;
  address?: IAddress;
  deleted: boolean;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, trim: true },
    lastName: { type: String, trim: true },
    nif: { type: String, trim: true },
    role: { type: String, enum: ['admin', 'guest'], default: 'admin', index: true },
    status: { type: String, enum: ['pending', 'verified'], default: 'pending', index: true },
    verificationCode: { type: String },
    verificationAttempts: { type: Number, default: 3 },
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    address: {
      street: { type: String, trim: true },
      number: { type: String, trim: true },
      postal: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
    },
    deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('fullName').get(function (this: IUser) {
  const full = `${this.name ?? ''} ${this.lastName ?? ''}`.trim();
  return full || undefined;
});

export const User = mongoose.model<IUser>('User', userSchema);
