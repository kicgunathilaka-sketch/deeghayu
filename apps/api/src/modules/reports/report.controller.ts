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

export const getMonthlyReport = async (req: Request, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const buffer = await reportService.getMonthlyReport(year, month);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="financial-report-${months[month-1]}-${year}.pdf"`);
  res.send(buffer);
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
