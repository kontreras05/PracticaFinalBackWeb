/**
 * Importamos las clases necesarias desde Mongoose para interactuar con MongoDB.
 */
import mongoose, { Document, Schema } from 'mongoose';

/**
 * Interfaz para definir la estructura de direcciones.
 * Se reutiliza en múltiples modelos.
 */
export interface IAddress {
  street?: string;   // Calle
  number?: string;   // Número
  postal?: string;   // Código Postal
  city?: string;     // Ciudad
  province?: string; // Provincia
}

/**
 * Interfaz TypeScript que define cómo luce un Usuario (User) dentro de la base de datos.
 * Extiende de Document de Mongoose para incluir propiedades como _id.
 */
export interface IUser extends Document {
  // Correo electrónico (sirve como usuario de login)
  email: string;
  // Contraseña encriptada
  password: string;
  // Nombre de pila del usuario (opcional)
  name?: string;
  // Apellidos del usuario (opcional)
  lastName?: string;
  // NIF / DNI del usuario (opcional)
  nif?: string;
  // Rol que define los permisos ('admin' tiene permisos completos, 'guest' limitados)
  role: 'admin' | 'guest';
  // Estado de la cuenta (pending si falta validar email, verified si ya está activa)
  status: 'pending' | 'verified';
  // Código numérico o string temporal usado para verificar el correo electrónico
  verificationCode?: string;
  // Cantidad de veces que se ha intentado enviar o validar el código
  verificationAttempts: number;
  // A qué empresa pertenece el usuario
  company?: mongoose.Types.ObjectId;
  // Dirección física del usuario
  address?: IAddress;
  // Indicador de borrado lógico
  deleted: boolean;
  // Propiedad virtual (no se guarda en BD) para concatenar nombre y apellido
  fullName?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Construcción del Esquema de Usuario para Mongoose.
 * Aquí declaramos qué datos son obligatorios, cuáles tienen valores por defecto y cuáles son únicos.
 */
const userSchema = new Schema<IUser>(
  {
    // El email debe ser único y lo indexamos porque frecuentemente buscaremos usuarios por email para loguearse.
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    // Contraseña cifrada, es obligatoria
    password: { type: String, required: true },
    // Datos personales
    name: { type: String, trim: true },
    lastName: { type: String, trim: true },
    nif: { type: String, trim: true },
    // Role del usuario por defecto
    role: { type: String, enum: ['admin', 'guest'], default: 'admin', index: true },
    // Todo usuario recién registrado nace en estado pendiente
    status: { type: String, enum: ['pending', 'verified'], default: 'pending', index: true },
    // Código de verificación temporal
    verificationCode: { type: String },
    // Intentos de verificación permitidos, arranca en 3
    verificationAttempts: { type: Number, default: 3 },
    // Relación con una empresa (opcional al registrarse, pero usualmente se llena luego o en el momento)
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    // Estructura embebida de la dirección
    address: {
      street: { type: String, trim: true },
      number: { type: String, trim: true },
      postal: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
    },
    // Bandera para borrar lógicamente al usuario si así se desea
    deleted: { type: Boolean, default: false },
  },
  {
    // Agregar createdAt y updatedAt automáticamente
    timestamps: true,
    // Garantiza que cuando convertimos de BD a objeto JSON/JS se incluyan los campos virtuales
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Propiedad VIRTUAL: 'fullName'.
 * Esto no ocupa espacio en la base de datos, sino que se calcula "al vuelo" cuando
 * se pide la información del usuario. Retorna el nombre y apellido concatenados.
 */
userSchema.virtual('fullName').get(function (this: IUser) {
  // Une el nombre y el apellido y le quita espacios extra a los extremos
  const full = `${this.name ?? ''} ${this.lastName ?? ''}`.trim();
  // Si existe contenido lo devuelve, si está vacío retorna indefinido
  return full || undefined;
});

/**
 * Exportamos el modelo compilado Mongoose de User.
 */
export const User = mongoose.model<IUser>('User', userSchema);
