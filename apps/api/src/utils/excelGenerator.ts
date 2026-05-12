import ExcelJS from 'exceljs';
import { config } from '../config';

export async function generateExcel(
  title: string,
  headers: { key: string; header: string; width?: number }[],
  rows: Record<string, any>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.appName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title);

  // Title row
  sheet.mergeCells(`A1:${String.fromCharCode(64 + headers.length)}1`);
  sheet.getCell('A1').value = `${config.appName} — ${title}`;
  sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF0284C7' } };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.getRow(1).height = 30;

  // Generated at
  sheet.mergeCells(`A2:${String.fromCharCode(64 + headers.length)}2`);
  sheet.getCell('A2').value = `Generated: ${new Date().toLocaleString()}`;
  sheet.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]); // spacer

  // Column headers
  sheet.columns = headers.map((h) => ({
    key: h.key,
    header: h.header,
    width: h.width || 20,
  }));

  const headerRow = sheet.getRow(4);
  headerRow.values = ['', ...headers.map((h) => h.header)];
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { horizontal: 'center' };
  });
  headerRow.height = 20;

  // Data rows
  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow(row);
    if (idx % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + rows.length, column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
