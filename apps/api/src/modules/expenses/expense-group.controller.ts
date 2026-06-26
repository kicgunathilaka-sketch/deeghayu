import { Request, Response } from 'express';
import { ExpenseGroupService } from './expense-group.service';

const service = new ExpenseGroupService();

export const getAll = async (req: Request, res: Response) => {
  const result = await service.getAll(req.query as any);
  res.json({ success: true, data: result });
};

export const getById = async (req: Request, res: Response) => {
  const result = await service.getById(req.params.id);
  res.json({ success: true, data: result });
};

export const create = async (req: Request, res: Response) => {
  const result = await service.create({ ...req.body, recordedBy: req.user!.id });
  res.status(201).json({ success: true, data: result });
};

export const remove = async (req: Request, res: Response) => {
  const result = await service.delete(req.params.id);
  res.json({ success: true, data: result });
};
