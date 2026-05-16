import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './config/logger';
import app from './app';
import { startScheduler } from './scheduler';

async function main() {
  await connectDatabase();

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
