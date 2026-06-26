import 'express-async-errors';
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

// Routes
import authRoutes from './modules/auth/auth.routes';
import memberRoutes from './modules/members/member.routes';
import paymentRoutes from './modules/payments/payment.routes';
import paymentEventRoutes from './modules/payment-events/payment-event.routes';
import eventRoutes from './modules/events/event.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import committeeRoutes from './modules/committee/committee.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import reportRoutes from './modules/reports/report.routes';
import uploadRoutes from './modules/upload/upload.routes';
import galleryRoutes from './modules/gallery/gallery.routes';
import bankAccountRoutes from './modules/bank-accounts/bank-account.routes';
import expenseRoutes from './modules/expenses/expense.routes';
import documentRoutes from './modules/documents/document.routes';
import performanceRoutes from './modules/performance/performance.routes';
import voteRoutes from './modules/votes/vote.routes';
import pushRoutes from './modules/push/push.routes';

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// CORS
const allowedOrigins = config.nodeEnv === 'development'
  ? /^http:\/\/localhost:\d+$/
  : config.clientUrl;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Serve uploaded files from the configured volume path
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(config.uploadPath));

// Global rate limit
app.use('/api', globalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: config.appName, env: config.nodeEnv });
});

// API routes
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/members`, memberRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/payment-events`, paymentEventRoutes);
app.use(`${API_PREFIX}/events`, eventRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/committee`, committeeRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/gallery`, galleryRoutes);
app.use(`${API_PREFIX}/bank-accounts`, bankAccountRoutes);
app.use(`${API_PREFIX}/expenses`, expenseRoutes);
app.use(`${API_PREFIX}/documents`, documentRoutes);
app.use(`${API_PREFIX}/performance`, performanceRoutes);
app.use(`${API_PREFIX}/votes`, voteRoutes);
app.use(`${API_PREFIX}/push-subscriptions`, pushRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
