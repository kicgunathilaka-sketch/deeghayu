import { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { sendMail } from '../../utils/mailer';
import { config } from '../../config';

export class NotificationService {
  async getForUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async broadcast(data: {
    title: string;
    body: string;
    type: NotificationType;
    link?: string;
    roles?: string[];
  }) {
    const where: any = {};
    if (data.roles?.length) where.role = { in: data.roles };

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, member: { select: { fullName: true } } },
    });

    // Create in-app notifications
    if (data.type === NotificationType.IN_APP || data.type === NotificationType.BOTH) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          title: data.title,
          body: data.body,
          type: data.type,
          link: data.link,
        })),
      });
    }

    // Send emails
    if (data.type === NotificationType.EMAIL || data.type === NotificationType.BOTH) {
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

    return { sent: users.length };
  }

  async create(userId: string, title: string, body: string, link?: string) {
    return prisma.notification.create({
      data: { userId, title, body, link },
    });
  }
}
