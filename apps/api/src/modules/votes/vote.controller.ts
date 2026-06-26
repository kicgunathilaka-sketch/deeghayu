import { Request, Response } from 'express';
import { VoteService } from './vote.service';

const service = new VoteService();

export const getAll = async (req: Request, res: Response) => {
  const result = await service.getAll(req.user!.id);
  res.json({ success: true, data: result });
};

export const getById = async (req: Request, res: Response) => {
  const result = await service.getById(req.params.id, req.user!.id);
  res.json({ success: true, data: result });
};

export const create = async (req: Request, res: Response) => {
  const result = await service.create({ ...req.body, createdBy: req.user!.id });
  res.status(201).json({ success: true, data: result });
};

export const setStatus = async (req: Request, res: Response) => {
  const result = await service.setStatus(req.params.id, req.body.status, req.user!.id);
  res.json({ success: true, data: result });
};

export const respond = async (req: Request, res: Response) => {
  const result = await service.respond(req.params.id, req.user!.id, req.body.response);
  res.json({ success: true, data: result });
};

export const removeResponse = async (req: Request, res: Response) => {
  const result = await service.removeResponse(req.params.id, req.user!.id);
  res.json({ success: true, data: result });
};

export const remove = async (req: Request, res: Response) => {
  const result = await service.delete(req.params.id);
  res.json({ success: true, data: result });
};
