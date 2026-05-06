import AppError from '../utils/AppError.js';

export const requireCompany = (req, res, next) => {
  if (!req.user?.company) {
    return next(AppError.badRequest('Debes completar el perfil de empresa antes de realizar esta acción.'));
  }
  next();
};
