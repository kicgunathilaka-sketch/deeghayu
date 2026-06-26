import { Router } from 'express';
import * as controller from './expense.controller';
import * as groupController from './expense-group.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();
router.use(authenticate);

// Expense groups (events)
router.get('/groups', authorizeMinRole(Role.TREASURER), groupController.getAll);
router.get('/groups/:id', authorizeMinRole(Role.TREASURER), groupController.getById);
router.post('/groups', authorizeMinRole(Role.TREASURER), groupController.create);
router.delete('/groups/:id', authorizeMinRole(Role.ADMIN), groupController.remove);

// Individual expenses
router.get('/', authorizeMinRole(Role.TREASURER), controller.getAll);
router.post('/', authorizeMinRole(Role.TREASURER), controller.create);
router.patch('/:id', authorizeMinRole(Role.TREASURER), controller.update);
router.delete('/:id', authorizeMinRole(Role.ADMIN), controller.remove);

export default router;
