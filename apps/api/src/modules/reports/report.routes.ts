import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();

router.use(authenticate);

router.get('/dashboard/stats', reportController.getDashboardStats);
router.get('/finance', authorizeMinRole(Role.TREASURER), reportController.getFinancialReport);
router.get('/export', authorizeMinRole(Role.SECRETARY), reportController.exportReport);

export default router;
