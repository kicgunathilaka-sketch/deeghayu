import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { pool } from '../config/database';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('No token provided');

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  const result = await pool.query(
    `SELECT u.id, u.role, m.id AS "memberId"
     FROM users u
     LEFT JOIN members m ON m."userId" = u.id
     WHERE u.id = $1`,
    [payload.id]
  );

  if (!result.rows[0]) throw new UnauthorizedError('User not found');

  const user = result.rows[0];
  req.user = {
    id: user.id,
    role: user.role,
    memberId: user.memberId ?? undefined,
  };
  next();
}
