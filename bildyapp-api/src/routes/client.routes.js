import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
  idParamSchema,
} from '../validators/client.validator.js';
import {
  createClient,
  updateClient,
  listClients,
  listArchivedClients,
  getClient,
  deleteClient,
  restoreClient,
} from '../controllers/client.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

router.post('/', validate(createClientSchema), createClient);
router.put('/:id', validate(updateClientSchema), updateClient);
router.get('/', validate(listClientsQuerySchema), listClients);
// /archived MUST be defined before /:id
router.get('/archived', listArchivedClients);
router.get('/:id', validate(idParamSchema), getClient);
router.delete('/:id', validate(idParamSchema), deleteClient);
router.patch('/:id/restore', validate(idParamSchema), restoreClient);

export default router;
