import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../config/database';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('No token provided');

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { member: { select: { id: true } } },
  });
  if (!user) throw new UnauthorizedError('User not found');

  req.user = {
    id: user.id,
    role: user.role,
    memberId: user.member?.id,
  };
  next();
}
