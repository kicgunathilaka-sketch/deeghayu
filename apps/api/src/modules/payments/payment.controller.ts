import { Request, Response } from 'express';
import { PaymentService } from './payment.service';

const paymentService = new PaymentService();

export const getAll = async (req: Request, res: Response) => {
  const result = await paymentService.getAll(req.query as any);
  res.json({ success: true, ...result });
};

export const getById = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(req.params.id);
  res.json({ success: true, data: payment });
};

export const create = async (req: Request, res: Response) => {
  const payment = await paymentService.create({ ...req.body, recordedBy: req.user!.id });
  res.status(201).json({ success: true, data: payment });
};

export const update = async (req: Request, res: Response) => {
  const payment = await paymentService.update(req.params.id, req.body);
  res.json({ success: true, data: payment });
};

export const getReceipt = async (req: Request, res: Response) => {
  const buffer = await paymentService.getReceipt(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${req.params.id}.pdf"`);
  res.send(buffer);
};

export const getSummary = async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : undefined;
  const result = await paymentService.getSummary(year, month);
  res.json({ success: true, data: result });
};

export const getOverdue = async (req: Request, res: Response) => {
  const result = await paymentService.getOverdue();
  res.json({ success: true, data: result });
};

export const bulkCreate = async (req: Request, res: Response) => {
  const result = await paymentService.bulkCreate({ ...req.body, recordedBy: req.user!.id });
  res.status(201).json({ success: true, data: result });
};

export const sendBulkReminders = async (req: Request, res: Response) => {
  const result = await paymentService.sendBulkReminders(req.body.paymentIds);
  res.json({ success: true, data: result });
};

export const getAnalytics = async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const result = await paymentService.getAnalytics(year);
  res.json({ success: true, data: result });
};
