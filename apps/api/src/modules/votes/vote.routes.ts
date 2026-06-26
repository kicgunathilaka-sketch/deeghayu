import { Router } from 'express';
import * as controller from './vote.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();
router.use(authenticate);

// All authenticated users can list and view votes
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Casting / removing a vote — all authenticated members
router.post('/:id/respond', controller.respond);
router.delete('/:id/respond', controller.removeResponse);

// Creating and managing votes — Secretary and above
router.post('/', authorizeMinRole(Role.SECRETARY), controller.create);
router.patch('/:id/status', authorizeMinRole(Role.SECRETARY), controller.setStatus);
router.delete('/:id', authorizeMinRole(Role.ADMIN), controller.remove);

export default router;
