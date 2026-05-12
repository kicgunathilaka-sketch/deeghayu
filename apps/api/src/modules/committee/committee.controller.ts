import { Request, Response } from 'express';
import { CommitteeService } from './committee.service';

const committeeService = new CommitteeService();

export const getAllPanels = async (req: Request, res: Response) => {
  const result = await committeeService.getAllPanels();
  res.json({ success: true, data: result });
};

export const getPanelByYear = async (req: Request, res: Response) => {
  const result = await committeeService.getPanelByYear(Number(req.params.year));
  res.json({ success: true, data: result });
};

export const createPanel = async (req: Request, res: Response) => {
  const result = await committeeService.createPanel(req.body.year, req.body.notes);
  res.status(201).json({ success: true, data: result });
};

export const assignRole = async (req: Request, res: Response) => {
  const result = await committeeService.assignRole(
    req.params.id,
    req.body.memberId,
    req.body.role,
    req.body.startDate,
    req.body.notes
  );
  res.status(201).json({ success: true, data: result });
};

export const updateRole = async (req: Request, res: Response) => {
  const result = await committeeService.updateRole(req.params.id, req.body);
  res.json({ success: true, data: result });
};

export const getMemberHistory = async (req: Request, res: Response) => {
  const result = await committeeService.getMemberHistory(req.params.memberId);
  res.json({ success: true, data: result });
};
