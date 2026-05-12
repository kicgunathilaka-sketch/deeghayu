import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../config/logger';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  try {
    await transporter.sendMail({ from: config.smtp.from, ...options });
    logger.info(`Email sent to ${options.to}: ${options.subject}`);
  } catch (err) {
    logger.error('Email send failed', { err });
  }
}

export function emailVerificationTemplate(name: string, link: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc">
    <div style="background:#0284c7;padding:20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:white;margin:0">${config.appName}</h1>
    </div>
    <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
      <h2>Welcome, ${name}!</h2>
      <p>Please verify your email address to activate your account.</p>
      <a href="${link}" style="display:inline-block;background:#0284c7;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">Verify Email</a>
      <p style="color:#64748b;font-size:14px;margin-top:20px">This link expires in 24 hours.</p>
    </div>
  </div>`;
}

export function passwordResetTemplate(name: string, link: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc">
    <div style="background:#0284c7;padding:20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:white;margin:0">${config.appName}</h1>
    </div>
    <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
      <h2>Password Reset</h2>
      <p>Hi ${name}, you requested to reset your password.</p>
      <a href="${link}" style="display:inline-block;background:#dc2626;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">Reset Password</a>
      <p style="color:#64748b;font-size:14px;margin-top:20px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  </div>`;
}

export function paymentReminderTemplate(name: string, amount: string, dueDate: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc">
    <div style="background:#f59e0b;padding:20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:white;margin:0">Payment Reminder</h1>
    </div>
    <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
      <h2>Hi ${name},</h2>
      <p>This is a friendly reminder that your payment of <strong>Rs. ${amount}</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please log in to your member portal to complete your payment.</p>
      <a href="${config.clientUrl}/payments" style="display:inline-block;background:#0284c7;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">View Payment</a>
    </div>
  </div>`;
}

export function eventReminderTemplate(name: string, eventTitle: string, eventDate: string, location: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc">
    <div style="background:#8b5cf6;padding:20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:white;margin:0">Event Reminder</h1>
    </div>
    <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
      <h2>Hi ${name},</h2>
      <p>Don't forget! <strong>${eventTitle}</strong> is coming up.</p>
      <p>📅 <strong>Date:</strong> ${eventDate}</p>
      <p>📍 <strong>Location:</strong> ${location}</p>
      <a href="${config.clientUrl}/events" style="display:inline-block;background:#8b5cf6;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">View Event</a>
    </div>
  </div>`;
}
