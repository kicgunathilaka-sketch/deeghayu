import { Router } from 'express';
import * as controller from './bank-account.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();
router.use(authenticate);
router.use(authorizeMinRole(Role.TREASURER));

router.get('/', controller.getAll);
router.post('/', controller.create);
router.patch('/:id', controller.update);

export default router;
