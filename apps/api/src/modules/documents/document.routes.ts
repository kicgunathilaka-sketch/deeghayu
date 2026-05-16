import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';
import * as controller from './document.controller';

const router = Router();
router.use(authenticate);
router.use(authorizeMinRole(Role.SECRETARY));

router.post('/letter', controller.createLetter);

export default router;
