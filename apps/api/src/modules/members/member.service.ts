import { MemberStatus, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';
import { generateMemberQr } from '../../utils/qrCode';
import { generateExcel } from '../../utils/excelGenerator';
import { generateReportPdf } from '../../utils/pdfGenerator';
import { format } from 'date-fns';

export class MemberService {
  async getAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: MemberStatus;
    role?: Role;
  }) {
    const { skip, take, page, limit } = getPagination(query);
    const where: any = {};

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { membershipId: { contains: query.search, mode: 'insensitive' } },
        { nic: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.role) where.user = { role: query.role };

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, role: true } },
          _count: { select: { payments: true, attendances: true } },
        },
      }),
      prisma.member.count({ where }),
    ]);

    return paginatedResponse(members, total, page, limit);
  }

  async getById(id: string) {
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true, lastLoginAt: true, isEmailVerified: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        attendances: {
          orderBy: { checkedInAt: 'desc' },
          take: 10,
          include: { event: { select: { title: true, startTime: true } } },
        },
        committeeRoles: {
          include: { panel: { select: { year: true } } },
        },
      },
    });
    if (!member) throw new NotFoundError('Member not found');
    return member;
  }

  async updateStatus(id: string, status: MemberStatus, adminId: string) {
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundError('Member not found');

    return prisma.member.update({ where: { id }, data: { status } });
  }

  async update(id: string, data: Partial<{
    fullName: string;
    phone: string;
    address: string;
    occupation: string;
    dateOfBirth: string;
    emergencyContact: any;
    familyDetails: any;
    notes: string;
    profilePhoto: string;
  }>) {
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundError('Member not found');

    return prisma.member.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });
  }

  async getQr(id: string) {
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundError('Member not found');

    if (!member.qrCodeUrl) {
      const qrCodeUrl = await generateMemberQr(id, member.membershipId);
      await prisma.member.update({ where: { id }, data: { qrCodeUrl } });
      return { qrCodeUrl };
    }
    return { qrCodeUrl: member.qrCodeUrl };
  }

  async getPayments(memberId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPagination(query);
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { memberId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where: { memberId } }),
    ]);
    return paginatedResponse(payments, total, page, limit);
  }

  async getAttendance(memberId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPagination(query);
    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where: { memberId },
        skip,
        take,
        orderBy: { checkedInAt: 'desc' },
        include: { event: { select: { title: true, startTime: true, category: true } } },
      }),
      prisma.attendance.count({ where: { memberId } }),
    ]);
    return paginatedResponse(records, total, page, limit);
  }

  async exportMembers(format: 'pdf' | 'excel' | 'csv', filters: any) {
    const members = await prisma.member.findMany({
      where: filters.status ? { status: filters.status } : {},
      include: { user: { select: { email: true, role: true } } },
      orderBy: { membershipId: 'asc' },
    });

    if (format === 'excel') {
      return generateExcel('Members Report', [
        { key: 'membershipId', header: 'Member ID', width: 15 },
        { key: 'fullName', header: 'Full Name', width: 25 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 15 },
        { key: 'nic', header: 'NIC', width: 15 },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'role', header: 'Role', width: 18 },
        { key: 'dateJoined', header: 'Date Joined', width: 15 },
      ], members.map((m) => ({
        membershipId: m.membershipId,
        fullName: m.fullName,
        email: m.user.email,
        phone: m.phone,
        nic: m.nic,
        status: m.status,
        role: m.user.role,
        dateJoined: format === 'excel' ? m.dateJoined.toLocaleDateString() : m.dateJoined.toISOString(),
      })));
    }

    if (format === 'pdf') {
      return generateReportPdf({
        title: 'Members Report',
        headers: ['Member ID', 'Name', 'Email', 'Phone', 'Status', 'Date Joined'],
        rows: members.map((m) => [
          m.membershipId,
          m.fullName,
          m.user.email,
          m.phone,
          m.status,
          m.dateJoined.toLocaleDateString(),
        ]),
      });
    }

    // CSV
    const headers = 'Member ID,Full Name,Email,Phone,NIC,Status,Role,Date Joined\n';
    const rows = members.map((m) =>
      `${m.membershipId},"${m.fullName}",${m.user.email},${m.phone},${m.nic},${m.status},${m.user.role},${m.dateJoined.toLocaleDateString()}`
    ).join('\n');
    return Buffer.from(headers + rows, 'utf-8');
  }
}
