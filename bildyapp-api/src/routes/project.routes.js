import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireCompany } from '../middleware/scope.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  idParamSchema,
} from '../validators/project.validator.js';
import {
  createProject,
  updateProject,
  listProjects,
  listArchivedProjects,
  getProject,
  deleteProject,
  restoreProject,
} from '../controllers/project.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireCompany);

router.post('/', validate(createProjectSchema), createProject);
router.put('/:id', validate(updateProjectSchema), updateProject);
router.get('/', validate(listProjectsQuerySchema), listProjects);
// /archived MUST be defined before /:id
router.get('/archived', listArchivedProjects);
router.get('/:id', validate(idParamSchema), getProject);
router.delete('/:id', validate(idParamSchema), deleteProject);
router.patch('/:id/restore', validate(idParamSchema), restoreProject);

export default router;
