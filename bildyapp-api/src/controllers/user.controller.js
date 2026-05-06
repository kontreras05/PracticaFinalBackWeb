import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { notificationService } from '../services/notification.service.js';
import { config } from '../config/index.js';

const signToken = (id, secret, expiresIn) => {
  return jwt.sign({ id }, secret, { expiresIn });
};

const createSendTokens = (user, res) => {
  const accessToken = signToken(user._id, config.jwt.accessSecret, config.jwt.accessExpires);
  const refreshToken = signToken(user._id, config.jwt.refreshSecret, config.jwt.refreshExpires);

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        email: user.email,
        status: user.status,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
};

/**
 * Genera un código aleatorio de 6 dígitos para validación.
 * @returns {string} Código de 6 dígitos.
 */
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ---- ENDPOINTS ----

/**
 * Registra un nuevo usuario en el sistema.
 * Genera un código de verificación y emite evento user:registered.
 */
export const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Verificar si el email ya existe en la base de datos (Conflict)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(AppError.conflict('El email ya está registrado.'));
    }

    // 2. Cifrar la contraseña usando bcryptjs (factor de coste 12 recomendado)
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // 3. Generar código de validación inicial
    const verificationCode = generateCode();

    // 4. Crear el documento del usuario con estado pendiente
    const newUser = await User.create({
      email,
      password: hashedPassword,
      verificationCode,
      verificationAttempts: 3,
      role: 'admin' // El usuario que se registra es Admin por defecto
    });

    // 5. Notificar al sistema de eventos (logs por consola)
    notificationService.emit('user:registered', { email: newUser.email });

    // 6. Generar JWT y enviar respuesta
    createSendTokens(newUser, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Valida el email de un usuario mediante el código de 6 dígitos.
 * Controla el número de intentos permitidos.
 */
export const validateEmail = async (req, res, next) => {
  try {
    const { code } = req.body;
    const user = req.user;

    // 1. Verificar si el usuario ya está verificado para evitar re-validaciones
    if (user.status === 'verified') {
      return next(AppError.badRequest('El usuario ya está verificado.'));
    }

    // 2. Verificar si le quedan intentos disponibles (Máximo 3 errores)
    if (user.verificationAttempts <= 0) {
      return next(AppError.tooManyRequests('Has agotado los intentos de verificación.'));
    }

    // 3. Validar si el código proporcionado coincide con el de la BD
    if (user.verificationCode !== code) {
      user.verificationAttempts -= 1; // Decremento de intentos si falla
      await user.save({ validateBeforeSave: false });
      return next(AppError.badRequest(`Código incorrecto. Intentos restantes: ${user.verificationAttempts}`));
    }

    // 4. Si es correcto, actualizar estado y limpiar el código de la BD
    user.status = 'verified';
    user.verificationCode = undefined;
    await user.save({ validateBeforeSave: false });

    notificationService.emit('user:verified', { email: user.email });

    res.status(200).json({
      status: 'success',
      message: 'Email verificado correctamente.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Inicia sesión de un usuario verificando email y contraseña.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || user.deleted) {
      return next(AppError.unauthorized('Email o contraseña incorrectos.'));
    }

    const correct = await bcrypt.compare(password, user.password);
    if (!correct) {
      return next(AppError.unauthorized('Email o contraseña incorrectos.'));
    }

    createSendTokens(user, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza los datos personales del usuario (nombre, apellidos, NIF).
 */
export const updatePersonalData = async (req, res, next) => {
  try {
    const { name, lastName, nif } = req.body;
    const user = req.user;

    user.name = name;
    user.lastName = lastName;
    user.nif = nif;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualiza o crea los datos de la compañía asociada al usuario.
 * Gestiona la lógica de Freelance vs Empresa y asignación de roles.
 */
export const updateCompanyData = async (req, res, next) => {
  try {
    const { name, cif, address, isFreelance } = req.body;
    const user = req.user;

    // Determinamos el CIF y nombre basándonos en si es Autónomo (Freelance) o Empresa
    let targetCif = isFreelance ? user.nif : cif;
    let targetName = isFreelance ? (user.fullName || user.name) : name;
    let targetAddress = isFreelance ? user.address : address;

    if (!targetCif) {
      return next(AppError.badRequest('Requerimos proveer un CIF o tener un NIF previo si eres freelance.'));
    }

    // Intentamos buscar si la compañía ya existe por CIF
    let company = await Company.findOne({ cif: targetCif });

    if (!company) {
      // Caso A: La empresa no existe -> Se crea y el usuario es el DUEÑO (Admin)
      company = await Company.create({
        owner: user._id,
        name: targetName,
        cif: targetCif,
        address: targetAddress,
        isFreelance
      });
    } else {
      // Caso B: La empresa ya existe -> El usuario se une y pasa a ser INVITADO (Guest)
      user.role = 'guest';
    }

    // Vinculamos el ID de la compañía al perfil del usuario
    user.company = company._id;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: { company, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sube y guarda el logo de la compañía asociada al usuario.
 */
export const uploadUserLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(AppError.badRequest('Por favor sube un archivo de imagen.'));
    }

    if (!req.user.company) {
      return next(AppError.badRequest('El usuario no tiene una compañía asociada.'));
    }

    const company = await Company.findById(req.user.company);
    if (!company) {
      return next(AppError.notFound('Compañía no encontrada.'));
    }

    company.logo = `/uploads/${req.file.filename}`;
    await company.save();

    res.status(200).json({
      status: 'success',
      data: { logo: company.logo }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtiene el perfil del usuario autenticado con los datos de su compañía.
 */
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('company');
    
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renueva el token de acceso utilizando un refresh token válido.
 */
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken;
    if (!token) {
      return next(AppError.unauthorized('No se proveyó un token de refresco.'));
    }

    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(AppError.unauthorized('El usuario asignado al token ya no existe.'));
    }

    const newAccessToken = signToken(user._id, config.jwt.accessSecret, config.jwt.accessExpires);
    const newRefreshToken = signToken(user._id, config.jwt.refreshSecret, config.jwt.refreshExpires);

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return next(AppError.unauthorized('Token de refresco inválido o expirado.'));
  }
};

/**
 * Cierra la sesión del usuario (informativo).
 */
export const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Cierre de sesión exitoso.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina la cuenta del usuario (soporta borrado lógico o físico).
 */
export const deleteUser = async (req, res, next) => {
  try {
    const soft = req.query.soft === 'true';

    if (soft) {
      req.user.deleted = true;
      await req.user.save({ validateBeforeSave: false });
      notificationService.emit('user:deleted', { email: req.user.email });
    } else {
      await User.findByIdAndDelete(req.user._id);
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cambia la contraseña del usuario tras verificar la actual.
 */
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const correct = await bcrypt.compare(currentPassword, user.password);
    if (!correct) {
      return next(AppError.unauthorized('La contraseña actual es incorrecta.'));
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save({ validateBeforeSave: false });

    createSendTokens(user, res);
  } catch (error) {
    next(error);
  }
};

/**
 * Permite a un administrador invitar a nuevos usuarios a su compañía.
 */
export const inviteUser = async (req, res, next) => {
  try {
    const { email, name, lastName } = req.body;
    const company = req.user.company;

    if (!company) {
      return next(AppError.badRequest('No estás asociado a ninguna empresa.'));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(AppError.conflict('El email de invitado ya está registrado.'));
    }

    const mockPassword = await bcrypt.hash(Math.random().toString(36).slice(-8), 12);

    const newUser = await User.create({
      email,
      name,
      lastName,
      password: mockPassword,
      role: 'guest',
      company: company._id,
      status: 'pending',
      verificationCode: generateCode()
    });

    notificationService.emit('user:invited', { email: newUser.email, company });

    res.status(201).json({
      status: 'success',
      data: {
        user: { email: newUser.email, role: newUser.role, company: newUser.company }
      }
    });
  } catch (error) {
    next(error);
  }
};
