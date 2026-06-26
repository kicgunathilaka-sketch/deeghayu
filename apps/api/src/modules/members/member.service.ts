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

    // Sync overdue: PENDING → OVERDUE when past-due by dueDate OR when the payment month has already passed
    await pool.query(`
      UPDATE payments SET status = 'OVERDUE', "updatedAt" = NOW()
      WHERE "memberId" = $1 AND status = 'PENDING'
        AND (
          ("dueDate" IS NOT NULL AND "dueDate" < NOW())
          OR (
            type = 'MONTHLY_MEETING'
            AND (
              year < EXTRACT(YEAR FROM NOW())
              OR (year = EXTRACT(YEAR FROM NOW()) AND month < EXTRACT(MONTH FROM NOW()))
            )
          )
        )
    `, [memberId]);

    const [settingResult, joiningFeeSettingResult, paymentsResult, joiningFeeResult] = await Promise.all([
      pool.query("SELECT value FROM system_settings WHERE key = 'monthly_fee'"),
      pool.query("SELECT value FROM system_settings WHERE key = 'joining_fee'"),
      pool.query(
        `SELECT id, month, year, status, amount, "paidAmount", "dueDate" FROM payments
         WHERE "memberId" = $1 AND type = 'MONTHLY_MEETING'`,
        [memberId]
      ),
      pool.query(
        `SELECT id, status, amount, "paidAmount", "dueDate" FROM payments
         WHERE "memberId" = $1 AND type = 'JOINING_FEE'
         ORDER BY "createdAt" DESC LIMIT 1`,
        [memberId]
      ),
    ]);

    const monthlyFee = settingResult.rows[0] ? Number(settingResult.rows[0].value) : 0;
    const joiningFeeAmount = joiningFeeSettingResult.rows[0] ? Number(joiningFeeSettingResult.rows[0].value) : 0;

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const arrears: Array<{
      year: number; month: number; monthName: string;
      amount: number; paidAmount: number; balance: number; status: string;
      paymentId: string | null; dueDate: string | null; isJoiningFee?: boolean;
      transactions: Array<{ id: string; amount: number; createdAt: string; bankName: string | null }>;
    }> = [];

    // Step 1: Add every non-PAID payment record regardless of month range
    const coveredKeys = new Set<string>();
    for (const p of paymentsResult.rows) {
      const key = `${p.year}-${Number(p.month)}`;
      coveredKeys.add(key);
      if (p.status === 'PARTIAL') {
        const balance = Number(p.amount) - Number(p.paidAmount);
        if (balance > 0) {
          arrears.push({ year: Number(p.year), month: Number(p.month), monthName: MONTH_NAMES[Number(p.month) - 1], amount: Number(p.amount), paidAmount: Number(p.paidAmount), balance, status: 'PARTIAL', paymentId: p.id, dueDate: p.dueDate, transactions: [] });
        }
      } else if (p.status === 'PENDING' || p.status === 'OVERDUE') {
        arrears.push({ year: Number(p.year), month: Number(p.month), monthName: MONTH_NAMES[Number(p.month) - 1], amount: Number(p.amount), paidAmount: Number(p.paidAmount), balance: Number(p.amount) - Number(p.paidAmount), status: p.status, paymentId: p.id, dueDate: p.dueDate, transactions: [] });
      }
    }

    // Step 2: Fill UNPAID gaps for months within the membership period that have no record at all
    if (monthlyFee > 0) {
      const now = new Date();
      const joinDate = new Date(member.dateJoined);
      let y = joinDate.getFullYear();
      let m = joinDate.getMonth() + 1;
      const endYear = now.getFullYear();
      const endMonth = now.getMonth() + 1;
      while (y < endYear || (y === endYear && m <= endMonth)) {
        if (!coveredKeys.has(`${y}-${m}`)) {
          arrears.push({ year: y, month: m, monthName: MONTH_NAMES[m - 1], amount: monthlyFee, paidAmount: 0, balance: monthlyFee, status: 'UNPAID', paymentId: null, dueDate: null, transactions: [] });
        }
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    // Sort chronologically
    arrears.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    // Prepend joining fee arrear if configured and not fully paid
    if (joiningFeeAmount > 0) {
      const jf = joiningFeeResult.rows[0];
      if (!jf) {
        arrears.unshift({ year: 0, month: 0, monthName: 'Joining Fee', amount: joiningFeeAmount, paidAmount: 0, balance: joiningFeeAmount, status: 'UNPAID', paymentId: null, dueDate: null, isJoiningFee: true, transactions: [] });
      } else if (jf.status !== 'PAID') {
        const balance = Number(jf.amount) - Number(jf.paidAmount);
        if (balance > 0) {
          arrears.unshift({ year: 0, month: 0, monthName: 'Joining Fee', amount: Number(jf.amount), paidAmount: Number(jf.paidAmount), balance, status: jf.status, paymentId: jf.id, dueDate: jf.dueDate, isJoiningFee: true, transactions: [] });
        }
      }
    }

    // Attach individual payment transactions to each arrear row
    const paymentIds = arrears.map((a) => a.paymentId).filter(Boolean) as string[];
    if (paymentIds.length > 0) {
      const txResult = await pool.query(
        `SELECT pt.id, pt."paymentId", pt.amount, pt."createdAt", ba.name AS "bankName"
         FROM payment_transactions pt
         LEFT JOIN bank_accounts ba ON ba.id = pt."bankAccountId"
         WHERE pt."paymentId" = ANY($1::text[])
         ORDER BY pt."createdAt" ASC`,
        [paymentIds]
      );
      const txMap = new Map<string, any[]>();
      txResult.rows.forEach((tx) => {
        if (!txMap.has(tx.paymentId)) txMap.set(tx.paymentId, []);
        txMap.get(tx.paymentId)!.push({ id: tx.id, amount: Number(tx.amount), createdAt: tx.createdAt, bankName: tx.bankName });
      });
      arrears.forEach((a) => {
        if (a.paymentId) a.transactions = txMap.get(a.paymentId) || [];
      });
    }

    return { arrears, totalArrears: arrears.reduce((s, a) => s + a.balance, 0), monthlyFee, joiningFeeAmount };
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
