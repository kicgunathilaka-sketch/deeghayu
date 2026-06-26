import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  appName: process.env.APP_NAME || 'Deeghayu Community',
  appUrl: process.env.APP_URL || 'http://localhost:3001',
  membershipPrefix: process.env.MEMBERSHIP_PREFIX || 'DC',

  jwt: {
    secret: process.env.JWT_SECRET || 'changeme-super-secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Deeghayu Community <no-reply@deeghayu.org>',
  },

  uploadPath: process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'),

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
} as const;
