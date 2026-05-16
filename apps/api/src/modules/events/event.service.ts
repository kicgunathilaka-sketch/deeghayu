import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { EventCategory, EventStatus, RsvpResponse } from '../../types';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';
import { generateEventQr } from '../../utils/qrCode';
import { sendMail, eventReminderTemplate } from '../../utils/mailer';
import { format } from 'date-fns';
import { NotificationService } from '../notifications/notification.service';

const notificationService = new NotificationService();

export class EventService {
  async getAll(query: {
    page?: number;
    limit?: number;
    status?: EventStatus;
    category?: EventCategory;
  }) {
    const { skip, take, page, limit } = getPagination(query);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (query.status) {
      conditions.push(`status = $${i}`);
      params.push(query.status);
      i++;
    }
    if (query.category) {
      conditions.push(`category = $${i}`);
      params.push(query.category);
      i++;
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT e.*,
                (SELECT COUNT(*) FROM attendances WHERE "eventId" = e.id)::int AS "attendanceCount",
                (SELECT COUNT(*) FROM event_rsvps WHERE "eventId" = e.id)::int AS "rsvpCount"
         FROM events e
         WHERE ${where}
         ORDER BY e."startTime" DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, take, skip]
      ),
      pool.query(`SELECT COUNT(*) FROM events WHERE ${where}`, params),
    ]);

    const events = dataResult.rows.map(({ attendanceCount, rsvpCount, ...e }) => ({
      ...e,
      _count: { attendances: attendanceCount, rsvps: rsvpCount },
    }));

    return paginatedResponse(events, parseInt(countResult.rows[0].count, 10), page, limit);
  }

  async getById(id: string) {
    const [eventResult, galleryResult] = await Promise.all([
      pool.query(
        `SELECT e.*,
                (SELECT COUNT(*) FROM attendances WHERE "eventId" = e.id)::int AS "attendanceCount",
                (SELECT COUNT(*) FROM event_rsvps WHERE "eventId" = e.id)::int AS "rsvpCount"
         FROM events e WHERE e.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM event_gallery WHERE "eventId" = $1 ORDER BY "createdAt" DESC`,
        [id]
      ),
    ]);

    if (!eventResult.rows[0]) throw new NotFoundError('Event not found');

    const { attendanceCount, rsvpCount, ...event } = eventResult.rows[0];
    return {
      ...event,
      _count: { attendances: attendanceCount, rsvps: rsvpCount },
      gallery: galleryResult.rows,
    };
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
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO events (id, title, description, category, status, location, "startTime", "endTime",
                          "maxAttendees", "requiresRsvp", "requiresFee", "feeAmount", "coverImage", "createdBy", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
       RETURNING *`,
      [
        id,
        data.title,
        data.description || null,
        data.category,
        data.location || null,
        new Date(data.startTime),
        new Date(data.endTime),
        data.maxAttendees ? Number(data.maxAttendees) : null,
        Boolean(data.requiresRsvp),
        Boolean(data.requiresFee),
        data.feeAmount ? Number(data.feeAmount) : null,
        data.coverImage || null,
        data.createdBy,
      ]
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      location: string;
      startTime: string;
      endTime: string;
      maxAttendees: number;
      coverImage: string;
      status: EventStatus;
    }>
  ) {
    const existing = await pool.query('SELECT id FROM events WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Event not found');

    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    const mappings: Record<string, string> = {
      title: 'title',
      description: 'description',
      location: 'location',
      maxAttendees: '"maxAttendees"',
      coverImage: '"coverImage"',
      status: 'status',
    };

    for (const [key, col] of Object.entries(mappings)) {
      if (data[key as keyof typeof data] !== undefined) {
        fields.push(`${col} = $${i}`);
        params.push(data[key as keyof typeof data]);
        i++;
      }
    }

    if (data.startTime) {
      fields.push(`"startTime" = $${i}`);
      params.push(new Date(data.startTime));
      i++;
    }
    if (data.endTime) {
      fields.push(`"endTime" = $${i}`);
      params.push(new Date(data.endTime));
      i++;
    }

    if (fields.length === 0) return existing.rows[0];

    fields.push(`"updatedAt" = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async publish(id: string) {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    const event = result.rows[0];
    if (!event) throw new NotFoundError('Event not found');

    const qrExpiresAt = new Date(new Date(event.endTime).getTime() + 30 * 60 * 1000);
    const qrDataUrl = await generateEventQr(id, qrExpiresAt);

    const updated = await pool.query(
      `UPDATE events SET status = 'PUBLISHED', "qrCode" = $1, "qrExpiresAt" = $2, "updatedAt" = NOW()
       WHERE id = $3 RETURNING *`,
      [qrDataUrl, qrExpiresAt, id]
    );

    // Notify all members
    notificationService.broadcast({
      title: `New Event: ${event.title}`,
      body: `${event.title} has been published. It starts on ${format(new Date(event.startTime), 'PPP')}${event.location ? ` at ${event.location}` : ''}.`,
      type: 'IN_APP',
      link: `/events/${id}`,
    }).catch(() => {}); // fire-and-forget

    return updated.rows[0];
  }

  async openAttendance(id: string) {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    const event = result.rows[0];
    if (!event) throw new NotFoundError('Event not found');

    if (event.status === 'CANCELLED' || event.status === 'COMPLETED') {
      throw new BadRequestError('Cannot open attendance for a cancelled or completed event');
    }

    const qrExpiresAt = new Date(
      Math.max(
        new Date(event.endTime).getTime() + 30 * 60 * 1000,
        Date.now() + 4 * 60 * 60 * 1000
      )
    );
    const qrDataUrl = await generateEventQr(id, qrExpiresAt);

    const updated = await pool.query(
      `UPDATE events SET status = 'ONGOING', "qrCode" = $1, "qrExpiresAt" = $2, "updatedAt" = NOW()
       WHERE id = $3 RETURNING *`,
      [qrDataUrl, qrExpiresAt, id]
    );
    return updated.rows[0];
  }

  async getQr(id: string) {
    const result = await pool.query(
      `SELECT "qrCode", "qrExpiresAt" FROM events WHERE id = $1`,
      [id]
    );
    const event = result.rows[0];
    if (!event) throw new NotFoundError('Event not found');
    if (!event.qrCode) throw new BadRequestError('Event has no QR code. Publish the event first.');
    return { qrCode: event.qrCode, qrExpiresAt: event.qrExpiresAt };
  }

  async rsvp(eventId: string, memberId: string, response: RsvpResponse) {
    const existing = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!existing.rows[0]) throw new NotFoundError('Event not found');

    const result = await pool.query(
      `INSERT INTO event_rsvps (id, "eventId", "memberId", response, "createdAt")
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT ("eventId", "memberId") DO UPDATE SET response = EXCLUDED.response
       RETURNING *`,
      [uuidv4(), eventId, memberId, response]
    );
    return result.rows[0];
  }

  async getAttendance(eventId: string) {
    const [attendancesResult, eventResult] = await Promise.all([
      pool.query(
        `SELECT a.*, m."fullName", m."membershipId", m."profilePhoto"
         FROM attendances a
         JOIN members m ON m.id = a."memberId"
         WHERE a."eventId" = $1
         ORDER BY a."checkedInAt" ASC`,
        [eventId]
      ),
      pool.query(
        `SELECT title, "maxAttendees" FROM events WHERE id = $1`,
        [eventId]
      ),
    ]);

    const attendances = attendancesResult.rows.map(
      ({ fullName, membershipId, profilePhoto, ...a }) => ({
        ...a,
        member: { fullName, membershipId, profilePhoto },
      })
    );

    return {
      event: eventResult.rows[0],
      totalPresent: attendances.filter((a) => !a.isLate).length,
      totalLate: attendances.filter((a) => a.isLate).length,
      attendances,
    };
  }

  async addGalleryPhoto(
    eventId: string,
    imageUrl: string,
    caption: string | undefined,
    uploadedBy: string
  ) {
    const result = await pool.query(
      `INSERT INTO event_gallery (id, "eventId", "imageUrl", caption, "uploadedBy", "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [uuidv4(), eventId, imageUrl, caption || null, uploadedBy]
    );
    return result.rows[0];
  }

  async sendReminders(eventId: string) {
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!eventResult.rows[0]) throw new NotFoundError('Event not found');
    const event = eventResult.rows[0];

    const rsvpsResult = await pool.query(
      `SELECT m."fullName", u.email
       FROM event_rsvps er
       JOIN members m ON m.id = er."memberId"
       JOIN users u ON u.id = m."userId"
       WHERE er."eventId" = $1 AND er.response = 'GOING'`,
      [eventId]
    );

    await Promise.allSettled(
      rsvpsResult.rows.map((r) =>
        sendMail({
          to: r.email,
          subject: `Reminder: ${event.title}`,
          html: eventReminderTemplate(
            r.fullName,
            event.title,
            format(new Date(event.startTime), 'PPPp'),
            event.location || 'TBA'
          ),
        })
      )
    );

    return { sent: rsvpsResult.rows.length };
  }
}
