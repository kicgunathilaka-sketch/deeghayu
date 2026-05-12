import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyToken } from '../../utils/jwt';
import { generateMembershipId } from '../../utils/membershipId';
import { generateMemberQr } from '../../utils/qrCode';
import { sendMail, passwordResetTemplate } from '../../utils/mailer';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors';
import { config } from '../../config';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    nic: string;
    phone: string;
    address: string;
    dateOfBirth?: string;
    occupation?: string;
  }) {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existingUser.rows[0]) throw new ConflictError('Email already registered');

    const existingNic = await pool.query('SELECT id FROM members WHERE nic = $1', [data.nic]);
    if (existingNic.rows[0]) throw new ConflictError('NIC already registered');

    const passwordHash = await hashPassword(data.password);
    const membershipId = await generateMembershipId();
    const userId = uuidv4();
    const memberId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, email, "passwordHash", role, "isEmailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'MEMBER', true, NOW(), NOW())`,
      [userId, data.email, passwordHash]
    );

    await pool.query(
      `INSERT INTO members (id, "userId", "membershipId", "fullName", nic, phone, address, "dateOfBirth", occupation, status, "dateJoined", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', NOW(), NOW(), NOW())`,
      [
        memberId,
        userId,
        membershipId,
        data.fullName,
        data.nic,
        data.phone,
        data.address,
        data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        data.occupation || null,
      ]
    );

    const qrCodeUrl = await generateMemberQr(memberId, membershipId);
    await pool.query('UPDATE members SET "qrCodeUrl" = $1, "updatedAt" = NOW() WHERE id = $2', [
      qrCodeUrl,
      memberId,
    ]);

    return { message: 'Registration successful. Your account is pending admin approval.' };
  }

  async login(email: string, password: string) {
    const result = await pool.query(
      `SELECT u.id, u.email, u."passwordHash", u.role, u."isEmailVerified",
              m.id AS "memberId", m.status AS "memberStatus"
       FROM users u
       LEFT JOIN members m ON m."userId" = u.id
       WHERE u.email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Invalid credentials');

    const accessToken = signAccessToken({ id: user.id, role: user.role, memberId: user.memberId });
    const refreshToken = signRefreshToken(user.id);

    await pool.query(
      `INSERT INTO refresh_tokens (id, token, "userId", "expiresAt", "isRevoked", "createdAt")
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [uuidv4(), refreshToken, user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    await pool.query('UPDATE users SET "lastLoginAt" = NOW(), "updatedAt" = NOW() WHERE id = $1', [
      user.id,
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        memberId: user.memberId ?? undefined,
      },
    };
  }

  async refresh(refreshToken: string) {
    const result = await pool.query(
      `SELECT rt.id, rt."userId", rt."isRevoked", rt."expiresAt",
              u.role, u.email,
              m.id AS "memberId"
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt."userId"
       LEFT JOIN members m ON m."userId" = u.id
       WHERE rt.token = $1`,
      [refreshToken]
    );
    const stored = result.rows[0];

    if (!stored || stored.isRevoked || new Date(stored.expiresAt) < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await pool.query('UPDATE refresh_tokens SET "isRevoked" = true WHERE id = $1', [stored.id]);

    const newRefreshToken = signRefreshToken(stored.userId);
    await pool.query(
      `INSERT INTO refresh_tokens (id, token, "userId", "expiresAt", "isRevoked", "createdAt")
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [uuidv4(), newRefreshToken, stored.userId, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    const accessToken = signAccessToken({
      id: stored.userId,
      role: stored.role,
      memberId: stored.memberId ?? undefined,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await pool.query('UPDATE refresh_tokens SET "isRevoked" = true WHERE token = $1', [
      refreshToken,
    ]);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const result = await pool.query(
      `SELECT u.id, u.email, m."fullName"
       FROM users u
       LEFT JOIN members m ON m."userId" = u.id
       WHERE u.email = $1`,
      [email]
    );
    const user = result.rows[0];

    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE users SET "resetPasswordToken" = $1, "resetTokenExpiry" = $2, "updatedAt" = NOW() WHERE id = $3`,
      [token, new Date(Date.now() + 60 * 60 * 1000), user.id]
    );

    const resetLink = `${config.clientUrl}/reset-password/${token}`;
    await sendMail({
      to: email,
      subject: 'Password Reset — Deeghayu Community',
      html: passwordResetTemplate(user.fullName || 'Member', resetLink),
    });

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const result = await pool.query(
      `SELECT id FROM users WHERE "resetPasswordToken" = $1 AND "resetTokenExpiry" > NOW()`,
      [token]
    );
    const user = result.rows[0];
    if (!user) throw new BadRequestError('Invalid or expired reset token');

    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      `UPDATE users SET "passwordHash" = $1, "resetPasswordToken" = null, "resetTokenExpiry" = null, "updatedAt" = NOW() WHERE id = $2`,
      [passwordHash, user.id]
    );

    await pool.query('UPDATE refresh_tokens SET "isRevoked" = true WHERE "userId" = $1', [user.id]);

    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u."isEmailVerified", u."lastLoginAt",
              m.id AS "memberId", m."membershipId", m."fullName", m."profilePhoto",
              m.status AS "memberStatus", m.phone
       FROM users u
       LEFT JOIN members m ON m."userId" = u.id
       WHERE u.id = $1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      isEmailVerified: row.isEmailVerified,
      lastLoginAt: row.lastLoginAt,
      member: row.memberId
        ? {
            id: row.memberId,
            membershipId: row.membershipId,
            fullName: row.fullName,
            profilePhoto: row.profilePhoto,
            status: row.memberStatus,
            phone: row.phone,
          }
        : null,
    };
  }
}
