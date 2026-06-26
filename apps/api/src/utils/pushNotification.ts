import webpush from 'web-push';
import { pool } from '../config/database';
import { config } from '../config';
import { logger } from '../config/logger';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  if (!config.vapid.publicKey || !config.vapid.privateKey) return;
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  vapidConfigured = true;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  ensureVapid();
  if (!vapidConfigured) return;

  const result = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE "userId" = $1`,
    [userId]
  );

  await Promise.allSettled(
    result.rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [row.endpoint]);
        } else {
          logger.warn(`Push failed for ${row.endpoint}: ${err.message}`);
        }
      }
    })
  );
}

export async function sendPushToAll(
  payload: { title: string; body: string; url?: string },
  userIds?: string[]
): Promise<void> {
  ensureVapid();
  if (!vapidConfigured) return;

  const query = userIds?.length
    ? `SELECT "userId", endpoint, p256dh, auth FROM push_subscriptions WHERE "userId" = ANY($1)`
    : `SELECT "userId", endpoint, p256dh, auth FROM push_subscriptions`;

  const result = await pool.query(query, userIds?.length ? [userIds] : []);

  await Promise.allSettled(
    result.rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [row.endpoint]);
        }
      }
    })
  );
}
