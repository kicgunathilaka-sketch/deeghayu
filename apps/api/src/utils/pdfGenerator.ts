import PDFDocument from 'pdfkit';
import { config } from '../config';

interface ReceiptData {
  memberName: string;
  membershipId: string;
  amount: number;
  type: string;
  description?: string;
  paidAt: Date;
  receiptNumber: string;
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#0284c7').fontSize(20).text(config.appName, { align: 'center' });
    doc.fillColor('#64748b').fontSize(10).text('Payment Receipt', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);

    // Receipt details
    const labelX = 40;
    const valueX = 200;
    const rows = [
      ['Receipt No:', data.receiptNumber],
      ['Member:', data.memberName],
      ['Membership ID:', data.membershipId],
      ['Payment Type:', data.type],
      ['Description:', data.description || '-'],
      ['Amount:', `Rs. ${data.amount.toFixed(2)}`],
      ['Date:', data.paidAt.toLocaleDateString('en-US', { dateStyle: 'long' })],
    ];

    rows.forEach(([label, value]) => {
      doc.fillColor('#64748b').fontSize(10).text(label, labelX, doc.y);
      doc.fillColor('#0f172a').fontSize(10).text(value, valueX, doc.y - 12);
      doc.moveDown(0.6);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);

    // Amount highlight
    doc.fillColor('#0284c7').fontSize(16).text(`Total Paid: Rs. ${data.amount.toFixed(2)}`, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#64748b').fontSize(9).text('Thank you for your payment. This is an official receipt.', { align: 'center' });

    doc.end();
  });
}

interface ReportData {
  title: string;
  headers: string[];
  rows: string[][];
  generatedAt?: Date;
}

export function generateReportPdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#0284c7').fontSize(18).text(config.appName, { align: 'center' });
    doc.fillColor('#0f172a').fontSize(13).text(data.title, { align: 'center' });
    doc.fillColor('#64748b').fontSize(9).text(
      `Generated: ${(data.generatedAt || new Date()).toLocaleString()}`,
      { align: 'center' }
    );
    doc.moveDown(1);

    // Table
    const pageWidth = doc.page.width - 80;
    const colWidth = pageWidth / data.headers.length;
    let y = doc.y;

    // Header row
    doc.fillColor('#0f172a').fontSize(9);
    data.headers.forEach((h, i) => {
      doc.text(h, 40 + i * colWidth, y, { width: colWidth - 5, ellipsis: true });
    });
    y += 18;
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#cbd5e1').stroke();
    y += 5;

    // Data rows
    data.rows.forEach((row, ri) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
      doc.fillColor(ri % 2 === 0 ? '#f8fafc' : 'white')
        .rect(40, y - 2, pageWidth, 18)
        .fill();
      doc.fillColor('#334155').fontSize(8);
      row.forEach((cell, i) => {
        doc.text(cell || '-', 40 + i * colWidth, y, { width: colWidth - 5, ellipsis: true });
      });
      y += 18;
    });

    doc.end();
  });
}
