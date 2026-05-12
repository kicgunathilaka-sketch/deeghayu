import { Router } from 'express';
import * as committeeController from './committee.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/panels', committeeController.getAllPanels);
router.get('/panels/:year', committeeController.getPanelByYear);
router.post('/panels', authorizeMinRole(Role.ADMIN), committeeController.createPanel);
router.post('/panels/:id/roles', authorizeMinRole(Role.ADMIN), committeeController.assignRole);
router.patch('/roles/:id', authorizeMinRole(Role.ADMIN), committeeController.updateRole);
router.get('/history/:memberId', committeeController.getMemberHistory);

export default router;
