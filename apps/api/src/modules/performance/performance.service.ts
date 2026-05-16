import { pool } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

interface MemberScore {
  memberId: string;
  fullName: string;
  membershipId: string;
  profilePhoto: string | null;
  status: string;
  score: number;
  grade: string;
  gradeColor: string;
  rank?: number;
  breakdown: {
    attendance: {
      score: number;
      maxScore: number;
      totalEvents: number;
      attended: number;
      onTime: number;
      late: number;
      attendanceRate: number;
      punctualityRate: number;
    };
    payments: {
      score: number;
      maxScore: number;
      expectedMonths: number;
      paidOnTime: number;
      paidLate: number;
      partial: number;
      overdue: number;
      unpaid: number;
    };
  };
}

function gradeFromScore(score: number): { grade: string; gradeColor: string } {
  if (score >= 90) return { grade: 'Excellent', gradeColor: '#10b981' };
  if (score >= 75) return { grade: 'Good', gradeColor: '#3b82f6' };
  if (score >= 60) return { grade: 'Average', gradeColor: '#f59e0b' };
  if (score >= 45) return { grade: 'Fair', gradeColor: '#f97316' };
  return { grade: 'Needs Improvement', gradeColor: '#ef4444' };
}

function countExpectedMonths(dateJoined: Date): number {
  const now = new Date();
  let y = dateJoined.getFullYear();
  let m = dateJoined.getMonth() + 1;
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;
  let count = 0;
  while (y < endY || (y === endY && m <= endM)) {
    count++;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return count;
}

function computeScore(
  member: any,
  events: any[],
  attendances: any[],
  payments: any[]
): MemberScore {
  const joinDate = new Date(member.dateJoined);

  // ── Attendance ───────────────────────────────────────────────
  const relevantEvents = events.filter((e) => new Date(e.startTime) >= joinDate);
  const totalEvents = relevantEvents.length;
  const attended = attendances.length;
  const onTime = attendances.filter((a) => !a.isLate).length;
  const late = attended - onTime;

  const attendanceRate = totalEvents > 0 ? attended / totalEvents : 0;
  const punctualityRate = attended > 0 ? onTime / attended : 0;
  const attendanceScore = Math.round(attendanceRate * 30 + punctualityRate * 10);

  // ── Payments ─────────────────────────────────────────────────
  const expectedMonths = countExpectedMonths(joinDate);

  let totalCredit = 0;
  let paidOnTime = 0;
  let paidLate = 0;
  let partial = 0;
  let overdue = 0;

  payments.forEach((p) => {
    if (p.status === 'PAID' || p.status === 'WAIVED') {
      const isOnTime = p.dueDate && p.paidAt && new Date(p.paidAt) <= new Date(p.dueDate);
      if (isOnTime) { paidOnTime++; totalCredit += 1.0; }
      else { paidLate++; totalCredit += 0.6; }
    } else if (p.status === 'PARTIAL') {
      partial++;
      totalCredit += (Number(p.paidAmount) / Math.max(Number(p.amount), 1)) * 0.5;
    } else if (p.status === 'OVERDUE') {
      overdue++;
    }
    // PENDING = 0 credit
  });

  const unpaid = Math.max(0, expectedMonths - payments.length);
  const paymentScore = expectedMonths > 0
    ? Math.min(60, Math.round((totalCredit / expectedMonths) * 60))
    : 60;

  const score = Math.min(100, Math.max(0, attendanceScore + paymentScore));
  const { grade, gradeColor } = gradeFromScore(score);

  return {
    memberId: member.id,
    fullName: member.fullName,
    membershipId: member.membershipId,
    profilePhoto: member.profilePhoto || null,
    status: member.status,
    score,
    grade,
    gradeColor,
    breakdown: {
      attendance: {
        score: attendanceScore,
        maxScore: 40,
        totalEvents,
        attended,
        onTime,
        late,
        attendanceRate: Math.round(attendanceRate * 100),
        punctualityRate: Math.round(punctualityRate * 100),
      },
      payments: {
        score: paymentScore,
        maxScore: 60,
        expectedMonths,
        paidOnTime,
        paidLate,
        partial,
        overdue,
        unpaid,
      },
    },
  };
}

export class PerformanceService {
  async getAll(): Promise<MemberScore[]> {
    const [membersRes, eventsRes, attendancesRes, paymentsRes] = await Promise.all([
      pool.query(
        `SELECT id, "fullName", "membershipId", "dateJoined", status, "profilePhoto"
         FROM members WHERE status = 'ACTIVE' ORDER BY "fullName" ASC`
      ),
      pool.query(`SELECT id, "startTime" FROM events WHERE "startTime" <= NOW()`),
      pool.query(`SELECT "memberId", "eventId", "isLate" FROM attendances`),
      pool.query(
        `SELECT "memberId", status, amount, "paidAmount", "dueDate", "paidAt"
         FROM payments WHERE type = 'MONTHLY_MEETING'`
      ),
    ]);

    // Build lookup maps
    const attendanceMap = new Map<string, any[]>();
    attendancesRes.rows.forEach((a) => {
      if (!attendanceMap.has(a.memberId)) attendanceMap.set(a.memberId, []);
      attendanceMap.get(a.memberId)!.push(a);
    });

    const paymentMap = new Map<string, any[]>();
    paymentsRes.rows.forEach((p) => {
      if (!paymentMap.has(p.memberId)) paymentMap.set(p.memberId, []);
      paymentMap.get(p.memberId)!.push(p);
    });

    const events = eventsRes.rows;

    const scores = membersRes.rows.map((member) =>
      computeScore(
        member,
        events,
        attendanceMap.get(member.id) || [],
        paymentMap.get(member.id) || []
      )
    );

    return scores
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  async getById(memberId: string): Promise<MemberScore> {
    const memberRes = await pool.query(
      `SELECT id, "fullName", "membershipId", "dateJoined", status, "profilePhoto"
       FROM members WHERE id = $1`,
      [memberId]
    );
    if (!memberRes.rows[0]) throw new NotFoundError('Member not found');

    const [eventsRes, attendancesRes, paymentsRes] = await Promise.all([
      pool.query(`SELECT id, "startTime" FROM events WHERE "startTime" <= NOW()`),
      pool.query(`SELECT "memberId", "eventId", "isLate" FROM attendances WHERE "memberId" = $1`, [memberId]),
      pool.query(
        `SELECT status, amount, "paidAmount", "dueDate", "paidAt"
         FROM payments WHERE "memberId" = $1 AND type = 'MONTHLY_MEETING'`,
        [memberId]
      ),
    ]);

    return computeScore(memberRes.rows[0], eventsRes.rows, attendancesRes.rows, paymentsRes.rows);
  }
}
