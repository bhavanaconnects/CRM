"""
SQLAlchemy models mapped 1:1 onto the EXISTING Prisma-managed schema.

Table names and column names match prisma/schema.prisma exactly
(Prisma's default camelCase column names, @@map'd snake_case table
names) so this backend reads and writes the SAME rows Prisma did.
Nothing here should ever be used to create/drop/alter tables --
see app/database.py.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import (
    ActivityStatusEnum, ActivityTypeEnum, AutomationRuleTypeEnum, CalendarEventStatusEnum,
    CalendarEventTypeEnum, ContactStatusEnum, DealStatusEnum,
    EmailProviderTypeEnum, EmailStatusEnum, LeadSourceEnum, LeadStatusEnum,
    NotificationTypeEnum, PriorityEnum, ReminderOffsetEnum,
    ReminderTargetTypeEnum, TaskPriorityEnum, TaskStatusEnum,
    WorkStatusEnum, WorkTypeEnum,
)


def uuid_str():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Text, primary_key=True, default=uuid_str)
    name = Column(Text, nullable=False)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    users = relationship("User", back_populates="organization")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Text, primary_key=True, default=uuid_str)
    name = Column(Text, nullable=False, unique=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)


class User(Base):
    __tablename__ = "users"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    roleId = Column(Text, ForeignKey("roles.id"), nullable=False)
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, unique=True)
    passwordHash = Column(Text, nullable=False)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    organization = relationship("Organization", back_populates="users")
    role = relationship("Role")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    ownerId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(Text, nullable=False)
    industry = Column(Text, nullable=True)
    website = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    owner = relationship("User", foreign_keys=[ownerId])
    contacts = relationship("Contact", back_populates="company", foreign_keys="Contact.companyId")
    deals = relationship("Deal", back_populates="company", foreign_keys="Deal.companyId")
    tasks = relationship("Task", back_populates="company", foreign_keys="Task.companyId")
    activities = relationship("Activity", back_populates="company", foreign_keys="Activity.companyId")
    leads = relationship("Lead", back_populates="company", foreign_keys="Lead.companyId")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    companyId = Column(Text, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    ownerId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    firstName = Column(Text, nullable=False)
    lastName = Column(Text, nullable=False)
    jobTitle = Column(Text, nullable=True)
    email = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    mobilePhone = Column(Text, nullable=True)
    status = Column(ContactStatusEnum, nullable=False, server_default="ACTIVE")
    source = Column(LeadSourceEnum, nullable=True, server_default="OTHER")
    tags = Column(ARRAY(Text), nullable=False, server_default="{}")
    address = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    state = Column(Text, nullable=True)
    country = Column(Text, nullable=True)
    postalCode = Column(Text, nullable=True)
    website = Column(Text, nullable=True)
    linkedinUrl = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    lastContactedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    company = relationship("Company", foreign_keys=[companyId])
    owner = relationship("User", foreign_keys=[ownerId])
    tasks = relationship("Task", back_populates="contact", foreign_keys="Task.contactId")
    activities = relationship("Activity", back_populates="contact", foreign_keys="Activity.contactId")
    leads = relationship("Lead", back_populates="contact", foreign_keys="Lead.contactId")
    deals = relationship("Deal", back_populates="contact", foreign_keys="Deal.contactId")


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    stages = relationship("PipelineStage", back_populates="pipeline", order_by="PipelineStage.order")


class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id = Column(Text, primary_key=True, default=uuid_str)
    pipelineId = Column(Text, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    order = Column(Integer, nullable=False)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("Pipeline", back_populates="stages")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    ownerId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    createdById = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    firstName = Column(Text, nullable=False)
    lastName = Column(Text, nullable=False)
    email = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    companyName = Column(Text, nullable=True)
    companyId = Column(Text, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    contactId = Column(Text, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    jobTitle = Column(Text, nullable=True)
    source = Column(LeadSourceEnum, nullable=False, server_default="OTHER")
    status = Column(LeadStatusEnum, nullable=False, server_default="NEW")
    priority = Column(PriorityEnum, nullable=False, server_default="MEDIUM")
    estimatedValue = Column(Numeric(12, 2), nullable=True)
    expectedCloseDate = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default="{}")
    convertedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    owner = relationship("User", foreign_keys=[ownerId])
    createdBy = relationship("User", foreign_keys=[createdById])
    company = relationship("Company", back_populates="leads", foreign_keys=[companyId])
    contact = relationship("Contact", back_populates="leads", foreign_keys=[contactId])
    tasks = relationship("Task", back_populates="lead", foreign_keys="Task.leadId")
    activities = relationship("Activity", back_populates="lead", foreign_keys="Activity.leadId", order_by="Activity.occurredAt.desc()")
    deal = relationship("Deal", back_populates="lead", uselist=False)


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    ownerId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    companyId = Column(Text, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    contactId = Column(Text, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    pipelineId = Column(Text, ForeignKey("pipelines.id"), nullable=False)
    stageId = Column(Text, ForeignKey("pipeline_stages.id"), nullable=False)
    leadId = Column(Text, ForeignKey("leads.id"), nullable=True, unique=True)
    title = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    probability = Column(Integer, nullable=True)
    status = Column(DealStatusEnum, nullable=False, server_default="OPEN")
    expectedCloseDate = Column(DateTime, nullable=True)
    closedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    pipeline = relationship("Pipeline")
    stage = relationship("PipelineStage")
    lead = relationship("Lead", back_populates="deal")
    owner = relationship("User", foreign_keys=[ownerId])
    company = relationship("Company", back_populates="deals", foreign_keys=[companyId])
    contact = relationship("Contact", back_populates="deals", foreign_keys=[contactId])
    tasks = relationship("Task", back_populates="deal", foreign_keys="Task.dealId")
    activities = relationship("Activity", back_populates="deal", foreign_keys="Activity.dealId")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    assigneeId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    leadId = Column(Text, ForeignKey("leads.id"), nullable=True)
    contactId = Column(Text, ForeignKey("contacts.id"), nullable=True)
    companyId = Column(Text, ForeignKey("companies.id"), nullable=True)
    dealId = Column(Text, ForeignKey("deals.id"), nullable=True)
    title = Column(Text, nullable=False)
    # Added by db/migrations/20260918000000_tasks_description_completed_at.sql
    # (applied idempotently at startup by app/bootstrap.py).
    description = Column(Text, nullable=True)
    status = Column(TaskStatusEnum, nullable=False, server_default="PENDING")
    priority = Column(TaskPriorityEnum, nullable=False, server_default="MEDIUM")
    dueDate = Column(DateTime, nullable=True)
    completedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    assignee = relationship("User", foreign_keys=[assigneeId])
    lead = relationship("Lead", back_populates="tasks", foreign_keys=[leadId])
    contact = relationship("Contact", back_populates="tasks", foreign_keys=[contactId])
    company = relationship("Company", back_populates="tasks", foreign_keys=[companyId])
    deal = relationship("Deal", back_populates="tasks", foreign_keys=[dealId])


# =====================================================================
# Work module. WorkItem is a brand-new table (not an alteration of Task or
# Activity) added by db/migrations/20260920000000_work_items_module.sql.
# =====================================================================


class WorkItem(Base):
    __tablename__ = "work_items"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    assigneeId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    leadId = Column(Text, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    contactId = Column(Text, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    companyId = Column(Text, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    dealId = Column(Text, ForeignKey("deals.id", ondelete="SET NULL"), nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(WorkTypeEnum, nullable=False, server_default="TASK")
    priority = Column(PriorityEnum, nullable=False, server_default="MEDIUM")
    status = Column(WorkStatusEnum, nullable=False, server_default="OPEN")
    dueDate = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    assignee = relationship("User", foreign_keys=[assigneeId])
    lead = relationship("Lead", foreign_keys=[leadId])
    contact = relationship("Contact", foreign_keys=[contactId])
    company = relationship("Company", foreign_keys=[companyId])
    deal = relationship("Deal", foreign_keys=[dealId])


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    userId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    leadId = Column(Text, ForeignKey("leads.id"), nullable=True)
    contactId = Column(Text, ForeignKey("contacts.id"), nullable=True)
    companyId = Column(Text, ForeignKey("companies.id"), nullable=True)
    dealId = Column(Text, ForeignKey("deals.id"), nullable=True)
    type = Column(ActivityTypeEnum, nullable=False)
    # subject / status / durationMinutes are added by
    # db/migrations/20260919000000_activities_module.sql (applied idempotently
    # at startup by app/bootstrap.py). `notes` remains the description.
    subject = Column(Text, nullable=True)
    notes = Column(Text, nullable=False)
    status = Column(ActivityStatusEnum, nullable=False, server_default="COMPLETED")
    durationMinutes = Column(Integer, nullable=True)
    occurredAt = Column(DateTime, nullable=False, server_default=func.now())
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", foreign_keys=[userId])
    lead = relationship("Lead", back_populates="activities", foreign_keys=[leadId])
    contact = relationship("Contact", back_populates="activities", foreign_keys=[contactId])
    company = relationship("Company", back_populates="activities", foreign_keys=[companyId])
    deal = relationship("Deal", back_populates="activities", foreign_keys=[dealId])


# =====================================================================
# Models for the five tables added by
# db/migrations/20260917000000_calendar_notifications_email_reminders_automation.sql
# (defined in schema.prisma but never migrated by Prisma).
# =====================================================================


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    userId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    createdById = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    startAt = Column(DateTime, nullable=False)
    endAt = Column(DateTime, nullable=True)
    allDay = Column(Boolean, nullable=False, server_default="false")
    location = Column(Text, nullable=True)
    eventType = Column(CalendarEventTypeEnum, nullable=False, server_default="MEETING")
    status = Column(CalendarEventStatusEnum, nullable=False, server_default="SCHEDULED")
    reminderMinutes = Column(Integer, nullable=True)
    assignedUserId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    relatedLeadId = Column(Text, nullable=True)
    relatedContactId = Column(Text, nullable=True)
    relatedCompanyId = Column(Text, nullable=True)
    relatedDealId = Column(Text, nullable=True)
    relatedTaskId = Column(Text, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", foreign_keys=[userId])
    creator = relationship("User", foreign_keys=[createdById])
    assignee = relationship("User", foreign_keys=[assignedUserId])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    userId = Column(Text, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(NotificationTypeEnum, nullable=False)
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    relatedEntity = Column(Text, nullable=True)
    relatedEntityId = Column(Text, nullable=True)
    read = Column(Boolean, nullable=False, server_default="false")
    readAt = Column(DateTime, nullable=True)
    # NOTE: the Prisma model has no @updatedAt here, so there is no updatedAt column.
    createdAt = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", foreign_keys=[userId])


class Email(Base):
    __tablename__ = "emails"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    userId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    provider = Column(EmailProviderTypeEnum, nullable=False, server_default="MOCK")
    fromName = Column(Text, nullable=True)
    fromEmail = Column(Text, nullable=True)
    replyTo = Column(Text, nullable=True)
    to = Column(Text, nullable=False)
    cc = Column(Text, nullable=True)
    bcc = Column(Text, nullable=True)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    relatedLeadId = Column(Text, nullable=True)
    relatedContactId = Column(Text, nullable=True)
    relatedCompanyId = Column(Text, nullable=True)
    relatedDealId = Column(Text, nullable=True)
    status = Column(EmailStatusEnum, nullable=False, server_default="DRAFT")
    sentAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", foreign_keys=[userId])


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    userId = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    taskId = Column(Text, nullable=True)
    leadId = Column(Text, nullable=True)
    dealId = Column(Text, nullable=True)
    reminderAt = Column(DateTime, nullable=False)
    # "offset" is a reserved word in SQL, so the attribute is mapped explicitly.
    offset = Column("offset", ReminderOffsetEnum, nullable=False, server_default="MINUTES_15")
    targetType = Column(ReminderTargetTypeEnum, nullable=False, server_default="TASK")
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", foreign_keys=[userId])


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Text, primary_key=True, default=uuid_str)
    organizationId = Column(Text, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    createdById = Column(Text, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(Text, nullable=False)
    type = Column(AutomationRuleTypeEnum, nullable=False)
    enabled = Column(Boolean, nullable=False, server_default="true")
    config = Column(Text, nullable=True)
    createdAt = Column(DateTime, nullable=False, server_default=func.now())
    updatedAt = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    createdBy = relationship("User", foreign_keys=[createdById])
