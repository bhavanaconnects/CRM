-- Work module: adds a brand-new `work_items` table plus the two enum types
-- it needs (WorkType, WorkStatus). Unlike the Tasks/Activities migrations,
-- this does NOT alter any existing table -- WorkItem is its own entity,
-- separate from Task and Activity, so Tasks and Activities are untouched.
--
-- SAFE + REPEATABLE: enum creation is guarded by DO blocks, the table uses
-- CREATE TABLE IF NOT EXISTS, and every index uses CREATE INDEX IF NOT
-- EXISTS. Running this file (or restarting the backend, which creates the
-- same table via SQLAlchemy's Base.metadata.create_all()) against a
-- database that already has it is a no-op.

DO $$ BEGIN
  CREATE TYPE "WorkType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS work_items (
    id              TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "assigneeId"    TEXT REFERENCES users(id) ON DELETE SET NULL,
    "leadId"        TEXT REFERENCES leads(id) ON DELETE SET NULL,
    "contactId"     TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    "companyId"     TEXT REFERENCES companies(id) ON DELETE SET NULL,
    "dealId"        TEXT REFERENCES deals(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    type            "WorkType" NOT NULL DEFAULT 'TASK',
    priority        "Priority" NOT NULL DEFAULT 'MEDIUM',
    status          "WorkStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate"       TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_items_org_status_idx ON work_items ("organizationId", status);
CREATE INDEX IF NOT EXISTS work_items_org_assignee_idx ON work_items ("organizationId", "assigneeId");
CREATE INDEX IF NOT EXISTS work_items_org_due_idx ON work_items ("organizationId", "dueDate");
CREATE INDEX IF NOT EXISTS work_items_org_type_idx ON work_items ("organizationId", type);
