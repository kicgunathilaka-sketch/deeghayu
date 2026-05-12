import crypto from 'crypto';
import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyToken } from '../../utils/jwt';
import { generateMembershipId } from '../../utils/membershipId';
import { generateMemberQr } from '../../utils/qrCode';
import {
  sendMail,
  passwordResetTemplate,
} from '../../utils/mailer';
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
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictError('Email already registered');

    const existingNic = await prisma.member.findUnique({ where: { nic: data.nic } });
    if (existingNic) throw new ConflictError('NIC already registered');

    const passwordHash = await hashPassword(data.password);
    const membershipId = await generateMembershipId();

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        isEmailVerified: true,
        member: {
          create: {
            membershipId,
            fullName: data.fullName,
            nic: data.nic,
            phone: data.phone,
            address: data.address,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            occupation: data.occupation,
          },
        },
      },
      include: { member: true },
    });

    // Generate QR
    if (user.member) {
      const qrCodeUrl = await generateMemberQr(user.member.id, membershipId);
      await prisma.member.update({ where: { id: user.member.id }, data: { qrCodeUrl } });
    }

    return { message: 'Registration successful. Your account is pending admin approval.' };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { member: { select: { id: true, status: true } } },
    });
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Invalid credentials');

    const accessToken = signAccessToken({ id: user.id, role: user.role, memberId: user.member?.id });
    const refreshToken = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        memberId: user.member?.id,
      },
    };
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { member: { select: { id: true } } } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Rotate tokens
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { isRevoked: true } });

    const newRefreshToken = signRefreshToken(stored.userId);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({
      id: stored.user.id,
      role: stored.user.role,
      memberId: stored.user.member?.id,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { member: { select: { fullName: true } } },
    });

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const resetLink = `${config.clientUrl}/reset-password/${token}`;
    await sendMail({
      to: email,
      subject: 'Password Reset — Deeghayu Community',
      html: passwordResetTemplate(user.member?.fullName || 'Member', resetLink),
    });

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestError('Invalid or expired reset token');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordToken: null, resetTokenExpiry: null },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        member: {
          select: {
            id: true,
            membershipId: true,
            fullName: true,
            profilePhoto: true,
            status: true,
            phone: true,
          },
        },
      },
    });
  }
}
