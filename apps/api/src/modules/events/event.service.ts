import { EventCategory, EventStatus, RsvpResponse } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';
import { generateEventQr } from '../../utils/qrCode';
import { sendMail, eventReminderTemplate } from '../../utils/mailer';
import { format } from 'date-fns';

export class EventService {
  async getAll(query: {
    page?: number;
    limit?: number;
    status?: EventStatus;
    category?: EventCategory;
  }) {
    const { skip, take, page, limit } = getPagination(query);
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: {
          _count: { select: { attendances: true, rsvps: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    return paginatedResponse(events, total, page, limit);
  }

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: { select: { attendances: true, rsvps: true } },
        gallery: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }

  async create(data: {
    title: string;
    description?: string;
    category: EventCategory;
    location?: string;
    startTime: string;
    endTime: string;
    maxAttendees?: number | string;
    requiresRsvp?: boolean;
    requiresFee?: boolean;
    feeAmount?: number | string;
    coverImage?: string;
    createdBy: string;
  }) {
    return prisma.event.create({
      data: {
        title: data.title,
        description: data.description || undefined,
        category: data.category,
        location: data.location || undefined,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        maxAttendees: data.maxAttendees ? Number(data.maxAttendees) : undefined,
        requiresRsvp: Boolean(data.requiresRsvp),
        requiresFee: Boolean(data.requiresFee),
        feeAmount: data.feeAmount ? Number(data.feeAmount) : undefined,
        coverImage: data.coverImage || undefined,
        createdBy: data.createdBy,
      },
    });
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    maxAttendees: number;
    coverImage: string;
    status: EventStatus;
  }>) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');

    return prisma.event.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
      },
    });
  }

  async publish(id: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');

    const qrExpiresAt = new Date(event.endTime.getTime() + 30 * 60 * 1000); // expires 30min after event ends
    const qrDataUrl = await generateEventQr(id, qrExpiresAt);

    return prisma.event.update({
      where: { id },
      data: {
        status: EventStatus.PUBLISHED,
        qrCode: qrDataUrl,
        qrExpiresAt,
      },
    });
  }

  async openAttendance(id: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');
    if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
      throw new BadRequestError('Cannot open attendance for a cancelled or completed event');
    }

    // QR valid until event ends + 30 min, or at least 4 hours from now
    const qrExpiresAt = new Date(
      Math.max(event.endTime.getTime() + 30 * 60 * 1000, Date.now() + 4 * 60 * 60 * 1000)
    );
    const qrDataUrl = await generateEventQr(id, qrExpiresAt);

    return prisma.event.update({
      where: { id },
      data: { status: EventStatus.ONGOING, qrCode: qrDataUrl, qrExpiresAt },
    });
  }

  async getQr(id: string) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event not found');
    if (!event.qrCode) throw new BadRequestError('Event has no QR code. Publish the event first.');
    return { qrCode: event.qrCode, qrExpiresAt: event.qrExpiresAt };
  }

  async rsvp(eventId: string, memberId: string, response: RsvpResponse) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');

    return prisma.eventRsvp.upsert({
      where: { eventId_memberId: { eventId, memberId } },
      update: { response },
      create: { eventId, memberId, response },
    });
  }

  async getAttendance(eventId: string) {
    const [attendances, event] = await Promise.all([
      prisma.attendance.findMany({
        where: { eventId },
        include: {
          member: { select: { fullName: true, membershipId: true, profilePhoto: true } },
        },
        orderBy: { checkedInAt: 'asc' },
      }),
      prisma.event.findUnique({ where: { id: eventId }, select: { title: true, maxAttendees: true } }),
    ]);

    return {
      event,
      totalPresent: attendances.filter((a) => !a.isLate).length,
      totalLate: attendances.filter((a) => a.isLate).length,
      attendances,
    };
  }

  async addGalleryPhoto(eventId: string, imageUrl: string, caption: string | undefined, uploadedBy: string) {
    return prisma.eventGallery.create({
      data: { eventId, imageUrl, caption, uploadedBy },
    });
  }

  async sendReminders(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');

    const rsvps = await prisma.eventRsvp.findMany({
      where: { eventId, response: RsvpResponse.GOING },
      include: {
        member: { select: { fullName: true, user: { select: { email: true } } } },
      },
    });

    await Promise.allSettled(
      rsvps.map((r) =>
        sendMail({
          to: r.member.user.email,
          subject: `Reminder: ${event.title}`,
          html: eventReminderTemplate(
            r.member.fullName,
            event.title,
            format(event.startTime, 'PPPp'),
            event.location || 'TBA'
          ),
        })
      )
    );

    return { sent: rsvps.length };
  }
}
