import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { validate } from '../middleware/validate.js';
import { uploadSignature } from '../middleware/upload-memory.js';
import {
  createDeliveryNoteSchema,
  listDeliveryNotesQuerySchema,
  idParamSchema,
  signDeliveryNoteSchema,
} from '../validators/deliverynote.validator.js';
import {
  createDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  getDeliveryNotePDF,
  signDeliveryNote,
  deleteDeliveryNote,
} from '../controllers/deliverynote.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

router.post('/', validate(createDeliveryNoteSchema), createDeliveryNote);
router.get('/', validate(listDeliveryNotesQuerySchema), listDeliveryNotes);
// /pdf/:id MUST be defined before /:id
router.get('/pdf/:id', validate(idParamSchema), getDeliveryNotePDF);
router.get('/:id', validate(idParamSchema), getDeliveryNote);
router.patch('/:id/sign', validate(signDeliveryNoteSchema), uploadSignature, signDeliveryNote);
router.delete('/:id', validate(idParamSchema), deleteDeliveryNote);

export default router;
