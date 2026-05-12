import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { ZodError } from 'zod';
import { config } from '../config';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // PostgreSQL unique violation
  if ((err as any).code === '23505') {
    return res.status(409).json({ success: false, message: 'A record with that value already exists' });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  return res.status(500).json({
    success: false,
    message: config.isProduction ? 'Internal server error' : err.message,
    ...(config.isDevelopment && { stack: err.stack }),
  });
}
