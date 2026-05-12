import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';
import { verifyQrToken } from '../../utils/jwt';

const LATE_GRACE_MINUTES = 15;

export class AttendanceService {
  async scan(memberId: string, qrPayload: string) {
    let parsed: { token: string; type: string };
    try {
      parsed = JSON.parse(qrPayload);
    } catch {
      throw new BadRequestError('Invalid QR code format');
    }

    if (parsed.type !== 'EVENT') throw new BadRequestError('Invalid QR code type');

    let eventId: string;
    try {
      const decoded = verifyQrToken(parsed.token);
      eventId = decoded.eventId;
    } catch {
      throw new BadRequestError('QR code has expired or is invalid');
    }

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    const event = eventResult.rows[0];
    if (!event) throw new NotFoundError('Event not found');
    if (event.status !== 'PUBLISHED' && event.status !== 'ONGOING') {
      throw new BadRequestError('Event is not active');
    }
    if (event.qrExpiresAt && new Date(event.qrExpiresAt) < new Date()) {
      throw new BadRequestError('QR code has expired');
    }

    const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
    const member = memberResult.rows[0];
    if (!member) throw new NotFoundError('Member not found');
    if (member.status !== 'ACTIVE') {
      throw new BadRequestError('Your membership is not active');
    }

    const existing = await pool.query(
      'SELECT id FROM attendances WHERE "eventId" = $1 AND "memberId" = $2',
      [eventId, memberId]
    );
    if (existing.rows[0]) throw new BadRequestError('You have already checked in to this event');

    const graceEnd = new Date(new Date(event.startTime).getTime() + LATE_GRACE_MINUTES * 60 * 1000);
    const isLate = new Date() > graceEnd;
    const status = isLate ? 'LATE' : 'PRESENT';

    await pool.query(
      `INSERT INTO attendances (id, "eventId", "memberId", status, "checkedInAt", "isLate")
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [uuidv4(), eventId, memberId, status, isLate]
    );

    return {
      success: true,
      message: isLate ? 'Checked in — marked as late' : 'Checked in successfully!',
      isLate,
      event: { title: event.title, startTime: event.startTime },
    };
  }

  async getLive(eventId: string) {
    const [attendancesResult, eventResult] = await Promise.all([
      pool.query(
        `SELECT a.*, m."fullName", m."membershipId", m."profilePhoto"
         FROM attendances a
         JOIN members m ON m.id = a."memberId"
         WHERE a."eventId" = $1
         ORDER BY a."checkedInAt" DESC`,
        [eventId]
      ),
      pool.query(
        `SELECT title, "maxAttendees", "startTime" FROM events WHERE id = $1`,
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
      count: attendances.length,
      lateCount: attendances.filter((a) => a.isLate).length,
      attendances,
    };
  }

  async getMemberHistory(memberId: string) {
    const result = await pool.query(
      `SELECT a.*, e.title AS "eventTitle", e."startTime" AS "eventStartTime", e.category AS "eventCategory"
       FROM attendances a
       JOIN events e ON e.id = a."eventId"
       WHERE a."memberId" = $1
       ORDER BY a."checkedInAt" DESC`,
      [memberId]
    );

    return result.rows.map(({ eventTitle, eventStartTime, eventCategory, ...a }) => ({
      ...a,
      event: { title: eventTitle, startTime: eventStartTime, category: eventCategory },
    }));
  }

  async getAnalytics() {
    const currentYear = new Date().getFullYear();

    const eventsResult = await pool.query(
      `SELECT e.id, e.title, e."startTime",
              (SELECT COUNT(*) FROM attendances WHERE "eventId" = e.id)::int AS "attendanceCount"
       FROM events e
       WHERE e."startTime" >= $1 AND e.status IN ('COMPLETED', 'ONGOING')`,
      [new Date(`${currentYear}-01-01`)]
    );

    const totalMembersResult = await pool.query(
      `SELECT COUNT(*) FROM members WHERE status = 'ACTIVE'`
    );
    const totalMembers = parseInt(totalMembersResult.rows[0].count, 10);

    return eventsResult.rows.map((event) => ({
      eventId: event.id,
      title: event.title,
      date: event.startTime,
      attendance: event.attendanceCount,
      percentage:
        totalMembers > 0 ? Math.round((event.attendanceCount / totalMembers) * 100) : 0,
    }));
  }
}
