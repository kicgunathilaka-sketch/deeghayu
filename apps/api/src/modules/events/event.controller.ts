import { Request, Response } from 'express';
import { EventService } from './event.service';
import { RsvpResponse } from '../../types';

const eventService = new EventService();

export const getAll = async (req: Request, res: Response) => {
  const result = await eventService.getAll(req.query as any);
  res.json({ success: true, ...result });
};

export const getById = async (req: Request, res: Response) => {
  const event = await eventService.getById(req.params.id);
  res.json({ success: true, data: event });
};

export const create = async (req: Request, res: Response) => {
  const event = await eventService.create({ ...req.body, createdBy: req.user!.id });
  res.status(201).json({ success: true, data: event });
};

export const update = async (req: Request, res: Response) => {
  const event = await eventService.update(req.params.id, req.body);
  res.json({ success: true, data: event });
};

export const publish = async (req: Request, res: Response) => {
  const event = await eventService.publish(req.params.id);
  res.json({ success: true, data: event });
};

export const openAttendance = async (req: Request, res: Response) => {
  const event = await eventService.openAttendance(req.params.id);
  res.json({ success: true, data: event });
};

export const getQr = async (req: Request, res: Response) => {
  const result = await eventService.getQr(req.params.id);
  res.json({ success: true, data: result });
};

export const rsvp = async (req: Request, res: Response) => {
  const result = await eventService.rsvp(req.params.id, req.user!.memberId!, req.body.response as RsvpResponse);
  res.json({ success: true, data: result });
};

export const getAttendance = async (req: Request, res: Response) => {
  const result = await eventService.getAttendance(req.params.id);
  res.json({ success: true, data: result });
};

export const addGalleryPhoto = async (req: Request, res: Response) => {
  const result = await eventService.addGalleryPhoto(
    req.params.id,
    req.body.imageUrl,
    req.body.caption,
    req.user!.id
  );
  res.status(201).json({ success: true, data: result });
};

export const sendReminders = async (req: Request, res: Response) => {
  const result = await eventService.sendReminders(req.params.id);
  res.json({ success: true, data: result });
};
