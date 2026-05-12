import { PaymentStatus, PaymentType } from '@prisma/client';
import { prisma } from '../../config/database';
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
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.month) where.month = Number(query.month);
    if (query.year) where.year = Number(query.year);
    if (query.search) {
      where.member = {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { membershipId: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          member: { select: { fullName: true, membershipId: true, user: { select: { email: true } } } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return paginatedResponse(payments, total, page, limit);
  }

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        member: { select: { fullName: true, membershipId: true, address: true } },
      },
    });
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  }

  async create(data: {
    memberId: string;
    type: PaymentType;
    amount: number;
    paidAmount?: number;
    dueDate?: string;
    month?: number;
    year?: number;
    description?: string;
    recordedBy: string;
  }) {
    const member = await prisma.member.findUnique({ where: { id: data.memberId } });
    if (!member) throw new NotFoundError('Member not found');

    const paidAmount = data.paidAmount ?? data.amount;
    let status: PaymentStatus = PaymentStatus.PAID;
    if (paidAmount === 0) status = PaymentStatus.PENDING;
    else if (paidAmount < data.amount) status = PaymentStatus.PARTIAL;

    return prisma.payment.create({
      data: {
        memberId: data.memberId,
        type: data.type,
        amount: data.amount,
        paidAmount: paidAmount,
        status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        paidAt: paidAmount > 0 ? new Date() : undefined,
        month: data.month,
        year: data.year,
        description: data.description,
        recordedBy: data.recordedBy,
      },
    });
  }

  async update(id: string, data: Partial<{
    status: PaymentStatus;
    paidAmount: number;
    description: string;
  }>) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundError('Payment not found');

    const updatedPaidAmount = data.paidAmount ?? Number(payment.paidAmount);
    const amount = Number(payment.amount);
    let status = data.status;
    if (!status) {
      if (updatedPaidAmount >= amount) status = PaymentStatus.PAID;
      else if (updatedPaidAmount > 0) status = PaymentStatus.PARTIAL;
    }

    return prisma.payment.update({
      where: { id },
      data: {
        ...data,
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : payment.paidAt,
      },
    });
  }

  async getReceipt(id: string): Promise<Buffer> {
    const payment = await this.getById(id);
    if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.PARTIAL) {
      throw new NotFoundError('No receipt for unpaid payment');
    }

    return generateReceiptPdf({
      memberName: payment.member.fullName,
      membershipId: payment.member.membershipId,
      amount: Number(payment.paidAmount),
      type: payment.type,
      description: payment.description || undefined,
      paidAt: payment.paidAt || new Date(),
      receiptNumber: `RCP-${payment.id.slice(-8).toUpperCase()}`,
    });
  }

  async getSummary(year: number, month?: number) {
    const where: any = { year };
    if (month) where.month = month;

    const [totalIncome, totalPending, totalOverdue, byType] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...where, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } },
        _sum: { paidAmount: true },
      }),
      prisma.payment.count({ where: { ...where, status: PaymentStatus.PENDING } }),
      prisma.payment.count({ where: { ...where, status: PaymentStatus.OVERDUE } }),
      prisma.payment.groupBy({
        by: ['type'],
        where,
        _sum: { paidAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalIncome: totalIncome._sum.paidAmount || 0,
      pendingCount: totalPending,
      overdueCount: totalOverdue,
      byType,
    };
  }

  async getOverdue() {
    return prisma.payment.findMany({
      where: {
        OR: [
          { status: PaymentStatus.OVERDUE },
          { status: PaymentStatus.PENDING, dueDate: { lt: new Date() } },
        ],
      },
      include: {
        member: { select: { fullName: true, membershipId: true, user: { select: { email: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async sendBulkReminders(paymentIds: string[]) {
    const payments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: {
        member: { select: { fullName: true, user: { select: { email: true } } } },
      },
    });

    const results = await Promise.allSettled(
      payments.map((p) =>
        sendMail({
          to: p.member.user.email,
          subject: 'Payment Reminder — Deeghayu Community',
          html: paymentReminderTemplate(
            p.member.fullName,
            Number(p.amount).toFixed(2),
            p.dueDate ? format(p.dueDate, 'PPP') : 'N/A'
          ),
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    return { sent, failed: results.length - sent };
  }

  async getAnalytics(year: number) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const data = await Promise.all(
      months.map(async (month) => {
        const agg = await prisma.payment.aggregate({
          where: { year, month, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } },
          _sum: { paidAmount: true },
        });
        return { month, income: Number(agg._sum.paidAmount || 0) };
      })
    );
    return data;
  }
}
