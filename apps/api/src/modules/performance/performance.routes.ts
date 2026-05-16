import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './performance.controller';

const router = Router();
router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:memberId', controller.getById);

export default router;
