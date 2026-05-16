import { Router } from 'express';
import * as paymentController from './payment.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();

router.use(authenticate);

router.get('/', authorizeMinRole(Role.TREASURER), paymentController.getAll);
router.get('/summary', authorizeMinRole(Role.TREASURER), paymentController.getSummary);
router.get('/overdue', authorizeMinRole(Role.TREASURER), paymentController.getOverdue);
router.get('/analytics', authorizeMinRole(Role.TREASURER), paymentController.getAnalytics);
router.post('/bulk-reminder', authorizeMinRole(Role.TREASURER), paymentController.sendBulkReminders);
router.post('/bulk-create', authorizeMinRole(Role.TREASURER), paymentController.bulkCreate);
router.post('/', authorizeMinRole(Role.TREASURER), paymentController.create);
router.get('/:id', authorizeMinRole(Role.TREASURER), paymentController.getById);
router.patch('/:id', authorizeMinRole(Role.TREASURER), paymentController.update);
router.get('/:id/receipt', paymentController.getReceipt);

export default router;
