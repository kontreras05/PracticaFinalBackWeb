import { Router } from 'express';
import userRoutes from './user.routes.js';
import clientRoutes from './client.routes.js';
import projectRoutes from './project.routes.js';
import deliveryNoteRoutes from './deliverynote.routes.js';

const router = Router();

router.use('/user', userRoutes);
router.use('/client', clientRoutes);
router.use('/project', projectRoutes);
router.use('/deliverynote', deliveryNoteRoutes);

export default router;
