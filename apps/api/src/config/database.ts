import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function connectDatabase() {
  const client = await pool.connect();
  client.release();
  logger.info('Database connected');
}

export async function disconnectDatabase() {
  await pool.end();
  logger.info('Database disconnected');
}
