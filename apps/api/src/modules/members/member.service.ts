import { pool } from '../../config/database';
import { MemberStatus, Role } from '../../types';
import { NotFoundError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';
import { generateMemberQr } from '../../utils/qrCode';
import { generateExcel } from '../../utils/excelGenerator';
import { generateReportPdf } from '../../utils/pdfGenerator';

export class MemberService {
  async getAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: MemberStatus;
    role?: Role;
  }) {
    const { skip, take, page, limit } = getPagination(query);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (query.search) {
      conditions.push(
        `(m."fullName" ILIKE $${i} OR m."membershipId" ILIKE $${i} OR m.nic ILIKE $${i} OR m.phone ILIKE $${i} OR u.email ILIKE $${i})`
      );
      params.push(`%${query.search}%`);
      i++;
    }
    if (query.status) {
      conditions.push(`m.status = $${i}`);
      params.push(query.status);
      i++;
    }
    if (query.role) {
      conditions.push(`u.role = $${i}`);
      params.push(query.role);
      i++;
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT m.*,
                u.email, u.role,
                (SELECT COUNT(*) FROM payments WHERE "memberId" = m.id)::int AS "paymentCount",
                (SELECT COUNT(*) FROM attendances WHERE "memberId" = m.id)::int AS "attendanceCount"
         FROM members m
         JOIN users u ON u.id = m."userId"
         WHERE ${where}
         ORDER BY m."createdAt" DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, take, skip]
      ),
      pool.query(
        `SELECT COUNT(*) FROM members m JOIN users u ON u.id = m."userId" WHERE ${where}`,
        params
      ),
    ]);

    const members = dataResult.rows.map(({ email, role, paymentCount, attendanceCount, ...m }) => ({
      ...m,
      user: { email, role },
      _count: { payments: paymentCount, attendances: attendanceCount },
    }));

    return paginatedResponse(members, parseInt(countResult.rows[0].count, 10), page, limit);
  }

  async getById(id: string) {
    const [memberResult, paymentsResult, attendancesResult, rolesResult] = await Promise.all([
      pool.query(
        `SELECT m.*, u.email, u.role, u."lastLoginAt", u."isEmailVerified"
         FROM members m
         JOIN users u ON u.id = m."userId"
         WHERE m.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM payments WHERE "memberId" = $1 ORDER BY "createdAt" DESC LIMIT 10`,
        [id]
      ),
      pool.query(
        `SELECT a.*, e.title AS "eventTitle", e."startTime" AS "eventStartTime", e.category AS "eventCategory"
         FROM attendances a
         JOIN events e ON e.id = a."eventId"
         WHERE a."memberId" = $1
         ORDER BY a."checkedInAt" DESC
         LIMIT 10`,
        [id]
      ),
      pool.query(
        `SELECT cr.*, cp.year AS "panelYear"
         FROM committee_roles cr
         JOIN committee_panels cp ON cp.id = cr."panelId"
         WHERE cr."memberId" = $1`,
        [id]
      ),
    ]);

    if (!memberResult.rows[0]) throw new NotFoundError('Member not found');

    const { email, role, lastLoginAt, isEmailVerified, ...member } = memberResult.rows[0];

    return {
      ...member,
      user: { email, role, lastLoginAt, isEmailVerified },
      payments: paymentsResult.rows,
      attendances: attendancesResult.rows.map(
        ({ eventTitle, eventStartTime, eventCategory, ...a }) => ({
          ...a,
          event: { title: eventTitle, startTime: eventStartTime, category: eventCategory },
        })
      ),
      committeeRoles: rolesResult.rows.map(({ panelYear, ...r }) => ({
        ...r,
        panel: { year: panelYear },
      })),
    };
  }

  async updateStatus(id: string, status: MemberStatus, _adminId?: string) {
    const existing = await pool.query('SELECT id FROM members WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Member not found');

    const result = await pool.query(
      `UPDATE members SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      fullName: string;
      phone: string;
      address: string;
      occupation: string;
      dateOfBirth: string;
      emergencyContact: any;
      familyDetails: any;
      notes: string;
      profilePhoto: string;
      signatureUrl: string;
    }>
  ) {
    const existing = await pool.query('SELECT id FROM members WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Member not found');

    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    const mappings: Record<string, string> = {
      fullName: '"fullName"',
      phone: 'phone',
      address: 'address',
      occupation: 'occupation',
      notes: 'notes',
      profilePhoto: '"profilePhoto"',
      signatureUrl: '"signatureUrl"',
      emergencyContact: '"emergencyContact"',
      familyDetails: '"familyDetails"',
    };

    for (const [key, col] of Object.entries(mappings)) {
      if (data[key as keyof typeof data] !== undefined) {
        const val = data[key as keyof typeof data];
        fields.push(`${col} = $${i}`);
        params.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
        i++;
      }
    }

    if (data.dateOfBirth !== undefined) {
      fields.push(`"dateOfBirth" = $${i}`);
      params.push(data.dateOfBirth ? new Date(data.dateOfBirth) : null);
      i++;
    }

    if (fields.length === 0) return existing.rows[0];

    fields.push(`"updatedAt" = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE members SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async getQr(id: string) {
    const result = await pool.query(
      'SELECT id, "membershipId", "qrCodeUrl" FROM members WHERE id = $1',
      [id]
    );
    const member = result.rows[0];
    if (!member) throw new NotFoundError('Member not found');

    if (!member.qrCodeUrl) {
      const qrCodeUrl = await generateMemberQr(id, member.membershipId);
      await pool.query('UPDATE members SET "qrCodeUrl" = $1, "updatedAt" = NOW() WHERE id = $2', [
        qrCodeUrl,
        id,
      ]);
      return { qrCodeUrl };
    }
    return { qrCodeUrl: member.qrCodeUrl };
  }

  async getPayments(memberId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPagination(query);
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM payments WHERE "memberId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
        [memberId, take, skip]
      ),
      pool.query(`SELECT COUNT(*) FROM payments WHERE "memberId" = $1`, [memberId]),
    ]);
    return paginatedResponse(
      dataResult.rows,
      parseInt(countResult.rows[0].count, 10),
      page,
      limit
    );
  }

  async getAttendance(memberId: string, query: { page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPagination(query);
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT a.*, e.title AS "eventTitle", e."startTime" AS "eventStartTime", e.category AS "eventCategory"
         FROM attendances a
         JOIN events e ON e.id = a."eventId"
         WHERE a."memberId" = $1
         ORDER BY a."checkedInAt" DESC
         LIMIT $2 OFFSET $3`,
        [memberId, take, skip]
      ),
      pool.query(`SELECT COUNT(*) FROM attendances WHERE "memberId" = $1`, [memberId]),
    ]);
    const records = dataResult.rows.map(({ eventTitle, eventStartTime, eventCategory, ...a }) => ({
      ...a,
      event: { title: eventTitle, startTime: eventStartTime, category: eventCategory },
    }));
    return paginatedResponse(records, parseInt(countResult.rows[0].count, 10), page, limit);
  }

  async getArrears(memberId: string) {
    const memberResult = await pool.query(
      'SELECT id, "dateJoined", status FROM members WHERE id = $1',
      [memberId]
    );
    if (!memberResult.rows[0]) throw new NotFoundError('Member not found');
    const member = memberResult.rows[0];

    if (member.status === 'PENDING' || member.status === 'DECEASED') {
      return { arrears: [], totalArrears: 0, monthlyFee: 0 };
    }

    const [settingResult, paymentsResult] = await Promise.all([
      pool.query("SELECT value FROM system_settings WHERE key = 'monthly_fee'"),
      pool.query(
        `SELECT month, year, status, amount, "paidAmount" FROM payments
         WHERE "memberId" = $1 AND type = 'MONTHLY_MEETING'`,
        [memberId]
      ),
    ]);

    const monthlyFee = settingResult.rows[0] ? Number(settingResult.rows[0].value) : 0;

    const paymentMap = new Map<string, any>();
    paymentsResult.rows.forEach((p) => {
      paymentMap.set(`${p.year}-${p.month}`, p);
    });

    const joinDate = new Date(member.dateJoined);
    let y = joinDate.getFullYear();
    let m = joinDate.getMonth() + 1;

    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const arrears: Array<{
      year: number; month: number; monthName: string;
      amount: number; paidAmount: number; balance: number; status: string;
    }> = [];

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const payment = paymentMap.get(`${y}-${m}`);

      if (!payment) {
        if (monthlyFee > 0) {
          arrears.push({ year: y, month: m, monthName: MONTH_NAMES[m - 1], amount: monthlyFee, paidAmount: 0, balance: monthlyFee, status: 'UNPAID' });
        }
      } else if (payment.status === 'PARTIAL') {
        const balance = Number(payment.amount) - Number(payment.paidAmount);
        if (balance > 0) {
          arrears.push({ year: y, month: m, monthName: MONTH_NAMES[m - 1], amount: Number(payment.amount), paidAmount: Number(payment.paidAmount), balance, status: 'PARTIAL' });
        }
      } else if (payment.status === 'PENDING' || payment.status === 'OVERDUE') {
        arrears.push({ year: y, month: m, monthName: MONTH_NAMES[m - 1], amount: Number(payment.amount), paidAmount: Number(payment.paidAmount), balance: Number(payment.amount) - Number(payment.paidAmount), status: payment.status });
      }

      m++;
      if (m > 12) { m = 1; y++; }
    }

    return { arrears, totalArrears: arrears.reduce((s, a) => s + a.balance, 0), monthlyFee };
  }

  async exportMembers(fmt: 'pdf' | 'excel' | 'csv', filters: any) {
    const result = await pool.query(
      `SELECT m.*, u.email, u.role
       FROM members m
       JOIN users u ON u.id = m."userId"
       ${filters.status ? 'WHERE m.status = $1' : ''}
       ORDER BY m."membershipId" ASC`,
      filters.status ? [filters.status] : []
    );
    const members = result.rows;

    if (fmt === 'excel') {
      return generateExcel(
        'Members Report',
        [
          { key: 'membershipId', header: 'Member ID', width: 15 },
          { key: 'fullName', header: 'Full Name', width: 25 },
          { key: 'email', header: 'Email', width: 30 },
          { key: 'phone', header: 'Phone', width: 15 },
          { key: 'nic', header: 'NIC', width: 15 },
          { key: 'status', header: 'Status', width: 12 },
          { key: 'role', header: 'Role', width: 18 },
          { key: 'dateJoined', header: 'Date Joined', width: 15 },
        ],
        members.map((m) => ({
          membershipId: m.membershipId,
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          nic: m.nic,
          status: m.status,
          role: m.role,
          dateJoined: new Date(m.dateJoined).toLocaleDateString(),
        }))
      );
    }

    if (fmt === 'pdf') {
      return generateReportPdf({
        title: 'Members Report',
        headers: ['Member ID', 'Name', 'Email', 'Phone', 'Status', 'Date Joined'],
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

    const headers = 'Member ID,Full Name,Email,Phone,NIC,Status,Role,Date Joined\n';
    const rows = members
      .map(
        (m) =>
          `${m.membershipId},"${m.fullName}",${m.email},${m.phone},${m.nic},${m.status},${m.role},${new Date(m.dateJoined).toLocaleDateString()}`
      )
      .join('\n');
    return Buffer.from(headers + rows, 'utf-8');
  }
}
