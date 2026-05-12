import { Request, Response } from 'express';
import { NotificationService } from './notification.service';

const notificationService = new NotificationService();

export const getForUser = async (req: Request, res: Response) => {
  const result = await notificationService.getForUser(req.user!.id);
  res.json({ success: true, data: result });
};

export const markRead = async (req: Request, res: Response) => {
  await notificationService.markRead(req.params.id, req.user!.id);
  res.json({ success: true, message: 'Marked as read' });
};

export const markAllRead = async (req: Request, res: Response) => {
  await notificationService.markAllRead(req.user!.id);
  res.json({ success: true, message: 'All marked as read' });
};

export const broadcast = async (req: Request, res: Response) => {
  const result = await notificationService.broadcast(req.body);
  res.json({ success: true, data: result });
};
