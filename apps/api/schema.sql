-- ENUMS
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN','ADMIN','PRESIDENT','VICE_PRESIDENT','SECRETARY','TREASURER','COMMITTEE_MEMBER','MEMBER');
CREATE TYPE "MemberStatus" AS ENUM ('PENDING','ACTIVE','INACTIVE','SUSPENDED','DECEASED');
CREATE TYPE "PaymentType" AS ENUM ('MONTHLY_MEETING','SPECIAL_MEETING','COMMUNITY_EVENT','VOLUNTEER_EVENT','RELIGIOUS_EVENT','OTHER','CUSTOM');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID','PENDING','OVERDUE','PARTIAL','WAIVED');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','LATE','ABSENT');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED','ONGOING','COMPLETED','CANCELLED');
CREATE TYPE "EventCategory" AS ENUM ('MONTHLY_MEETING','SPECIAL_MEETING','COMMUNITY_EVENT','VOLUNTEER_EVENT','RELIGIOUS_EVENT','OTHER');
CREATE TYPE "NotificationType" AS ENUM ('EMAIL','IN_APP','BOTH');
CREATE TYPE "RsvpResponse" AS ENUM ('GOING','NOT_GOING','MAYBE');

-- USERS
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  "passwordHash"      TEXT NOT NULL,
  role                "Role" NOT NULL DEFAULT 'MEMBER',
  "isEmailVerified"   BOOLEAN NOT NULL DEFAULT false,
  "emailVerifyToken"  TEXT,
  "resetPasswordToken" TEXT,
  "resetTokenExpiry"  TIMESTAMPTZ,
  "lastLoginAt"       TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- MEMBERS
