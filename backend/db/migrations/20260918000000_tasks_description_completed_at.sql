-- Tasks module: adds the two columns the Tasks UI needs that the original
-- Prisma-managed `tasks` table never had.
--
-- SAFE + REPEATABLE: both statements use IF NOT EXISTS, so running this file
-- (or restarting the backend, which applies the same statements from
-- app/bootstrap.py) against a database that already has the columns is a
-- no-op. No existing rows or columns are touched, dropped or rewritten.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill completedAt for tasks that were already completed before this
-- migration ran, so "recently completed" lists are not empty for them.
-- Only touches rows where the value is still NULL.
UPDATE tasks
   SET "completedAt" = "updatedAt"
 WHERE status = 'COMPLETED'
   AND "completedAt" IS NULL;

-- Indexes that back the Tasks list filters and the dashboard counters.
CREATE INDEX IF NOT EXISTS tasks_org_due_idx ON tasks ("organizationId", "dueDate");
CREATE INDEX IF NOT EXISTS tasks_org_status_idx ON tasks ("organizationId", status);
CREATE INDEX IF NOT EXISTS tasks_org_assignee_idx ON tasks ("organizationId", "assigneeId");
