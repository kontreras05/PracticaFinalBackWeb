import mongoose from 'mongoose';

/**
 * Modelo de Compañía (Company)
 * Representa a la empresa a la que pertenecen los usuarios.
 */
const companySchema = new mongoose.Schema({
  // Usuario administrador encargado/creador de la empresa
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Datos legales de la entidad
  name: {
    type: String,
    required: true,
    trim: true
  },
  cif: {
    type: String,
    required: true,
    unique: true, // El CIF debe ser único por empresa
    trim: true
  },

  // Dirección fiscal de la empresa
  address: {
    street: { type: String, trim: true },
    number: { type: String, trim: true },
    postal: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true }
  },

  // Almacena la URL o path del logo de la empresa (gestión vía Multer)
  logo: {
    type: String
  },

  // Define si la empresa es un autónomo (isFreelance: true)
  isFreelance: {
    type: Boolean,
    default: false
  },

  // Control de Borrado Lógico
  deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Habilita campos createdAt y updatedAt automáticamente
});

export const Company = mongoose.model('Company', companySchema);
