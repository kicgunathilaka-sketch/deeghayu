import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { Role } from '../../types';
import { NotFoundError, ConflictError } from '../../utils/errors';

export class CommitteeService {
  async getAllPanels() {
    const panelsResult = await pool.query(
      `SELECT cp.*, json_agg(
         json_build_object(
           'id', cr.id,
           'role', cr.role,
           'startDate', cr."startDate",
           'endDate', cr."endDate",
           'notes', cr.notes,
           'memberId', cr."memberId",
           'member', json_build_object(
             'fullName', m."fullName",
             'membershipId', m."membershipId",
             'profilePhoto', m."profilePhoto"
           )
         ) ORDER BY cr.role
       ) FILTER (WHERE cr.id IS NOT NULL) AS roles
       FROM committee_panels cp
       LEFT JOIN committee_roles cr ON cr."panelId" = cp.id
       LEFT JOIN members m ON m.id = cr."memberId"
       GROUP BY cp.id
       ORDER BY cp.year DESC`
    );
    return panelsResult.rows.map((p) => ({ ...p, roles: p.roles || [] }));
  }

  async getPanelByYear(year: number) {
    const result = await pool.query(
      `SELECT cp.*, json_agg(
         json_build_object(
           'id', cr.id,
           'role', cr.role,
           'startDate', cr."startDate",
           'endDate', cr."endDate",
           'notes', cr.notes,
           'memberId', cr."memberId",
           'member', json_build_object(
             'fullName', m."fullName",
             'membershipId', m."membershipId",
             'profilePhoto', m."profilePhoto",
             'phone', m.phone
           )
         ) ORDER BY cr.role
       ) FILTER (WHERE cr.id IS NOT NULL) AS roles
       FROM committee_panels cp
       LEFT JOIN committee_roles cr ON cr."panelId" = cp.id
       LEFT JOIN members m ON m.id = cr."memberId"
       WHERE cp.year = $1
       GROUP BY cp.id`,
      [year]
    );
    if (!result.rows[0]) throw new NotFoundError(`No panel found for year ${year}`);
    return { ...result.rows[0], roles: result.rows[0].roles || [] };
  }

  async createPanel(year: number, notes?: string) {
    const existing = await pool.query('SELECT id FROM committee_panels WHERE year = $1', [year]);
    if (existing.rows[0]) throw new ConflictError(`Panel for year ${year} already exists`);

    await pool.query('UPDATE committee_panels SET "isActive" = false');

    const result = await pool.query(
      `INSERT INTO committee_panels (id, year, "isActive", notes, "createdAt")
       VALUES ($1, $2, true, $3, NOW()) RETURNING *`,
      [uuidv4(), year, notes || null]
    );
    return result.rows[0];
  }

  async assignRole(
    panelId: string,
    memberId: string,
    role: Role,
    startDate: string,
    notes?: string
  ) {
    const panelCheck = await pool.query('SELECT id FROM committee_panels WHERE id = $1', [panelId]);
    if (!panelCheck.rows[0]) throw new NotFoundError('Panel not found');

    const memberResult = await pool.query(
      'SELECT id, "userId" FROM members WHERE id = $1',
      [memberId]
    );
    if (!memberResult.rows[0]) throw new NotFoundError('Member not found');

    await pool.query(
      'UPDATE users SET role = $1, "updatedAt" = NOW() WHERE id = $2',
      [role, memberResult.rows[0].userId]
    );

    const result = await pool.query(
      `INSERT INTO committee_roles (id, "panelId", "memberId", role, "startDate", notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("panelId", "memberId", role)
       DO UPDATE SET "startDate" = EXCLUDED."startDate", notes = EXCLUDED.notes
       RETURNING *`,
      [uuidv4(), panelId, memberId, role, new Date(startDate), notes || null]
    );
    return result.rows[0];
  }

  async updateRole(roleId: string, data: { endDate?: string; notes?: string }) {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (data.endDate !== undefined) {
      fields.push(`"endDate" = $${i}`);
      params.push(data.endDate ? new Date(data.endDate) : null);
      i++;
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${i}`);
      params.push(data.notes);
      i++;
    }

    if (fields.length === 0) {
      const existing = await pool.query('SELECT * FROM committee_roles WHERE id = $1', [roleId]);
      return existing.rows[0];
    }

    params.push(roleId);
    const result = await pool.query(
      `UPDATE committee_roles SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async getMemberHistory(memberId: string) {
    const result = await pool.query(
      `SELECT cr.*, cp.year AS "panelYear"
       FROM committee_roles cr
       JOIN committee_panels cp ON cp.id = cr."panelId"
       WHERE cr."memberId" = $1
       ORDER BY cr."startDate" DESC`,
      [memberId]
    );
    return result.rows.map(({ panelYear, ...r }) => ({
      ...r,
      panel: { year: panelYear },
    }));
  }
}
