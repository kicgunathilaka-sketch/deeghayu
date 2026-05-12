import { Request, Response } from 'express';
import { ReportService } from './report.service';

const reportService = new ReportService();

export const getDashboardStats = async (req: Request, res: Response) => {
  const result = await reportService.getDashboardStats();
  res.json({ success: true, data: result });
};

export const getFinancialReport = async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const result = await reportService.getFinancialReport(year);
  res.json({ success: true, data: result });
};

export const exportReport = async (req: Request, res: Response) => {
  const { type, format } = req.query as { type: any; format: any };
  const buffer = await reportService.exportReport(type, format || 'excel', req.query);

  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  };
  const exts: Record<string, string> = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };
  const fmt = format || 'excel';

  res.setHeader('Content-Type', contentTypes[fmt]);
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.${exts[fmt]}"`);
  res.send(buffer);
};
