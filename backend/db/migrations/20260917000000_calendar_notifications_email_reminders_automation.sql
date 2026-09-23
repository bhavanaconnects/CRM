-- =====================================================================
-- Adds the five tables that exist in prisma/schema.prisma but were never
-- migrated into the database: calendar_events, notifications, emails,
-- reminders, automation_rules (plus their enum types).
--
-- Without this migration the Calendar, Notifications, Email, Reminders
-- and Automation modules cannot work -- the Next.js services referenced
-- prisma.calendarEvent / prisma.notification / etc., but no CREATE TABLE
-- for them exists in prisma/migrations/.
--
-- SAFETY: this migration is PURELY ADDITIVE.
--   * No DROP TABLE / DROP DATABASE / TRUNCATE.
--   * No changes to existing tables' columns or data.
--   * Every CREATE uses IF NOT EXISTS (enums use a DO-block guard),
--     so re-running it is safe and it is safe to run against a database
--     where some of these objects already exist.
-- =====================================================================

BEGIN;

-- ---------- Enum types ------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "CalendarEventType" AS ENUM ('CALL','MEETING','DEMO','FOLLOW_UP','TASK','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarEventStatus" AS ENUM ('DRAFT','SCHEDULED','CONFIRMED','CANCELLED','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'TASK_DUE','TASK_OVERDUE','UPCOMING_MEETING','FOLLOW_UP_DUE','DEAL_STAGE_CHANGED',
    'DEAL_WON','DEAL_LOST','LEAD_ASSIGNED','TASK_ASSIGNED','MENTION','SYSTEM_NOTIFICATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('DRAFT','QUEUED','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmailProviderType" AS ENUM ('MOCK','SMTP','RESEND','SENDGRID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReminderOffset" AS ENUM ('MINUTES_5','MINUTES_15','MINUTES_30','HOURS_1','DAYS_1');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReminderTargetType" AS ENUM ('TASK','MEETING','FOLLOW_UP','DEAL_CLOSE_DATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationRuleType" AS ENUM (
    'LEAD_CREATED','LEAD_STATUS_CHANGED','DEAL_STAGE_CHANGED','DEAL_CLOSE_SOON',
    'TASK_OVERDUE','DEAL_WON','DEAL_LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- calendar_events ------------------------------------------
CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "userId"           TEXT,
  "createdById"      TEXT,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "startAt"          TIMESTAMP(3) NOT NULL,
  "endAt"            TIMESTAMP(3),
  "allDay"           BOOLEAN NOT NULL DEFAULT false,
  "location"         TEXT,
  "eventType"        "CalendarEventType" NOT NULL DEFAULT 'MEETING',
  "status"           "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "reminderMinutes"  INTEGER,
  "assignedUserId"   TEXT,
  "relatedLeadId"    TEXT,
  "relatedContactId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedDealId"    TEXT,
  "relatedTaskId"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_events_organizationId_idx" ON "calendar_events"("organizationId");
CREATE INDEX IF NOT EXISTS "calendar_events_organizationId_startAt_idx" ON "calendar_events"("organizationId","startAt");
CREATE INDEX IF NOT EXISTS "calendar_events_organizationId_userId_idx" ON "calendar_events"("organizationId","userId");
CREATE INDEX IF NOT EXISTS "calendar_events_createdAt_idx" ON "calendar_events"("createdAt");

-- ---------- notifications --------------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "type"            "NotificationType" NOT NULL,
  "title"           TEXT NOT NULL,
  "message"         TEXT NOT NULL,
  "relatedEntity"   TEXT,
  "relatedEntityId" TEXT,
  "read"            BOOLEAN NOT NULL DEFAULT false,
  "readAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_organizationId_userId_read_idx" ON "notifications"("organizationId","userId","read");
CREATE INDEX IF NOT EXISTS "notifications_organizationId_userId_createdAt_idx" ON "notifications"("organizationId","userId","createdAt");

-- ---------- emails ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "emails" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "userId"           TEXT,
  "provider"         "EmailProviderType" NOT NULL DEFAULT 'MOCK',
  "fromName"         TEXT,
  "fromEmail"        TEXT,
  "replyTo"          TEXT,
  "to"               TEXT NOT NULL,
  "cc"               TEXT,
  "bcc"              TEXT,
  "subject"          TEXT NOT NULL,
  "body"             TEXT NOT NULL,
  "relatedLeadId"    TEXT,
  "relatedContactId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedDealId"    TEXT,
  "status"           "EmailStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt"           TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "emails_organizationId_idx" ON "emails"("organizationId");
CREATE INDEX IF NOT EXISTS "emails_organizationId_status_idx" ON "emails"("organizationId","status");
CREATE INDEX IF NOT EXISTS "emails_organizationId_createdAt_idx" ON "emails"("organizationId","createdAt");

-- ---------- reminders -------------------------------------------------
CREATE TABLE IF NOT EXISTS "reminders" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT,
  "taskId"         TEXT,
  "leadId"         TEXT,
  "dealId"         TEXT,
  "reminderAt"     TIMESTAMP(3) NOT NULL,
  "offset"         "ReminderOffset" NOT NULL DEFAULT 'MINUTES_15',
  "targetType"     "ReminderTargetType" NOT NULL DEFAULT 'TASK',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reminders_organizationId_idx" ON "reminders"("organizationId");
CREATE INDEX IF NOT EXISTS "reminders_organizationId_reminderAt_idx" ON "reminders"("organizationId","reminderAt");
CREATE INDEX IF NOT EXISTS "reminders_organizationId_userId_idx" ON "reminders"("organizationId","userId");

-- ---------- automation_rules ------------------------------------------
CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById"    TEXT,
  "name"           TEXT NOT NULL,
  "type"           "AutomationRuleType" NOT NULL,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "config"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "automation_rules_organizationId_enabled_idx" ON "automation_rules"("organizationId","enabled");
CREATE INDEX IF NOT EXISTS "automation_rules_organizationId_type_idx" ON "automation_rules"("organizationId","type");

-- ---------- Foreign keys ----------------------------------------------
-- Added separately and guarded, so the migration stays re-runnable.
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "emails" ADD CONSTRAINT "emails_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "emails" ADD CONSTRAINT "emails_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
