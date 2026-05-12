import { Router } from 'express';
import * as attendanceController from './attendance.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { scanLimiter } from '../../middleware/rateLimiter';
import { Role } from '../../types';

const router = Router();

router.use(authenticate);

router.post('/scan', scanLimiter, attendanceController.scan);
router.get('/analytics', authorizeMinRole(Role.COMMITTEE_MEMBER), attendanceController.getAnalytics);
router.get('/member/:memberId', attendanceController.getMemberHistory);
router.get('/:eventId', authorizeMinRole(Role.COMMITTEE_MEMBER), attendanceController.getLive);

export default router;
