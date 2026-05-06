import mongoose from 'mongoose';

/**
 * Modelo de Usuario (User)
 * Almacena la información de autenticación, perfil personal y vinculación con empresa.
 */
const userSchema = new mongoose.Schema({
  // Identificación básica
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true // Indexado para búsquedas rápidas por email
  },
  password: {
    type: String,
    required: true
  },
  
  // Datos personales (se completan en el onboarding)
  name: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  nif: {
    type: String,
    trim: true
  },

  // Gestión de roles y permisos
  role: {
    type: String,
    enum: ['admin', 'guest'],
    default: 'admin',
    index: true
  },

  // Estado de verificación del email
  status: {
    type: String,
    enum: ['pending', 'verified'],
    default: 'pending',
    index: true
  },
  verificationCode: {
    type: String // Código de 6 dígitos autogenerado
  },
  verificationAttempts: {
    type: Number,
    default: 3 // Límite de 3 intentos para validar código
  },

  // Relación con el modelo Company
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    index: true
  },

  // Dirección física del usuario (opcional o para autónomos)
  address: {
    street: { type: String, trim: true },
    number: { type: String, trim: true },
    postal: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true }
  },

  // Campo para Borrado Lógico (Soft Delete)
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  toJSON: { virtuals: true }, // Asegura que los virtuals se incluyan en respuestas JSON
  toObject: { virtuals: true }
});

/**
 * Propiedad Virtual: fullName
 * No se guarda en la base de datos, se calcula dinámicamente al consultar.
 */
userSchema.virtual('fullName').get(function() {
  const fName = this.name || '';
  const lName = this.lastName || '';
  const full = `${fName} ${lName}`.trim();
  return full || undefined;
});

export const User = mongoose.model('User', userSchema);
