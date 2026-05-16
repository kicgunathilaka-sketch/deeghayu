import { pool } from './config/database';
import { logger } from './config/logger';

async function completeExpiredEvents() {
  try {
    const result = await pool.query(
      `UPDATE events
       SET status = 'COMPLETED', "updatedAt" = NOW()
       WHERE status IN ('PUBLISHED', 'ONGOING')
         AND "endTime" < NOW()
       RETURNING id, title`
    );
    if (result.rows.length > 0) {
      result.rows.forEach((e) =>
        logger.info(`Event auto-completed: ${e.title} (${e.id})`)
      );
    }
  } catch (err) {
    logger.error('Scheduler error in completeExpiredEvents', { err });
  }
}

async function markOverduePayments() {
  try {
    const result = await pool.query(
      `UPDATE payments
       SET status = 'OVERDUE', "updatedAt" = NOW()
       WHERE status IN ('PENDING', 'PARTIAL')
         AND "dueDate" IS NOT NULL
         AND "dueDate" < NOW()
       RETURNING id`
    );
    if (result.rows.length > 0) {
      logger.info(`Marked ${result.rows.length} payment(s) as OVERDUE`);
    }
  } catch (err) {
    logger.error('Scheduler error in markOverduePayments', { err });
  }
}

export function startScheduler() {
  // Run immediately on startup, then every 60 seconds
  completeExpiredEvents();
  markOverduePayments();
  const interval = setInterval(() => {
    completeExpiredEvents();
    markOverduePayments();
  }, 60_000);
  logger.info('Scheduler started — checking expired events and overdue payments every 60s');
  return interval;
}
