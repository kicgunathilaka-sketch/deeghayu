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
