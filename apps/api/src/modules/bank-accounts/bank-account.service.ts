import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

export class BankAccountService {
  async getAll() {
    const result = await pool.query(`
      SELECT
        ba.*,
        COALESCE(SUM(p."paidAmount") FILTER (WHERE p.status IN ('PAID','PARTIAL')), 0)::numeric AS "totalIn",
        COALESCE(SUM(e.amount), 0)::numeric                                                     AS "totalOut",
        (ba."openingBalance"
          + COALESCE(SUM(p."paidAmount") FILTER (WHERE p.status IN ('PAID','PARTIAL')), 0)
          - COALESCE(SUM(e.amount), 0))::numeric                                                AS balance
      FROM bank_accounts ba
      LEFT JOIN payments p ON p."bankAccountId" = ba.id
      LEFT JOIN expenses e ON e."bankAccountId" = ba.id
      GROUP BY ba.id
      ORDER BY ba."createdAt" ASC
    `);
    return result.rows.map((r) => ({
      ...r,
      openingBalance: Number(r.openingBalance),
      totalIn: Number(r.totalIn),
      totalOut: Number(r.totalOut),
      balance: Number(r.balance),
    }));
  }

  async create(data: {
    name: string;
    accountNumber?: string;
    openingBalance?: number;
    description?: string;
    createdBy: string;
  }) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO bank_accounts (id, name, "accountNumber", "openingBalance", description, "isActive", "createdBy", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW()) RETURNING *`,
      [
        id,
        data.name.trim(),
        data.accountNumber?.trim() || null,
        Number(data.openingBalance ?? 0),
        data.description?.trim() || null,
        data.createdBy,
      ]
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      accountNumber: string;
      openingBalance: number;
      description: string;
      isActive: boolean;
    }>
  ) {
    const existing = await pool.query('SELECT id FROM bank_accounts WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Bank account not found');

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (data.name !== undefined) { sets.push(`name = $${i++}`); values.push(data.name.trim()); }
    if (data.accountNumber !== undefined) { sets.push(`"accountNumber" = $${i++}`); values.push(data.accountNumber.trim() || null); }
    if (data.openingBalance !== undefined) { sets.push(`"openingBalance" = $${i++}`); values.push(Number(data.openingBalance)); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); values.push(data.description.trim() || null); }
    if (data.isActive !== undefined) { sets.push(`"isActive" = $${i++}`); values.push(data.isActive); }

    if (sets.length === 0) return existing.rows[0];

    sets.push(`"updatedAt" = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE bank_accounts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  }
}
