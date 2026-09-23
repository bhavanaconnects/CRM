-- Activities module: adds the columns the Activities UI needs that the
-- original Prisma-managed `activities` table never had, plus the
-- ActivityStatus enum type.
--
-- SAFE + REPEATABLE: the enum creation is guarded by a DO block, every
-- column uses ADD COLUMN IF NOT EXISTS, and every index uses
-- CREATE INDEX IF NOT EXISTS. Running this file (or restarting the backend,
-- which applies the same statements from app/bootstrap.py) against a
-- database that already has them is a no-op. No existing rows or columns are
-- dropped or rewritten.

DO $$ BEGIN
  CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE activities ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS "status" "ActivityStatus"
  NOT NULL DEFAULT 'COMPLETED';

-- Indexes backing the Activities timeline filters, the dashboard cards and
-- the per-user upcoming list.
CREATE INDEX IF NOT EXISTS activities_org_occurred_idx ON activities ("organizationId", "occurredAt");
CREATE INDEX IF NOT EXISTS activities_org_type_idx ON activities ("organizationId", type);
CREATE INDEX IF NOT EXISTS activities_org_user_idx ON activities ("organizationId", "userId");
