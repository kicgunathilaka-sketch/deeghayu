import { MemberStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { generateReportPdf } from '../../utils/pdfGenerator';
import { generateExcel } from '../../utils/excelGenerator';

export class ReportService {
  async getDashboardStats() {
    const [
      totalMembers,
      activeMembers,
      pendingMembers,
      currentMonthIncome,
      pendingPayments,
      upcomingEvents,
      recentActivity,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { status: MemberStatus.ACTIVE } }),
      prisma.member.count({ where: { status: MemberStatus.PENDING } }),
      prisma.payment.aggregate({
        where: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] },
        },
        _sum: { paidAmount: true },
      }),
      prisma.payment.count({
        where: { status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] } },
      }),
      prisma.event.findMany({
        where: { startTime: { gte: new Date() }, status: { in: ['PUBLISHED', 'ONGOING'] as any } },
        orderBy: { startTime: 'asc' },
        take: 5,
        select: { id: true, title: true, startTime: true, category: true, location: true },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true, member: { select: { fullName: true } } } } },
      }),
    ]);

    return {
      totalMembers,
      activeMembers,
      pendingMembers,
      currentMonthIncome: Number(currentMonthIncome._sum.paidAmount || 0),
      pendingPayments,
      upcomingEvents,
      recentActivity,
    };
  }

  async getFinancialReport(year: number) {
    const [payments, expenses, summary] = await Promise.all([
      prisma.payment.findMany({
        where: { year },
        include: { member: { select: { fullName: true, membershipId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: { year },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.aggregate({
        where: { year, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } },
        _sum: { paidAmount: true },
      }),
    ]);

    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalIncome = Number(summary._sum.paidAmount || 0);

    return {
      year,
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      payments,
      expenses,
    };
  }

  async exportReport(
    type: 'members' | 'payments' | 'attendance' | 'finance',
    format: 'pdf' | 'excel' | 'csv',
    filters: any
  ) {
    if (type === 'members') {
      const members = await prisma.member.findMany({
        include: { user: { select: { email: true, role: true } } },
        orderBy: { membershipId: 'asc' },
      });

      if (format === 'excel') {
        return generateExcel('Members Report', [
          { key: 'membershipId', header: 'ID', width: 12 },
          { key: 'fullName', header: 'Full Name', width: 25 },
          { key: 'email', header: 'Email', width: 30 },
          { key: 'phone', header: 'Phone', width: 15 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'dateJoined', header: 'Joined', width: 15 },
        ], members.map((m) => ({
          membershipId: m.membershipId,
          fullName: m.fullName,
          email: m.user.email,
          phone: m.phone,
          status: m.status,
          dateJoined: m.dateJoined.toLocaleDateString(),
        })));
      }

      return generateReportPdf({
        title: 'Members Report',
        headers: ['ID', 'Name', 'Email', 'Phone', 'Status', 'Date Joined'],
        rows: members.map((m) => [
          m.membershipId, m.fullName, m.user.email, m.phone, m.status,
          m.dateJoined.toLocaleDateString(),
        ]),
      });
    }

    if (type === 'payments') {
      const year = filters.year ? Number(filters.year) : new Date().getFullYear();
      const payments = await prisma.payment.findMany({
        where: { year },
        include: { member: { select: { fullName: true, membershipId: true } } },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'excel') {
        return generateExcel(`Payments ${year}`, [
          { key: 'membershipId', header: 'Member ID', width: 12 },
          { key: 'fullName', header: 'Member', width: 25 },
          { key: 'type', header: 'Type', width: 15 },
          { key: 'amount', header: 'Amount', width: 12 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'paidAt', header: 'Paid At', width: 15 },
        ], payments.map((p) => ({
          membershipId: p.member.membershipId,
          fullName: p.member.fullName,
          type: p.type,
          amount: Number(p.amount).toFixed(2),
          status: p.status,
          paidAt: p.paidAt ? p.paidAt.toLocaleDateString() : '-',
        })));
      }

      return generateReportPdf({
        title: `Payments Report — ${year}`,
        headers: ['Member ID', 'Name', 'Type', 'Amount', 'Status', 'Paid At'],
        rows: payments.map((p) => [
          p.member.membershipId, p.member.fullName, p.type,
          `Rs. ${Number(p.amount).toFixed(2)}`, p.status,
          p.paidAt ? p.paidAt.toLocaleDateString() : '-',
        ]),
      });
    }

    throw new Error(`Unknown report type: ${type}`);
  }
}
