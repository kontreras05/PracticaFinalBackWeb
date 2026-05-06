import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { User } from '../models/User.js';
import { config } from '../config/index.js';

/**
 * Middleware para requerir autenticación mediante JWT.
 * Verifica el token y adjunta el usuario a la petición (req.user).
 */
export const requireAuth = async (req, res, next) => {
  try {
    let token;
    
    // Extraer token de las cabeceras
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw AppError.unauthorized('No estás autenticado. Por favor, inicia sesión.');
    }

    // Verificar token
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // Verificar si el usuario aún existe
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      throw AppError.unauthorized('El usuario que pertenece a este token ya no existe.');
    }

    // Poner el usuario en la request para su uso futuro
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(AppError.unauthorized('Token inválido.'));
    } else if (error.name === 'TokenExpiredError') {
      next(AppError.unauthorized('Tu token ha expirado. Por favor, inicia sesión de nuevo.'));
    } else {
      next(error);
    }
  }
};
