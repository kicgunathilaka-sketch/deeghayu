import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../utils/errors';

export class ExpenseGroupService {
  async getAll(query: { year?: number; month?: number; bankAccountId?: string }) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (query.bankAccountId) { conditions.push(`eg."bankAccountId" = $${i++}`); params.push(query.bankAccountId); }
    if (query.year)          { conditions.push(`eg.year = $${i++}`);             params.push(Number(query.year)); }
    if (query.month)         { conditions.push(`eg.month = $${i++}`);            params.push(Number(query.month)); }

    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT eg.*,
              ba.name AS "bankAccountName",
              COALESCE(SUM(e.amount), 0)::numeric AS "totalAmount",
              COUNT(e.id)::int AS "expenseCount"
       FROM expense_groups eg
       LEFT JOIN bank_accounts ba ON ba.id = eg."bankAccountId"
       LEFT JOIN expenses e ON e."groupId" = eg.id
       WHERE ${where}
       GROUP BY eg.id, ba.name
       ORDER BY eg.date DESC`,
      params
    );

    return result.rows.map((r) => ({ ...r, totalAmount: Number(r.totalAmount) }));
  }

  async getById(id: string) {
    const groupResult = await pool.query(
      `SELECT eg.*, ba.name AS "bankAccountName"
       FROM expense_groups eg
       LEFT JOIN bank_accounts ba ON ba.id = eg."bankAccountId"
       WHERE eg.id = $1`,
      [id]
    );
    if (!groupResult.rows[0]) throw new NotFoundError('Expense event not found');

    const expensesResult = await pool.query(
      `SELECT * FROM expenses WHERE "groupId" = $1 ORDER BY "createdAt" ASC`,
      [id]
    );

    const group = groupResult.rows[0];
    const expenses = expensesResult.rows.map((e) => ({ ...e, amount: Number(e.amount) }));
    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

    return { ...group, expenses, totalAmount };
  }

  async create(data: {
    title: string;
    description?: string;
    date: string;
    bankAccountId?: string;
    recordedBy: string;
    items: Array<{
      title: string;
      amount: number;
      category: string;
      description?: string;
    }>;
  }) {
    if (!data.items || data.items.length === 0) throw new BadRequestError('At least one expense item is required');

    const date = new Date(data.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const groupId = uuidv4();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO expense_groups (id, title, description, date, "bankAccountId", "recordedBy", year, month, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [groupId, data.title.trim(), data.description?.trim() || null, date, data.bankAccountId || null, data.recordedBy, year, month]
      );

      for (const item of data.items) {
        await client.query(
          `INSERT INTO expenses (id, title, amount, category, description, date, "bankAccountId", "groupId", "recordedBy", year, month, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            uuidv4(),
            item.title.trim(),
            Number(item.amount),
            item.category.trim(),
            item.description?.trim() || null,
            date,
            data.bankAccountId || null,
            groupId,
            data.recordedBy,
            year,
            month,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getById(groupId);
  }

  async delete(id: string) {
    const existing = await pool.query('SELECT id FROM expense_groups WHERE id = $1', [id]);
    if (!existing.rows[0]) throw new NotFoundError('Expense event not found');
    // ON DELETE CASCADE removes linked expenses automatically
    await pool.query('DELETE FROM expense_groups WHERE id = $1', [id]);
    return { message: 'Expense event deleted' };
  }
}
