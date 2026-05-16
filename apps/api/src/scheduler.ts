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

export function startScheduler() {
  // Run immediately on startup, then every 60 seconds
  completeExpiredEvents();
  const interval = setInterval(completeExpiredEvents, 60_000);
  logger.info('Scheduler started — checking expired events every 60s');
  return interval;
}
