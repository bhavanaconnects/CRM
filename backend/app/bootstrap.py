"""Safe local-development database bootstrap.

Creates missing SQLAlchemy tables/enums without dropping existing data and
seeds a usable demo account/pipeline when SEED_DEMO_DATA=true.
"""
from __future__ import annotations

import time
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import settings
from app.database import Base, engine
from app.models import core  # noqa: F401 - registers all ORM models
from app.models.core import Organization, Role, User, Pipeline, PipelineStage


def _create_enum_types() -> None:
    # models/enums.py intentionally uses create_type=False because the
    # original project expected Prisma migrations. For a fresh converted
    # database we create the enum types safely if they do not exist.
    from app.models import enums

    enum_names = [
        "LeadStatusEnum", "LeadSourceEnum", "PriorityEnum",
        "ContactStatusEnum", "DealStatusEnum", "TaskStatusEnum",
        "TaskPriorityEnum", "ActivityTypeEnum", "ActivityStatusEnum",
        "WorkTypeEnum", "WorkStatusEnum",
        "CalendarEventTypeEnum",
        "CalendarEventStatusEnum", "NotificationTypeEnum", "EmailStatusEnum",
        "EmailProviderTypeEnum", "ReminderOffsetEnum",
        "ReminderTargetTypeEnum", "AutomationRuleTypeEnum",
    ]
    with engine.begin() as conn:
        for attr in enum_names:
            enum = getattr(enums, attr)
            values = ", ".join("'" + v.replace("'", "''") + "'" for v in enum.enums)
            name = enum.name.replace('"', '""')
            conn.execute(text(
                f'DO $$ BEGIN CREATE TYPE "{name}" AS ENUM ({values}); '
                f'EXCEPTION WHEN duplicate_object THEN NULL; END $$;'
            ))


# Purely additive, idempotent schema patches for tables that already exist.
# Base.metadata.create_all() only creates MISSING tables -- it never adds a
# column to a table that is already there -- so columns introduced after the
# first deployment are applied here instead. Mirrors
# db/migrations/20260918000000_tasks_description_completed_at.sql; running it
# repeatedly is a no-op and it never drops or rewrites existing data.
_ADDITIVE_MIGRATIONS = (
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "description" TEXT;',
    'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);',
    'UPDATE tasks SET "completedAt" = "updatedAt" '
    "WHERE status = 'COMPLETED' AND \"completedAt\" IS NULL;",
    'CREATE INDEX IF NOT EXISTS tasks_org_due_idx ON tasks ("organizationId", "dueDate");',
    'CREATE INDEX IF NOT EXISTS tasks_org_status_idx ON tasks ("organizationId", status);',
    'CREATE INDEX IF NOT EXISTS tasks_org_assignee_idx ON tasks ("organizationId", "assigneeId");',
    # Activities module -- mirrors
    # db/migrations/20260919000000_activities_module.sql
    'ALTER TABLE activities ADD COLUMN IF NOT EXISTS "subject" TEXT;',
    'ALTER TABLE activities ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;',
    'ALTER TABLE activities ADD COLUMN IF NOT EXISTS "status" "ActivityStatus" '
    "NOT NULL DEFAULT 'COMPLETED';",
    'CREATE INDEX IF NOT EXISTS activities_org_occurred_idx ON activities ("organizationId", "occurredAt");',
    'CREATE INDEX IF NOT EXISTS activities_org_type_idx ON activities ("organizationId", type);',
    'CREATE INDEX IF NOT EXISTS activities_org_user_idx ON activities ("organizationId", "userId");',
)


def _apply_additive_migrations() -> None:
    with engine.begin() as conn:
        for statement in _ADDITIVE_MIGRATIONS:
            conn.execute(text(statement))


def initialize_database() -> None:
    last_error = None
    for _ in range(30):
        try:
            _create_enum_types()
            Base.metadata.create_all(bind=engine)
            _apply_additive_migrations()
            _seed_demo_data()
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(2)
    raise RuntimeError(f"Database was not ready after 60 seconds: {last_error}")


def _seed_demo_data() -> None:
    if not settings.seed_demo_data:
        return

    db = Session(bind=engine)
    try:
        admin_role = db.query(Role).filter(Role.name == "ADMIN").first()
        if not admin_role:
            admin_role = Role(name="ADMIN")
            db.add(admin_role)
            db.flush()

        user_role = db.query(Role).filter(Role.name == "USER").first()
        if not user_role:
            user_role = Role(name="USER")
            db.add(user_role)
            db.flush()

        org = db.query(Organization).order_by(Organization.createdAt.asc()).first()
        if not org:
            org = Organization(name="CRM Demo")
            db.add(org)
            db.flush()

        admin = db.query(User).filter(User.email == settings.demo_email).first()
        if not admin:
            admin = User(
                organizationId=org.id,
                roleId=admin_role.id,
                name="Admin",
                email=settings.demo_email,
                passwordHash=hash_password(settings.demo_password),
            )
            db.add(admin)
            db.flush()
        elif admin.organizationId == org.id and settings.environment != "production":
            # Local demo mode: make the documented demo password deterministic.
            admin.passwordHash = hash_password(settings.demo_password)
            admin.roleId = admin_role.id

        other_org = db.query(Organization).filter(Organization.name == "CRM Other Demo").first()
        if not other_org:
            other_org = Organization(name="CRM Other Demo")
            db.add(other_org)
            db.flush()

        other = db.query(User).filter(User.email == "other@example.com").first()
        if not other:
            other = User(
                organizationId=other_org.id,
                roleId=user_role.id,
                name="Other Demo User",
                email="other@example.com",
                passwordHash=hash_password(settings.demo_password),
            )
            db.add(other)

        pipeline = db.query(Pipeline).filter(Pipeline.organizationId == org.id).first()
        if not pipeline:
            pipeline = Pipeline(organizationId=org.id, name="Sales Pipeline")
            db.add(pipeline)
            db.flush()
            for order, name in enumerate(["New", "Qualified", "Proposal", "Won"]):
                db.add(PipelineStage(pipelineId=pipeline.id, name=name, order=order))

        db.commit()
    finally:
        db.close()
