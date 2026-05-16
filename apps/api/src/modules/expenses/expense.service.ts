import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { getPagination, paginatedResponse } from '../../utils/pagination';

export class ExpenseService {
  async getAll(query: {
    page?: number;
    limit?: number;
    bankAccountId?: string;
    category?: string;
    year?: number;
    month?: number;
  }) {
    const { skip, take, page, limit } = getPagination(query);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (query.bankAccountId) {
      conditions.push(`e."bankAccountId" = $${i++}`);
      params.push(query.bankAccountId);
    }
    if (query.category) {
      conditions.push(`e.category = $${i++}`);
      params.push(query.category);
    }
    if (query.year) {
      conditions.push(`e.year = $${i++}`);
      params.push(Number(query.year));
    }
    if (query.month) {
      conditions.push(`e.month = $${i++}`);
      params.push(Number(query.month));
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT e.*, ba.name AS "bankAccountName"
         FROM expenses e
         LEFT JOIN bank_accounts ba ON ba.id = e."bankAccountId"
         WHERE ${where}
         ORDER BY e.date DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, take, skip]
      ),
      pool.query(
        `SELECT COUNT(*) FROM expenses e WHERE ${where}`,
        params
      ),
    ]);

    return paginatedResponse(
      dataResult.rows,
      parseInt(countResult.rows[0].count, 10),
      page,
      limit
    );
  }

  async create(data: {
    title: string;
    amount: number;
    category: string;
    description?: string;
    receiptUrl?: string;
    date: string;
    bankAccountId?: string;
    recordedBy: string;
  }) {
    const date = new Date(data.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const result = await pool.query(
      `INSERT INTO expenses (id, title, amount, category, description, "receiptUrl", date, "bankAccountId", "recordedBy", year, month, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [
        uuidv4(),
        data.title.trim(),
        Number(data.amount),
        data.category.trim(),
        data.description?.trim() || null,
        data.receiptUrl || null,
        date,
        data.bankAccountId || null,
        data.recordedBy,
        year,
        month,
      ]
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      amount: number;
      category: string;
      description: string;
      receiptUrl: string;
      date: string;
      bankAccountId: string;
    }>
  ) {
    const existing = await pool.query('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Expense not found');

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (data.title !== undefined) { sets.push(`title = $${i++}`); values.push(data.title.trim()); }
    if (data.amount !== undefined) { sets.push(`amount = $${i++}`); values.push(Number(data.amount)); }
    if (data.category !== undefined) { sets.push(`category = $${i++}`); values.push(data.category.trim()); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); values.push(data.description.trim() || null); }
    if (data.receiptUrl !== undefined) { sets.push(`"receiptUrl" = $${i++}`); values.push(data.receiptUrl || null); }
    if (data.bankAccountId !== undefined) { sets.push(`"bankAccountId" = $${i++}`); values.push(data.bankAccountId || null); }
    if (data.date !== undefined) {
      const d = new Date(data.date);
      sets.push(`date = $${i++}`); values.push(d);
      sets.push(`year = $${i++}`); values.push(d.getFullYear());
      sets.push(`month = $${i++}`); values.push(d.getMonth() + 1);
    }

    if (sets.length === 0) return existing.rows[0];

    values.push(id);
    const result = await pool.query(
      `UPDATE expenses SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string) {
    const existing = await pool.query('SELECT id FROM expenses WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Expense not found');
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
    return { message: 'Expense deleted' };
  }
}
