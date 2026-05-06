import multer from 'multer';
import AppError from '../utils/AppError.js';

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(AppError.badRequest('Solo se permiten imágenes.'), false);
  }
};

export const uploadSignature = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('signature');
