import { Request, Response } from 'express';
import { BankAccountService } from './bank-account.service';

const service = new BankAccountService();

export const getAll = async (req: Request, res: Response) => {
  const result = await service.getAll();
  res.json({ success: true, data: result });
};

export const create = async (req: Request, res: Response) => {
  const result = await service.create({ ...req.body, createdBy: req.user!.id });
  res.status(201).json({ success: true, data: result });
};

export const update = async (req: Request, res: Response) => {
  const result = await service.update(req.params.id, req.body);
  res.json({ success: true, data: result });
};
