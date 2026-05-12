import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Role } from '../types';

export interface JwtPayload {
  id: string;
  role: Role;
  memberId?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpires as any,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpires as any,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

export function signEmailToken(userId: string): string {
  return jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: '24h' });
}

export function signQrToken(eventId: string, expiresAt: Date): string {
  const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return jwt.sign({ eventId }, config.jwt.secret, { expiresIn: ttlSeconds });
}

export function verifyQrToken(token: string): { eventId: string } {
  return jwt.verify(token, config.jwt.secret) as { eventId: string };
}
