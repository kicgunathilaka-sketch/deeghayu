import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Logo is at apps/api/assets/logo.png — same relative path from src/utils/ and dist/utils/
const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
const LOGO_BUF: Buffer | null = (() => {
  try { return fs.readFileSync(LOGO_PATH); } catch { return null; }
})();

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
    if (LOGO_BUF) {
      const logoW = 48;
      doc.image(LOGO_BUF, (doc.page.width - logoW) / 2, doc.y, { width: logoW, height: logoW });
      doc.moveDown(3.2);
    }
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

interface LetterData {
  receiverName: string;
  receiverDesignation?: string;
  receiverAddress: string;
  subject?: string;
  content: string;
  senderName?: string;
  senderDesignation?: string;
}

export function generateLetterPdf(data: LetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const ML = 65; // left margin
    const MR = 65; // right margin
    const CW = W - ML - MR; // content width
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const ref = `DCW/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    // ── Header band ─────────────────────────────────────────
    doc.rect(0, 0, W, 110).fill('#0c3a5e');
    // Accent stripe
    doc.rect(0, 110, W, 5).fill('#1d8cf8');
    doc.rect(0, 115, W, 2).fill('#e8f4ff');

    // Logo
    if (LOGO_BUF) {
      doc.image(LOGO_BUF, ML, 18, { width: 72, height: 72 });
    } else {
      doc.circle(ML + 36, 54, 30).fillAndStroke('#1d5080', '#4a90c4').lineWidth(1.5);
    }

    // Org name
    doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold')
       .text('Deeghayu Community Welfare Society', ML + 84, 28, { width: CW - 84 });
    doc.fillColor('#93c5ea').fontSize(10).font('Helvetica')
       .text('Kotigala, Handapangoda.', ML + 84, 52, { width: CW - 84 });
    // Tagline
    doc.fillColor('#6daed6').fontSize(8).font('Helvetica-Oblique')
       .text('Building Community. Enriching Lives.', ML + 84, 68, { width: CW - 84 });

    // ── Ref + Date row ──────────────────────────────────────
    let y = 132;
    doc.fillColor('#475569').fontSize(9.5).font('Helvetica')
       .text(`Ref: ${ref}`, ML, y);
    doc.fillColor('#475569').fontSize(9.5)
       .text(dateStr, ML, y, { align: 'right', width: CW });
    y += 22;

    // Thin divider
    doc.moveTo(ML, y).lineTo(W - MR, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    y += 18;

    // ── Receiver block ──────────────────────────────────────
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica')
       .text('To,', ML, y);
    y += 16;
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
       .text(data.receiverName, ML, y);
    y += 16;
    if (data.receiverDesignation) {
      doc.fillColor('#334155').fontSize(10.5).font('Helvetica')
         .text(data.receiverDesignation, ML, y);
      y += 15;
    }
    const addrLines = data.receiverAddress.split('\n');
    addrLines.forEach((line) => {
      doc.fillColor('#334155').fontSize(10.5).font('Helvetica')
         .text(line.trim(), ML, y);
      y += 15;
    });
    y += 12;

    // ── Subject ─────────────────────────────────────────────
    if (data.subject) {
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
         .text(`Subject: ${data.subject}`, ML, y, { underline: true, width: CW });
      y += 22;
    }

    // ── Salutation ──────────────────────────────────────────
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica')
       .text(`Dear ${data.receiverName},`, ML, y);
    y += 22;

    // ── Body ────────────────────────────────────────────────
    const contentLines = data.content.split('\n\n');
    contentLines.forEach((para, i) => {
      const h = doc.heightOfString(para.trim(), { width: CW, lineGap: 3 });
      if (y + h > doc.page.height - 120) {
        doc.addPage({ margin: 0 });
        y = 60;
      }
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica')
         .text(para.trim(), ML, y, { width: CW, lineGap: 3, align: 'justify' });
      y += h + (i < contentLines.length - 1 ? 10 : 0);
    });
    y += 24;

    // ── Closing ─────────────────────────────────────────────
    if (y > doc.page.height - 130) {
      doc.addPage({ margin: 0 });
      y = 60;
    }
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica')
       .text('Yours faithfully,', ML, y);
    y += 56;

    // Signature line
    doc.moveTo(ML, y).lineTo(ML + 170, y).strokeColor('#475569').lineWidth(0.8).stroke();
    y += 6;
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
       .text(data.senderName || 'Secretary', ML, y);
    y += 15;
    doc.fillColor('#475569').fontSize(10).font('Helvetica')
       .text(data.senderDesignation || 'Secretary', ML, y);
    y += 14;
    doc.fillColor('#475569').fontSize(10)
       .text('Deeghayu Community Welfare Society', ML, y);

    // ── Footer ──────────────────────────────────────────────
    const FY = doc.page.height - 36;
    doc.moveTo(ML, FY - 10).lineTo(W - MR, FY - 10).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
       .text('Deeghayu Community Welfare Society  ·  Kotigala, Handapangoda.', ML, FY, { align: 'center', width: CW });

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

// ── Monthly Financial Report ───────────────────────────────────────────────────

export interface MonthlyReportIncomeLine {
  type: string;
  label: string;
  memberCount: number;
  total: number;
}

export interface MonthlyReportExpenseLine {
  date: string;
  title: string;
  category: string;
  amount: number;
}

export interface MonthlyReportBankAccount {
  name: string;
  accountNumber: string | null;
  openingBalance: number;
  incomeThisMonth: number;
  expensesThisMonth: number;
  closingBalance: number;
}

export interface MonthlyReportData {
  year: number;
  month: number;
  monthName: string;
  income: MonthlyReportIncomeLine[];
  expenses: MonthlyReportExpenseLine[];
  bankAccounts: MonthlyReportBankAccount[];
  totalIncome: number;
  totalExpenses: number;
}

const MONTH_NAMES_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function rptSection(doc: InstanceType<typeof PDFDocument>, label: string, y: number, W: number, ML: number, MR: number): number {
  doc.rect(ML, y, W - ML - MR, 18).fill('#0c3a5e');
  doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
     .text(label.toUpperCase(), ML + 8, y + 5, { width: W - ML - MR - 16 });
  return y + 22;
}

function rptDivider(doc: InstanceType<typeof PDFDocument>, y: number, W: number, ML: number, MR: number): number {
  doc.moveTo(ML, y).lineTo(W - MR, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  return y + 6;
}

function rptRow(doc: InstanceType<typeof PDFDocument>, cols: { text: string; x: number; w: number; bold?: boolean; right?: boolean; color?: string }[], y: number): number {
  cols.forEach(({ text, x, w, bold, right, color }) => {
    doc.fillColor(color ?? '#1e293b').fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(text, x, y, { width: w, align: right ? 'right' : 'left', ellipsis: true });
  });
  return y + 15;
}

export function generateMonthlyFinancialReport(data: MonthlyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const ML = 50;
    const MR = 50;
    const CW = W - ML - MR;
    const now = new Date();

    // ── Header band ──────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill('#0c3a5e');
    doc.rect(0, 90, W, 4).fill('#1d8cf8');
    if (LOGO_BUF) doc.image(LOGO_BUF, ML, 10, { width: 65, height: 65 });
    doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
       .text('Deeghayu Community Welfare Society', ML + 76, 18, { width: CW - 76 });
    doc.fillColor('#93c5ea').fontSize(10).font('Helvetica')
       .text(`Monthly Financial Report — ${data.monthName} ${data.year}`, ML + 76, 40, { width: CW - 76 });
    doc.fillColor('#6daed6').fontSize(8).font('Helvetica-Oblique')
       .text(`Generated: ${now.toLocaleDateString('en-US', { dateStyle: 'long' })}`, ML + 76, 58, { width: CW - 76 });

    let y = 106;

    // ── INCOME ───────────────────────────────────────────────
    y = rptSection(doc, 'Income', y, W, ML, MR);
    y += 4;
    y = rptRow(doc, [
      { text: 'Payment Type', x: ML, w: CW * 0.55, bold: true, color: '#475569' },
      { text: 'Members', x: ML + CW * 0.55, w: CW * 0.2, bold: true, right: true, color: '#475569' },
      { text: 'Amount (Rs.)', x: ML + CW * 0.75, w: CW * 0.25, bold: true, right: true, color: '#475569' },
    ], y);
    y = rptDivider(doc, y, W, ML, MR);

    if (data.income.length === 0) {
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('No income recorded for this month.', ML, y);
      y += 18;
    } else {
      data.income.forEach((line, i) => {
        if (i % 2 === 0) doc.rect(ML, y - 2, CW, 16).fill('#f8fafc');
        y = rptRow(doc, [
          { text: line.label, x: ML, w: CW * 0.55 },
          { text: line.memberCount > 0 ? String(line.memberCount) : '—', x: ML + CW * 0.55, w: CW * 0.2, right: true, color: '#475569' },
          { text: line.total.toFixed(2), x: ML + CW * 0.75, w: CW * 0.25, right: true },
        ], y);
      });
    }

    y = rptDivider(doc, y + 2, W, ML, MR);
    doc.rect(ML, y - 2, CW, 18).fill('#e0f2fe');
    y = rptRow(doc, [
      { text: 'Total Income', x: ML + 4, w: CW * 0.75, bold: true, color: '#0c3a5e' },
      { text: data.totalIncome.toFixed(2), x: ML + CW * 0.75, w: CW * 0.25, bold: true, right: true, color: '#0c3a5e' },
    ], y + 2);
    y += 14;

    // ── EXPENSES ─────────────────────────────────────────────
    y = rptSection(doc, 'Expenses', y, W, ML, MR);
    y += 4;
    y = rptRow(doc, [
      { text: 'Date', x: ML, w: 55, bold: true, color: '#475569' },
      { text: 'Description', x: ML + 58, w: CW * 0.42, bold: true, color: '#475569' },
      { text: 'Category', x: ML + 58 + CW * 0.42, w: CW * 0.24, bold: true, color: '#475569' },
      { text: 'Amount (Rs.)', x: W - MR - CW * 0.2, w: CW * 0.2, bold: true, right: true, color: '#475569' },
    ], y);
    y = rptDivider(doc, y, W, ML, MR);

    if (data.expenses.length === 0) {
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('No expenses recorded for this month.', ML, y);
      y += 18;
    } else {
      data.expenses.forEach((exp, i) => {
        if (y > doc.page.height - 120) { doc.addPage({ margin: 0 }); y = 40; }
        if (i % 2 === 0) doc.rect(ML, y - 2, CW, 16).fill('#f8fafc');
        const d = new Date(exp.date);
        const ds = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        y = rptRow(doc, [
          { text: ds, x: ML, w: 55, color: '#475569' },
          { text: exp.title, x: ML + 58, w: CW * 0.42 },
          { text: exp.category, x: ML + 58 + CW * 0.42, w: CW * 0.24, color: '#475569' },
          { text: exp.amount.toFixed(2), x: W - MR - CW * 0.2, w: CW * 0.2, right: true },
        ], y);
      });
    }

    y = rptDivider(doc, y + 2, W, ML, MR);
    doc.rect(ML, y - 2, CW, 18).fill('#fef2f2');
    y = rptRow(doc, [
      { text: 'Total Expenses', x: ML + 4, w: CW * 0.8, bold: true, color: '#7f1d1d' },
      { text: data.totalExpenses.toFixed(2), x: W - MR - CW * 0.2, w: CW * 0.2, bold: true, right: true, color: '#7f1d1d' },
    ], y + 2);
    y += 14;

    // ── BANK BALANCE SUMMARY ──────────────────────────────────
    if (y > doc.page.height - 160) { doc.addPage({ margin: 0 }); y = 40; }
    y = rptSection(doc, 'Bank Balance Summary', y, W, ML, MR);
    y += 6;

    if (data.bankAccounts.length === 0) {
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('No bank accounts configured.', ML, y);
      y += 18;
    } else {
      const valW = 130;
      const valX = W - MR - valW;

      data.bankAccounts.forEach((acct) => {
        if (y > doc.page.height - 130) { doc.addPage({ margin: 0 }); y = 40; }
        doc.fillColor('#0c3a5e').fontSize(10).font('Helvetica-Bold')
           .text(acct.name + (acct.accountNumber ? `  (A/C ${acct.accountNumber})` : ''), ML, y);
        y += 16;

        const lines: [string, number, string][] = [
          [`Opening Balance (1 ${data.monthName} ${data.year})`, acct.openingBalance, '#334155'],
          [`+ Income received in ${data.monthName}`, acct.incomeThisMonth, '#166534'],
          [`− Expenses in ${data.monthName}`, acct.expensesThisMonth, '#991b1b'],
        ];
        lines.forEach(([label, amount, color]) => {
          doc.fillColor('#475569').fontSize(9).font('Helvetica').text(label, ML + 16, y, { width: valX - ML - 26 });
          doc.fillColor(color).fontSize(9).font('Helvetica').text(`Rs. ${amount.toFixed(2)}`, valX, y, { width: valW, align: 'right' });
          y += 14;
        });

        doc.moveTo(valX, y).lineTo(W - MR, y).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        y += 5;
        doc.fillColor('#0c3a5e').fontSize(10).font('Helvetica-Bold')
           .text(`Closing Balance (${data.monthName} ${data.year})`, ML + 16, y, { width: valX - ML - 26 });
        doc.fillColor('#0c3a5e').fontSize(10).font('Helvetica-Bold')
           .text(`Rs. ${acct.closingBalance.toFixed(2)}`, valX, y, { width: valW, align: 'right' });
        y += 24;
      });
    }

    // ── Net surplus / deficit ─────────────────────────────────
    y = rptDivider(doc, y, W, ML, MR);
    const net = data.totalIncome - data.totalExpenses;
    const netColor = net >= 0 ? '#166534' : '#991b1b';
    doc.rect(ML, y - 2, CW, 22).fill(net >= 0 ? '#dcfce7' : '#fef2f2');
    doc.fillColor(netColor).fontSize(11).font('Helvetica-Bold')
       .text(net >= 0 ? 'Net Surplus' : 'Net Deficit', ML + 8, y + 4, { width: CW * 0.7 });
    doc.fillColor(netColor).fontSize(11).font('Helvetica-Bold')
       .text(`Rs. ${Math.abs(net).toFixed(2)}`, ML + CW * 0.7, y + 4, { width: CW * 0.3, align: 'right' });

    // ── Footer ────────────────────────────────────────────────
    const FY = doc.page.height - 32;
    doc.moveTo(ML, FY - 8).lineTo(W - MR, FY - 8).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
       .text('Deeghayu Community Welfare Society  ·  Kotigala, Handapangoda.  ·  Confidential', ML, FY, { align: 'center', width: CW });

    doc.end();
  });
}