CREATE TABLE members (
  id               TEXT PRIMARY KEY,
  "userId"         TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "membershipId"   TEXT UNIQUE NOT NULL,
  "fullName"       TEXT NOT NULL,
  nic              TEXT UNIQUE NOT NULL,
  address          TEXT NOT NULL,
  phone            TEXT NOT NULL,
  "profilePhoto"   TEXT,
  "dateJoined"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dateOfBirth"    TIMESTAMPTZ,
  occupation       TEXT,
  status           "MemberStatus" NOT NULL DEFAULT 'PENDING',
  "qrCodeUrl"      TEXT,
  "signatureUrl"   TEXT,
  "emergencyContact" JSONB,
  "familyDetails"  JSONB,
  notes            TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_members_membershipId ON members("membershipId");
CREATE INDEX idx_members_nic ON members(nic);
CREATE INDEX idx_members_status ON members(status);

-- REFRESH TOKENS
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- PAYMENT EVENTS (compulsory all-member payment campaigns)
CREATE TABLE payment_events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  type         "PaymentType" NOT NULL,
  "customType" TEXT,
  amount       NUMERIC(10,2) NOT NULL,
  "dueDate"    TIMESTAMPTZ NOT NULL,
  month        INT,
  year         INT,
  description  TEXT,
  "recordedBy" TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAYMENTS
CREATE TABLE payments (
  id           TEXT PRIMARY KEY,
  "memberId"   TEXT NOT NULL REFERENCES members(id),
  type         "PaymentType" NOT NULL,
  status       "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  amount       NUMERIC(10,2) NOT NULL,
  "paidAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "dueDate"    TIMESTAMPTZ,
  "paidAt"     TIMESTAMPTZ,
  month        INT,
  year         INT,
  description  TEXT,
  "customType" TEXT,
  "eventId"       TEXT REFERENCES payment_events(id),
  "bankAccountId" TEXT REFERENCES bank_accounts(id),
  "receiptUrl"    TEXT,
  "recordedBy"    TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_memberId ON payments("memberId");
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(type);
CREATE INDEX idx_payments_year_month ON payments(year, month);

-- BANK ACCOUNTS
CREATE TABLE bank_accounts (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  "accountNumber"  TEXT,
  "openingBalance" NUMERIC(10,2) NOT NULL DEFAULT 0,
  description      TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdBy"      TEXT NOT NULL REFERENCES users(id),
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EXPENSES
CREATE TABLE expenses (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  category     TEXT NOT NULL,
  description     TEXT,
  "receiptUrl"    TEXT,
  date            TIMESTAMPTZ NOT NULL,
  "bankAccountId" TEXT REFERENCES bank_accounts(id),
  "recordedBy"    TEXT NOT NULL,
  year            INT NOT NULL,
  month           INT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_expenses_year_month ON expenses(year, month);

-- EVENTS
CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  category      "EventCategory" NOT NULL,
  status        "EventStatus" NOT NULL DEFAULT 'DRAFT',
  location      TEXT,
  "startTime"   TIMESTAMPTZ NOT NULL,
  "endTime"     TIMESTAMPTZ NOT NULL,
  "qrCode"      TEXT,
  "qrExpiresAt" TIMESTAMPTZ,
  "maxAttendees" INT,
  "requiresRsvp" BOOLEAN NOT NULL DEFAULT false,
  "requiresFee"  BOOLEAN NOT NULL DEFAULT false,
  "feeAmount"   NUMERIC(10,2),
  "coverImage"  TEXT,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_startTime ON events("startTime");

-- ATTENDANCES
CREATE TABLE attendances (
  id            TEXT PRIMARY KEY,
  "eventId"     TEXT NOT NULL REFERENCES events(id),
  "memberId"    TEXT NOT NULL REFERENCES members(id),
  status        "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "checkedInAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isLate"      BOOLEAN NOT NULL DEFAULT false,
  "deviceInfo"  TEXT,
  UNIQUE("eventId", "memberId")
);
CREATE INDEX idx_attendances_eventId ON attendances("eventId");
CREATE INDEX idx_attendances_memberId ON attendances("memberId");

-- EVENT RSVPs
CREATE TABLE event_rsvps (
  id         TEXT PRIMARY KEY,
  "eventId"  TEXT NOT NULL REFERENCES events(id),
  "memberId" TEXT NOT NULL REFERENCES members(id),
  response   "RsvpResponse" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("eventId", "memberId")
);

-- EVENT GALLERY
CREATE TABLE event_gallery (
  id           TEXT PRIMARY KEY,
  "eventId"    TEXT NOT NULL REFERENCES events(id),
  "imageUrl"   TEXT NOT NULL,
  caption      TEXT,
  "uploadedBy" TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COMMITTEE PANELS
CREATE TABLE committee_panels (
  id         TEXT PRIMARY KEY,
  year       INT UNIQUE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  notes      TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- COMMITTEE ROLES
CREATE TABLE committee_roles (
  id          TEXT PRIMARY KEY,
  "panelId"   TEXT NOT NULL REFERENCES committee_panels(id),
  "memberId"  TEXT NOT NULL REFERENCES members(id),
  role        "Role" NOT NULL,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate"   TIMESTAMPTZ,
  notes       TEXT,
  UNIQUE("panelId", "memberId", role)
);
CREATE INDEX idx_committee_roles_panelId ON committee_roles("panelId");
CREATE INDEX idx_committee_roles_memberId ON committee_roles("memberId");

-- NOTIFICATIONS
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  "userId"   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       "NotificationType" NOT NULL DEFAULT 'IN_APP',
  "isRead"   BOOLEAN NOT NULL DEFAULT false,
  link       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_userId_isRead ON notifications("userId", "isRead");

-- GALLERY ALBUMS
CREATE TABLE gallery_albums (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  "coverImage"  TEXT,
  "createdBy"   TEXT NOT NULL REFERENCES members(id),
  "isApproved"  BOOLEAN NOT NULL DEFAULT false,
  "approvedBy"  TEXT REFERENCES users(id),
  "approvedAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gallery_albums_createdBy ON gallery_albums("createdBy");
CREATE INDEX idx_gallery_albums_isApproved ON gallery_albums("isApproved");

-- GALLERY IMAGES
CREATE TABLE gallery_images (
  id           TEXT PRIMARY KEY,
  "albumId"    TEXT NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  "imageUrl"   TEXT NOT NULL,
  caption      TEXT,
  "uploadedBy" TEXT NOT NULL REFERENCES members(id),
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "approvedBy" TEXT REFERENCES users(id),
  "approvedAt" TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gallery_images_albumId ON gallery_images("albumId");
CREATE INDEX idx_gallery_images_isApproved ON gallery_images("isApproved");

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id           TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL,
  "entityId"   TEXT,
  metadata     JSONB,
  "ipAddress"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_userId ON audit_logs("userId");
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, "entityId");
CREATE INDEX idx_audit_logs_createdAt ON audit_logs("createdAt");

-- SYSTEM SETTINGS
CREATE TABLE system_settings (
  id         TEXT PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings (update monthly_fee to your community's actual fee amount)
INSERT INTO system_settings (id, key, value) VALUES
  (gen_random_uuid()::text, 'monthly_fee', '0'),
  (gen_random_uuid()::text, 'app_name', 'Deeghayu Community')
ON CONFLICT (key) DO NOTHING;
