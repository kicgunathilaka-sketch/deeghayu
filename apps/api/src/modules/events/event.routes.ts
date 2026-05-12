import { Router } from 'express';
import * as eventController from './event.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorizeMinRole } from '../../middleware/authorize';
import { Role } from '../../types';

const router = Router();

router.use(authenticate);

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);
router.post('/', authorizeMinRole(Role.SECRETARY), eventController.create);
router.patch('/:id', authorizeMinRole(Role.SECRETARY), eventController.update);
router.post('/:id/publish', authorizeMinRole(Role.SECRETARY), eventController.publish);
router.post('/:id/open-attendance', authorizeMinRole(Role.COMMITTEE_MEMBER), eventController.openAttendance);
router.get('/:id/qr', authorizeMinRole(Role.COMMITTEE_MEMBER), eventController.getQr);
router.post('/:id/rsvp', eventController.rsvp);
router.get('/:id/attendance', authorizeMinRole(Role.COMMITTEE_MEMBER), eventController.getAttendance);
router.get('/:id/gallery', eventController.getById);
router.post('/:id/gallery', eventController.addGalleryPhoto);
router.post('/:id/reminders', authorizeMinRole(Role.SECRETARY), eventController.sendReminders);

export default router;
