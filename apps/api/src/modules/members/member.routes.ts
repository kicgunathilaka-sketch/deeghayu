import { Router } from 'express';
import * as memberController from './member.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize, authorizeMinRole } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', authorizeMinRole(Role.COMMITTEE_MEMBER), memberController.getAll);
router.get('/export', authorizeMinRole(Role.SECRETARY), memberController.exportMembers);
router.get('/:id', memberController.getById);
router.patch('/:id', memberController.update);
router.patch('/:id/status', authorizeMinRole(Role.ADMIN), memberController.updateStatus);
router.get('/:id/qr', memberController.getQr);
router.get('/:id/payments', memberController.getPayments);
router.get('/:id/attendance', memberController.getAttendance);

export default router;
