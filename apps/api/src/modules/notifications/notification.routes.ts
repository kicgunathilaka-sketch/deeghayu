import { Router } from 'express';
import * as notificationController from './notification.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getForUser);
router.patch('/:id/read', notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);
router.post('/broadcast', authorizeMinRole(Role.ADMIN), notificationController.broadcast);

export default router;
