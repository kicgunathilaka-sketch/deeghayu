import { Router } from 'express';
import * as controller from './expense.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();
router.use(authenticate);

router.get('/', authorizeMinRole(Role.TREASURER), controller.getAll);
router.post('/', authorizeMinRole(Role.TREASURER), controller.create);
router.patch('/:id', authorizeMinRole(Role.TREASURER), controller.update);
router.delete('/:id', authorizeMinRole(Role.ADMIN), controller.remove);

export default router;
