import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { NotFoundError } from '../../utils/errors';

export class BankAccountService {
  async getAll() {
    const result = await pool.query(`
      SELECT
        ba.*,
        COALESCE((
          SELECT SUM(pt.amount) FROM payment_transactions pt
          WHERE pt."bankAccountId" = ba.id
        ), 0)::numeric AS "totalIn",
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          WHERE e."bankAccountId" = ba.id
        ), 0)::numeric AS "totalOut",
        (ba."openingBalance"
          + COALESCE((
              SELECT SUM(pt.amount) FROM payment_transactions pt
              WHERE pt."bankAccountId" = ba.id
            ), 0)
          - COALESCE((
              SELECT SUM(e.amount) FROM expenses e
              WHERE e."bankAccountId" = ba.id
            ), 0))::numeric AS balance
      FROM bank_accounts ba
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

  async getTransactions(accountId: string) {
    const existing = await pool.query('SELECT id FROM bank_accounts WHERE id = $1', [accountId]);
    if (!existing.rows[0]) throw new NotFoundError('Bank account not found');

    const result = await pool.query(`
      SELECT
        pt.id,
        'IN'                   AS direction,
        pt.amount::numeric     AS amount,
        pt."createdAt",
        m."fullName"           AS description,
        p.type                 AS "subType",
        p."customType",
        NULL::text             AS category
      FROM payment_transactions pt
      JOIN payments p ON p.id = pt."paymentId"
      JOIN members m ON m.id = pt."memberId"
      WHERE pt."bankAccountId" = $1

      UNION ALL

      SELECT
        e.id,
        'OUT'              AS direction,
        e.amount::numeric  AS amount,
        e."createdAt",
        e.title            AS description,
        NULL::text         AS "subType",
        NULL::text         AS "customType",
        e.category
      FROM expenses e
      WHERE e."bankAccountId" = $1

      ORDER BY "createdAt" DESC
    `, [accountId]);

    return result.rows.map((r) => ({ ...r, amount: Number(r.amount) }));
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
