import { pool } from '../config/database';
import { config } from '../config';

export async function generateMembershipId(): Promise<string> {
  const res = await pool.query('SELECT COUNT(*) FROM members');
  const count = parseInt(res.rows[0].count, 10);
  const nextNum = count + 1;
  return `${config.membershipPrefix}-${String(nextNum).padStart(4, '0')}`;
}
