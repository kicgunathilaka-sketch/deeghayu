# 🌿 Deeghayu Community — Management System

A full-stack, production-ready community management platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + Refresh Token Rotation |
| State | Zustand + TanStack Query |
| Charts | Recharts |
| QR | html5-qrcode + qrcode.react |
| Email | Nodemailer |
| Reports | PDFKit + ExcelJS |
| Deployment | Docker + Docker Compose + Nginx |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd deeghayu-community
npm install
cd apps/api && npm install
cd ../web && npm install
```

### 2. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your database credentials
```

### 3. Database Setup

```bash
cd apps/api
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run Development

```bash
# From root
npm run dev

# Or separately:
# API: http://localhost:3001
# Web: http://localhost:5173
```

### Default Admin Credentials
- **Email:** admin@deeghayu.org
- **Password:** Admin@123

## Docker

```bash
docker-compose up -d
```

## Project Structure

```
deeghayu-community/
├── apps/
│   ├── api/          # Express + Prisma backend
│   └── web/          # React frontend
├── packages/
│   ├── types/        # Shared TypeScript types
│   └── validators/   # Shared Zod schemas
└── docker-compose.yml
```

## API Documentation

Base URL: `http://localhost:3001/api/v1`

| Module | Prefix |
|---|---|
| Authentication | `/auth` |
| Members | `/members` |
| Payments | `/payments` |
| Events | `/events` |
| Attendance | `/attendance` |
| Committee | `/committee` |
| Notifications | `/notifications` |
| Reports | `/reports` |

## Features

- ✅ JWT + refresh token authentication
- ✅ Role-based access control (8 roles)
- ✅ Member management with QR codes
- ✅ QR-based event attendance (mobile scanner)
- ✅ Payment tracking with PDF receipts
- ✅ Yearly committee panel management
- ✅ Event management with RSVP
- ✅ Analytics dashboard
- ✅ PDF/Excel/CSV report export
- ✅ Email notifications
- ✅ Dark/light mode
- ✅ Mobile-first responsive UI
- ✅ Docker ready
- ✅ GitHub Actions CI/CD
