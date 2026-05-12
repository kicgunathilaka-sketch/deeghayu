import { AttendanceStatus, EventStatus, MemberStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { verifyQrToken } from '../../utils/jwt';

const LATE_GRACE_MINUTES = 15;

export class AttendanceService {
  async scan(memberId: string, qrPayload: string) {
    // Parse QR payload
    let parsed: { token: string; type: string };
    try {
      parsed = JSON.parse(qrPayload);
    } catch {
      throw new BadRequestError('Invalid QR code format');
    }

    if (parsed.type !== 'EVENT') throw new BadRequestError('Invalid QR code type');

    // Verify JWT token
    let eventId: string;
    try {
      const decoded = verifyQrToken(parsed.token);
      eventId = decoded.eventId;
    } catch {
      throw new BadRequestError('QR code has expired or is invalid');
    }

    // Validate event
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');
    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.ONGOING) {
      throw new BadRequestError('Event is not active');
    }
    if (event.qrExpiresAt && event.qrExpiresAt < new Date()) {
      throw new BadRequestError('QR code has expired');
    }

    // Validate member
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundError('Member not found');
    if (member.status !== MemberStatus.ACTIVE) {
      throw new BadRequestError('Your membership is not active');
    }

    // Check duplicate
    const existing = await prisma.attendance.findUnique({
      where: { eventId_memberId: { eventId, memberId } },
    });
    if (existing) throw new BadRequestError('You have already checked in to this event');

    // Determine late status
    const graceEnd = new Date(event.startTime.getTime() + LATE_GRACE_MINUTES * 60 * 1000);
    const isLate = new Date() > graceEnd;

    const attendance = await prisma.attendance.create({
      data: {
        eventId,
        memberId,
        status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        isLate,
      },
    });

    return {
      success: true,
      message: isLate ? 'Checked in — marked as late' : 'Checked in successfully!',
      isLate,
      event: { title: event.title, startTime: event.startTime },
    };
  }

  async getLive(eventId: string) {
    const [attendances, event] = await Promise.all([
      prisma.attendance.findMany({
        where: { eventId },
        include: {
          member: { select: { fullName: true, membershipId: true, profilePhoto: true } },
        },
        orderBy: { checkedInAt: 'desc' },
      }),
      prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, maxAttendees: true, startTime: true },
      }),
    ]);

    return {
      event,
      count: attendances.length,
      lateCount: attendances.filter((a) => a.isLate).length,
      attendances,
    };
  }

  async getMemberHistory(memberId: string) {
    return prisma.attendance.findMany({
      where: { memberId },
      include: {
        event: { select: { title: true, startTime: true, category: true } },
      },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  async getAnalytics() {
    const currentYear = new Date().getFullYear();
    const events = await prisma.event.findMany({
      where: {
        startTime: { gte: new Date(`${currentYear}-01-01`) },
        status: { in: [EventStatus.COMPLETED, EventStatus.ONGOING] },
      },
      include: {
        _count: { select: { attendances: true } },
      },
    });

    const totalMembers = await prisma.member.count({ where: { status: MemberStatus.ACTIVE } });

    return events.map((event) => ({
      eventId: event.id,
      title: event.title,
      date: event.startTime,
      attendance: event._count.attendances,
      percentage: totalMembers > 0 ? Math.round((event._count.attendances / totalMembers) * 100) : 0,
    }));
  }
}
