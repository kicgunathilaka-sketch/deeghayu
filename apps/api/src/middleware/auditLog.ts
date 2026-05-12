import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { logger } from '../config/logger';

export function auditLog(action: string, entity: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user) {
      pool
        .query(
          `INSERT INTO audit_logs (id, "userId", action, entity, "entityId", metadata, "ipAddress", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            uuidv4(),
            req.user.id,
            action,
            entity,
            req.params.id || null,
            JSON.stringify({ body: req.body, query: req.query }),
            req.ip || null,
          ]
        )
        .catch((err) => logger.error('Audit log failed', { err }));
    }
    next();
  };
}
