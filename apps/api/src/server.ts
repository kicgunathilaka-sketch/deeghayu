import { config } from './config';
import { connectDatabase, disconnectDatabase, pool } from './config/database';
import { logger } from './config/logger';
import app from './app';
import { startScheduler } from './scheduler';

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId"   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_push_subs_userId ON push_subscriptions("userId");
  `);
  logger.info('Migrations applied');
}

async function main() {
  await connectDatabase();
  await migrate();

  const schedulerInterval = startScheduler();

  const server = app.listen(config.port, () => {
    logger.info(`🚀 ${config.appName} API running on port ${config.port} [${config.nodeEnv}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    clearInterval(schedulerInterval);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection', { err });
    process.exit(1);
  });
}

main();
