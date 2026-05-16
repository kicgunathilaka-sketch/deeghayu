import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { PaymentStatus, PaymentType } from '../../types';
import { NotFoundError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';
import { generateReceiptPdf } from '../../utils/pdfGenerator';
import { generateExcel } from '../../utils/excelGenerator';
import { sendMail, paymentReminderTemplate } from '../../utils/mailer';
import { format } from 'date-fns';

export class PaymentService {
  async getAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PaymentStatus;
    type?: PaymentType;
    month?: number;
    year?: number;
  }) {
    const { skip, take, page, limit } = getPagination(query);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (query.status) {
      conditions.push(`p.status = $${i}`);
      params.push(query.status);
      i++;
    }
    if (query.type) {
      conditions.push(`p.type = $${i}`);
      params.push(query.type);
      i++;
    }
    if (query.month) {
      conditions.push(`p.month = $${i}`);
      params.push(Number(query.month));
      i++;
    }
    if (query.year) {
      conditions.push(`p.year = $${i}`);
      params.push(Number(query.year));
      i++;
    }
    if (query.search) {
      conditions.push(
        `(m."fullName" ILIKE $${i} OR m."membershipId" ILIKE $${i})`
      );
      params.push(`%${query.search}%`);
      i++;
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT p.*, m."fullName", m."membershipId", u.email
         FROM payments p
         JOIN members m ON m.id = p."memberId"
         JOIN users u ON u.id = m."userId"
         WHERE ${where}
         ORDER BY p."createdAt" DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, take, skip]
      ),
      pool.query(
        `SELECT COUNT(*) FROM payments p
         JOIN members m ON m.id = p."memberId"
         JOIN users u ON u.id = m."userId"
         WHERE ${where}`,
        params
      ),
    ]);

    const payments = dataResult.rows.map(({ fullName, membershipId, email, ...p }) => ({
      ...p,
      member: { fullName, membershipId, user: { email } },
    }));

    return paginatedResponse(payments, parseInt(countResult.rows[0].count, 10), page, limit);
  }

  async getById(id: string) {
    const result = await pool.query(
      `SELECT p.*, m."fullName", m."membershipId", m.address
       FROM payments p
       JOIN members m ON m.id = p."memberId"
       WHERE p.id = $1`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError('Payment not found');
    const { fullName, membershipId, address, ...p } = result.rows[0];
    return { ...p, member: { fullName, membershipId, address } };
  }

  async create(data: {
    memberId: string;
    type: PaymentType;
    customType?: string;
    amount: number;
    paidAmount?: number;
    dueDate?: string;
    month?: number;
    year?: number;
    description?: string;
    recordedBy: string;
  }) {
    const memberCheck = await pool.query('SELECT id FROM members WHERE id = $1', [data.memberId]);
    if (!memberCheck.rows[0]) throw new NotFoundError('Member not found');

    const amount = Number(data.amount);
    const paidAmount = (data.paidAmount != null && String(data.paidAmount).trim() !== '')
      ? Number(data.paidAmount)
      : amount;

    let status: PaymentStatus = 'PAID';
    if (paidAmount === 0) status = 'PENDING';
    else if (paidAmount < amount) status = 'PARTIAL';

    const customType = (data.type === 'CUSTOM' && data.customType?.trim())
      ? data.customType.trim()
      : null;

    // Auto-set dueDate from the matching MONTHLY_MEETING event when not provided
    let dueDate: Date | null = data.dueDate ? new Date(data.dueDate) : null;
    if (!dueDate && data.type === 'MONTHLY_MEETING' && data.month && data.year) {
      const eventRes = await pool.query(
        `SELECT "startTime" FROM events
         WHERE category = 'MONTHLY_MEETING'
           AND EXTRACT(MONTH FROM "startTime") = $1
           AND EXTRACT(YEAR FROM "startTime") = $2
         ORDER BY "startTime" ASC LIMIT 1`,
        [data.month, data.year]
      );
      if (eventRes.rows[0]) {
        dueDate = new Date(eventRes.rows[0].startTime);
      }
    }

    // If dueDate is already past and payment is not fully paid, mark as OVERDUE immediately
    if (dueDate && dueDate < new Date() && status !== 'PAID') {
      status = 'OVERDUE';
    }

    const result = await pool.query(
      `INSERT INTO payments (id, "memberId", type, "customType", status, amount, "paidAmount", "dueDate", "paidAt",
                            month, year, description, "recordedBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *`,
      [
        uuidv4(),
        data.memberId,
        data.type,
        customType,
        status,
        amount,
        paidAmount,
        dueDate,
        paidAmount > 0 ? new Date() : null,
        data.month ? Number(data.month) : null,
        data.year ? Number(data.year) : null,
        data.description || null,
        data.recordedBy,
      ]
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      status: PaymentStatus;
      paidAmount: number;
      description: string;
    }>
  ) {
    const existing = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Payment not found');
    const payment = existing.rows[0];

    const updatedPaidAmount = data.paidAmount ?? Number(payment.paidAmount);
    const amount = Number(payment.amount);
    const isPastDue = payment.dueDate && new Date(payment.dueDate) < new Date();
    let status = data.status;
    if (!status) {
      if (updatedPaidAmount >= amount) status = 'PAID';
      else if (isPastDue) status = 'OVERDUE';
      else if (updatedPaidAmount > 0) status = 'PARTIAL';
      else status = 'PENDING';
    }

    const result = await pool.query(
      `UPDATE payments SET
        status = $1,
        "paidAmount" = $2,
        description = COALESCE($3, description),
        "paidAt" = CASE WHEN $1 = 'PAID' THEN COALESCE("paidAt", NOW()) ELSE "paidAt" END,
        "updatedAt" = NOW()
       WHERE id = $4 RETURNING *`,
      [status, updatedPaidAmount, data.description || null, id]
    );
    return result.rows[0];
  }

  async getReceipt(id: string): Promise<Buffer> {
    const payment = await this.getById(id);
    if (payment.status !== 'PAID' && payment.status !== 'PARTIAL') {
      throw new NotFoundError('No receipt for unpaid payment');
    }

    return generateReceiptPdf({
      memberName: payment.member.fullName,
      membershipId: payment.member.membershipId,
      amount: Number(payment.paidAmount),
      type: payment.type,
      description: payment.description || undefined,
      paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
      receiptNumber: `RCP-${payment.id.slice(-8).toUpperCase()}`,
    });
  }

  async getSummary(year: number, month?: number) {
    const conditions = ['year = $1'];
    const params: any[] = [year];
    let i = 2;

    if (month) {
      conditions.push(`month = $${i}`);
      params.push(month);
      i++;
    }

    const where = conditions.join(' AND ');
    const paidWhere = `${where} AND status IN ('PAID', 'PARTIAL')`;

    const [incomeResult, pendingResult, overdueResult, byTypeResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM("paidAmount"), 0) AS total FROM payments WHERE ${paidWhere}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM payments WHERE ${where} AND status = 'PENDING'`,
        params
      ),
      pool.query(
        `SELECT COUNT(*) FROM payments WHERE ${where} AND status = 'OVERDUE'`,
        params
      ),
      pool.query(
        `SELECT type, COUNT(*)::int AS "_count", COALESCE(SUM("paidAmount"), 0) AS "paidAmount"
         FROM payments WHERE ${where} GROUP BY type`,
        params
      ),
    ]);

    return {
      totalIncome: Number(incomeResult.rows[0].total),
      pendingCount: parseInt(pendingResult.rows[0].count, 10),
      overdueCount: parseInt(overdueResult.rows[0].count, 10),
      byType: byTypeResult.rows.map((r) => ({
        type: r.type,
        _count: r._count,
        _sum: { paidAmount: Number(r.paidAmount) },
      })),
    };
  }

  async getOverdue() {
    const result = await pool.query(
      `SELECT p.*, m."fullName", m."membershipId", u.email
       FROM payments p
       JOIN members m ON m.id = p."memberId"
       JOIN users u ON u.id = m."userId"
       WHERE p.status = 'OVERDUE'
          OR (p.status IN ('PENDING', 'PARTIAL') AND p."dueDate" IS NOT NULL AND p."dueDate" < NOW())
       ORDER BY p."dueDate" ASC`
    );

    return result.rows.map(({ fullName, membershipId, email, ...p }) => ({
      ...p,
      member: { fullName, membershipId, user: { email } },
    }));
  }

  async sendBulkReminders(paymentIds: string[]) {
    if (paymentIds.length === 0) return { sent: 0, failed: 0 };

    const placeholders = paymentIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT p.*, m."fullName", u.email
       FROM payments p
       JOIN members m ON m.id = p."memberId"
       JOIN users u ON u.id = m."userId"
       WHERE p.id IN (${placeholders})`,
      paymentIds
    );

    const results = await Promise.allSettled(
      result.rows.map((p) =>
        sendMail({
          to: p.email,
          subject: 'Payment Reminder — Deeghayu Community',
          html: paymentReminderTemplate(
            p.fullName,
            Number(p.amount).toFixed(2),
            p.dueDate ? format(new Date(p.dueDate), 'PPP') : 'N/A'
          ),
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return { sent, failed: results.length - sent };
  }

  async getAnalytics(year: number) {
    const result = await pool.query(
      `SELECT month, COALESCE(SUM("paidAmount"), 0) AS income
       FROM payments
       WHERE year = $1 AND status IN ('PAID', 'PARTIAL')
       GROUP BY month`,
      [year]
    );

    const byMonth: Record<number, number> = {};
    result.rows.forEach((r) => {
      byMonth[r.month] = Number(r.income);
    });

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: byMonth[i + 1] ?? 0,
    }));
  }
}
