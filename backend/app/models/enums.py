"""
Postgres ENUM types created by Prisma's migrations. Values must match
exactly (including case) -- these map to real `CREATE TYPE ... AS ENUM`
types already present in your database, so create_type=False everywhere
(SQLAlchemy must never try to (re)create them).
"""
from sqlalchemy import Enum


def pg_enum(*values, name):
    return Enum(*values, name=name, create_type=False)


LeadStatusEnum = pg_enum(
    "NEW", "CONTACTED", "QUALIFIED", "NURTURING", "CONVERTED", "UNQUALIFIED", "LOST",
    name="LeadStatus",
)
LeadSourceEnum = pg_enum(
    "WEBSITE", "REFERRAL", "LINKEDIN", "GOOGLE", "ADVERTISEMENT", "COLD_CALL",
    "EMAIL", "EVENT", "EXISTING_CUSTOMER", "OTHER",
    name="LeadSource",
)
PriorityEnum = pg_enum("LOW", "MEDIUM", "HIGH", "URGENT", name="Priority")
ContactStatusEnum = pg_enum("ACTIVE", "INACTIVE", "DO_NOT_CONTACT", name="ContactStatus")
DealStatusEnum = pg_enum("OPEN", "WON", "LOST", name="DealStatus")
TaskStatusEnum = pg_enum("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="TaskStatus")
TaskPriorityEnum = pg_enum("LOW", "MEDIUM", "HIGH", "URGENT", name="TaskPriority")
ActivityTypeEnum = pg_enum("CALL", "MEETING", "EMAIL", "WHATSAPP", "NOTE", "FOLLOW_UP", name="ActivityType")
# Added by db/migrations/20260919000000_activities_module.sql for the
# Activities module (the original Prisma schema had no activity status).
ActivityStatusEnum = pg_enum("PLANNED", "COMPLETED", "CANCELLED", name="ActivityStatus")

# Added by db/migrations/20260920000000_work_items_module.sql for the new
# Work module. WorkItem is its own table/entity -- distinct from Task and
# Activity -- so it gets its own type/category and status enums rather than
# reusing theirs. Priority is shared with Lead/Task via PriorityEnum above.
WorkTypeEnum = pg_enum("CALL", "EMAIL", "MEETING", "TASK", "NOTE", "OTHER", name="WorkType")
WorkStatusEnum = pg_enum("OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="WorkStatus")

# --- Originally defined in schema.prisma but not migrated by Prisma ---
# These are now fully wired up: db/migrations/20260917000000_calendar_
# notifications_email_reminders_automation.sql creates the types/tables,
# and the Calendar, Notifications, Email, Reminders and Automation modules
# read/write them below. See MIGRATION_NOTES.md for the history.
CalendarEventTypeEnum = pg_enum("CALL", "MEETING", "DEMO", "FOLLOW_UP", "TASK", "OTHER", name="CalendarEventType")
CalendarEventStatusEnum = pg_enum("DRAFT", "SCHEDULED", "CONFIRMED", "CANCELLED", "COMPLETED", name="CalendarEventStatus")
NotificationTypeEnum = pg_enum(
    "TASK_DUE", "TASK_OVERDUE", "UPCOMING_MEETING", "FOLLOW_UP_DUE", "DEAL_STAGE_CHANGED",
    "DEAL_WON", "DEAL_LOST", "LEAD_ASSIGNED", "TASK_ASSIGNED", "MENTION", "SYSTEM_NOTIFICATION",
    name="NotificationType",
)
EmailStatusEnum = pg_enum("DRAFT", "QUEUED", "SENT", "FAILED", name="EmailStatus")
EmailProviderTypeEnum = pg_enum("MOCK", "SMTP", "RESEND", "SENDGRID", name="EmailProviderType")
ReminderOffsetEnum = pg_enum("MINUTES_5", "MINUTES_15", "MINUTES_30", "HOURS_1", "DAYS_1", name="ReminderOffset")
ReminderTargetTypeEnum = pg_enum("TASK", "MEETING", "FOLLOW_UP", "DEAL_CLOSE_DATE", name="ReminderTargetType")
AutomationRuleTypeEnum = pg_enum(
    "LEAD_CREATED", "LEAD_STATUS_CHANGED", "DEAL_STAGE_CHANGED", "DEAL_CLOSE_SOON",
    "TASK_OVERDUE", "DEAL_WON", "DEAL_LOST",
    name="AutomationRuleType",
)
