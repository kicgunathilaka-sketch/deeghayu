import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';

const attendanceService = new AttendanceService();

export const scan = async (req: Request, res: Response) => {
  const result = await attendanceService.scan(req.user!.memberId!, req.body.qrPayload);
  res.json(result);
};

export const getLive = async (req: Request, res: Response) => {
  const result = await attendanceService.getLive(req.params.eventId);
  res.json({ success: true, data: result });
};

export const getMemberHistory = async (req: Request, res: Response) => {
  const memberId = req.params.memberId || req.user!.memberId!;
  const result = await attendanceService.getMemberHistory(memberId);
  res.json({ success: true, data: result });
};

export const getAnalytics = async (req: Request, res: Response) => {
  const result = await attendanceService.getAnalytics();
  res.json({ success: true, data: result });
};
