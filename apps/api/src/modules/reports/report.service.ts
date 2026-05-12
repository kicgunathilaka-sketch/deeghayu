import { pool } from '../../config/database';
import { generateReportPdf } from '../../utils/pdfGenerator';
import { generateExcel } from '../../utils/excelGenerator';

export class ReportService {
  async getDashboardStats() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [
      totalMembersResult,
      activeMembersResult,
      pendingMembersResult,
      currentMonthIncomeResult,
      pendingPaymentsResult,
      upcomingEventsResult,
      recentActivityResult,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM members`),
      pool.query(`SELECT COUNT(*) FROM members WHERE status = 'ACTIVE'`),
      pool.query(`SELECT COUNT(*) FROM members WHERE status = 'PENDING'`),
      pool.query(
        `SELECT COALESCE(SUM("paidAmount"), 0) AS total FROM payments WHERE year = $1 AND month = $2 AND status IN ('PAID', 'PARTIAL')`,
        [year, month]
      ),
      pool.query(
        `SELECT COUNT(*) FROM payments WHERE status IN ('PENDING', 'OVERDUE')`
      ),
      pool.query(
        `SELECT id, title, "startTime", category, location FROM events
         WHERE "startTime" >= NOW() AND status IN ('PUBLISHED', 'ONGOING')
         ORDER BY "startTime" ASC LIMIT 5`
      ),
      pool.query(
        `SELECT al.*, u.email, m."fullName"
         FROM audit_logs al
         JOIN users u ON u.id = al."userId"
         LEFT JOIN members m ON m."userId" = u.id
         ORDER BY al."createdAt" DESC LIMIT 10`
      ),
    ]);

    const recentActivity = recentActivityResult.rows.map(({ email, fullName, ...al }) => ({
      ...al,
      user: { email, member: fullName ? { fullName } : null },
    }));

    return {
      totalMembers: parseInt(totalMembersResult.rows[0].count, 10),
      activeMembers: parseInt(activeMembersResult.rows[0].count, 10),
      pendingMembers: parseInt(pendingMembersResult.rows[0].count, 10),
      currentMonthIncome: Number(currentMonthIncomeResult.rows[0].total),
      pendingPayments: parseInt(pendingPaymentsResult.rows[0].count, 10),
      upcomingEvents: upcomingEventsResult.rows,
      recentActivity,
    };
  }

  async getFinancialReport(year: number) {
    const [paymentsResult, expensesResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT p.*, m."fullName", m."membershipId"
         FROM payments p
         JOIN members m ON m.id = p."memberId"
         WHERE p.year = $1
         ORDER BY p."createdAt" DESC`,
        [year]
      ),
      pool.query(
        `SELECT * FROM expenses WHERE year = $1 ORDER BY date DESC`,
        [year]
      ),
      pool.query(
        `SELECT COALESCE(SUM("paidAmount"), 0) AS total FROM payments
         WHERE year = $1 AND status IN ('PAID', 'PARTIAL')`,
        [year]
      ),
    ]);

    const payments = paymentsResult.rows.map(({ fullName, membershipId, ...p }) => ({
      ...p,
      member: { fullName, membershipId },
    }));

    const totalExpenses = expensesResult.rows.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalIncome = Number(summaryResult.rows[0].total);

    return {
      year,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      payments,
      expenses: expensesResult.rows,
    };
  }

  async exportReport(
    type: 'members' | 'payments' | 'attendance' | 'finance',
    fmt: 'pdf' | 'excel' | 'csv',
    filters: any
  ) {
    if (type === 'members') {
      const result = await pool.query(
        `SELECT m.*, u.email, u.role FROM members m JOIN users u ON u.id = m."userId" ORDER BY m."membershipId" ASC`
      );
      const members = result.rows;

      if (fmt === 'excel') {
        return generateExcel(
          'Members Report',
          [
            { key: 'membershipId', header: 'ID', width: 12 },
            { key: 'fullName', header: 'Full Name', width: 25 },
            { key: 'email', header: 'Email', width: 30 },
            { key: 'phone', header: 'Phone', width: 15 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'dateJoined', header: 'Joined', width: 15 },
          ],
          members.map((m) => ({
            membershipId: m.membershipId,
            fullName: m.fullName,
            email: m.email,
            phone: m.phone,
            status: m.status,
            dateJoined: new Date(m.dateJoined).toLocaleDateString(),
          }))
        );
      }

      return generateReportPdf({
        title: 'Members Report',
        headers: ['ID', 'Name', 'Email', 'Phone', 'Status', 'Date Joined'],
        rows: members.map((m) => [
          m.membershipId,
          m.fullName,
          m.email,
          m.phone,
          m.status,
          new Date(m.dateJoined).toLocaleDateString(),
        ]),
      });
    }

    if (type === 'payments') {
      const year = filters.year ? Number(filters.year) : new Date().getFullYear();
      const result = await pool.query(
        `SELECT p.*, m."fullName", m."membershipId"
         FROM payments p
         JOIN members m ON m.id = p."memberId"
         WHERE p.year = $1
         ORDER BY p."createdAt" DESC`,
        [year]
      );
      const payments = result.rows;

      if (fmt === 'excel') {
        return generateExcel(
          `Payments ${year}`,
          [
            { key: 'membershipId', header: 'Member ID', width: 12 },
            { key: 'fullName', header: 'Member', width: 25 },
            { key: 'type', header: 'Type', width: 15 },
            { key: 'amount', header: 'Amount', width: 12 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'paidAt', header: 'Paid At', width: 15 },
          ],
          payments.map((p) => ({
            membershipId: p.membershipId,
            fullName: p.fullName,
            type: p.type,
            amount: Number(p.amount).toFixed(2),
            status: p.status,
            paidAt: p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-',
          }))
        );
      }

      return generateReportPdf({
        title: `Payments Report — ${year}`,
        headers: ['Member ID', 'Name', 'Type', 'Amount', 'Status', 'Paid At'],
        rows: payments.map((p) => [
          p.membershipId,
          p.fullName,
          p.type,
          `Rs. ${Number(p.amount).toFixed(2)}`,
          p.status,
          p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '-',
        ]),
      });
    }

    throw new Error(`Unknown report type: ${type}`);
  }
}
