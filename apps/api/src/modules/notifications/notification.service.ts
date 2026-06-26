import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { NotificationType } from '../../types';
import { sendMail } from '../../utils/mailer';
import { config } from '../../config';
import { sendPushToUser, sendPushToAll } from '../../utils/pushNotification';

export class NotificationService {
  async getForUser(userId: string) {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [userId]
    );
    return result.rows;
  }

  async markRead(id: string, userId: string) {
    await pool.query(
      `UPDATE notifications SET "isRead" = true WHERE id = $1 AND "userId" = $2`,
      [id, userId]
    );
  }

  async markAllRead(userId: string) {
    await pool.query(
      `UPDATE notifications SET "isRead" = true WHERE "userId" = $1 AND "isRead" = false`,
      [userId]
    );
  }

  async broadcast(data: {
    title: string;
    body: string;
    type: NotificationType;
    link?: string;
    roles?: string[];
  }) {
    let usersQuery = `SELECT u.id, u.email, m."fullName" FROM users u LEFT JOIN members m ON m."userId" = u.id`;
    const params: any[] = [];

    if (data.roles?.length) {
      usersQuery += ` WHERE u.role = ANY($1)`;
      params.push(data.roles);
    }

    const usersResult = await pool.query(usersQuery, params);
    const users = usersResult.rows;

    if (data.type === 'IN_APP' || data.type === 'BOTH') {
      await Promise.all(
        users.map((u) =>
          pool.query(
            `INSERT INTO notifications (id, "userId", title, body, type, link, "isRead", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
            [uuidv4(), u.id, data.title, data.body, data.type, data.link || null]
          )
        )
      );
    }

    if (data.type === 'EMAIL' || data.type === 'BOTH') {
      await Promise.allSettled(
        users.map((u) =>
          sendMail({
            to: u.email,
            subject: `${config.appName}: ${data.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2>${data.title}</h2>
              <p>${data.body}</p>
              ${data.link ? `<a href="${data.link}" style="display:inline-block;background:#0284c7;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">View More</a>` : ''}
            </div>`,
          })
        )
      );
    }

    // Push notification to all matched users
    sendPushToAll(
      { title: data.title, body: data.body, url: data.link },
      users.map((u) => u.id)
    ).catch(() => {});

    return { sent: users.length };
  }

  async create(userId: string, title: string, body: string, link?: string) {
    const result = await pool.query(
      `INSERT INTO notifications (id, "userId", title, body, type, link, "isRead", "createdAt")
       VALUES ($1, $2, $3, $4, 'IN_APP', $5, false, NOW()) RETURNING *`,
      [uuidv4(), userId, title, body, link || null]
    );
    // Also send as push notification
    sendPushToUser(userId, { title, body, url: link }).catch(() => {});
    return result.rows[0];
  }
}
