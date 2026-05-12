import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export function auditLog(action: string, entity: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      prisma.auditLog
        .create({
          data: {
            userId: req.user.id,
            action,
            entity,
            entityId: req.params.id,
            metadata: { body: req.body, query: req.query },
            ipAddress: req.ip,
          },
        })
        .catch((err) => logger.error('Audit log failed', { err }));
    }
    next();
  };
}
