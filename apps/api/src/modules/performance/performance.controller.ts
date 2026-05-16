import { Request, Response } from 'express';
import { PerformanceService } from './performance.service';

const service = new PerformanceService();

export const getAll = async (_req: Request, res: Response) => {
  const result = await service.getAll();
  res.json({ success: true, data: result });
};

export const getById = async (req: Request, res: Response) => {
  const result = await service.getById(req.params.memberId);
  res.json({ success: true, data: result });
};
