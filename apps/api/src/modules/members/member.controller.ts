import { Request, Response } from 'express';
import { MemberService } from './member.service';
import { MemberStatus } from '../../types';

const memberService = new MemberService();

export const getAll = async (req: Request, res: Response) => {
  const result = await memberService.getAll(req.query as any);
  res.json({ success: true, ...result });
};

export const getById = async (req: Request, res: Response) => {
  const member = await memberService.getById(req.params.id);
  res.json({ success: true, data: member });
};

export const update = async (req: Request, res: Response) => {
  const member = await memberService.update(req.params.id, req.body);
  res.json({ success: true, data: member });
};

export const updateStatus = async (req: Request, res: Response) => {
  const { status } = req.body as { status: MemberStatus };
  const member = await memberService.updateStatus(req.params.id, status, req.user!.id);
  res.json({ success: true, data: member });
};

export const getQr = async (req: Request, res: Response) => {
  const result = await memberService.getQr(req.params.id);
  res.json({ success: true, data: result });
};

export const getPayments = async (req: Request, res: Response) => {
  const result = await memberService.getPayments(req.params.id, req.query as any);
  res.json({ success: true, ...result });
};

export const getAttendance = async (req: Request, res: Response) => {
  const result = await memberService.getAttendance(req.params.id, req.query as any);
  res.json({ success: true, ...result });
};

export const exportMembers = async (req: Request, res: Response) => {
  const fmt = (req.query.format as string) || 'excel';
  const buffer = await memberService.exportMembers(fmt as any, req.query);

  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  };
  const extensions: Record<string, string> = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };

  res.setHeader('Content-Type', contentTypes[fmt] || contentTypes.excel);
  res.setHeader('Content-Disposition', `attachment; filename="members.${extensions[fmt] || 'xlsx'}"`);
  res.send(buffer);
};
