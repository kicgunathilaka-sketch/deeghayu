import { Role } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

const roleHierarchy: Record<Role, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  PRESIDENT: 80,
  VICE_PRESIDENT: 70,
  SECRETARY: 60,
  TREASURER: 55,
  COMMITTEE_MEMBER: 40,
  MEMBER: 10,
};

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) throw new ForbiddenError('Insufficient permissions');
    next();
  };
}

export function authorizeMinRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();
    if (roleHierarchy[req.user.role] < roleHierarchy[minRole]) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
