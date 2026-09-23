"""
Plain dict serializers that match the exact JSON shape the Next.js API
returned (see src/types/lead.ts LeadSummary/LeadDetail), so the existing
frontend contract doesn't change under the frontend rewrite.
"""
from datetime import date, datetime
from decimal import Decimal


def iso(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def num(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


def user_ref(user):
    if not user:
        return None
    return {"id": user.id, "name": user.name}


def company_ref(company):
    if not company:
        return None
    return {"id": company.id, "name": company.name}


def contact_ref(contact):
    if not contact:
        return None
    return {"id": contact.id, "firstName": contact.firstName, "lastName": contact.lastName}


def lead_summary(lead):
    return {
        "id": lead.id,
        "firstName": lead.firstName,
        "lastName": lead.lastName,
        "email": lead.email,
        "phone": lead.phone,
        "companyName": lead.companyName,
        "jobTitle": lead.jobTitle,
        "source": lead.source,
        "status": lead.status,
        "priority": lead.priority,
        "estimatedValue": num(lead.estimatedValue),
        "expectedCloseDate": iso(lead.expectedCloseDate),
        "tags": lead.tags or [],
        "notes": lead.notes,
        "convertedAt": iso(lead.convertedAt),
        "createdAt": iso(lead.createdAt),
        "updatedAt": iso(lead.updatedAt),
        "owner": user_ref(lead.owner),
        "createdBy": user_ref(lead.createdBy),
        "company": company_ref(lead.company),
        "contact": contact_ref(lead.contact),
    }


def task_ref(task):
    return {
        "id": task.id, "title": task.title, "status": task.status,
        "priority": task.priority, "dueDate": iso(task.dueDate),
    }


def activity_subject(activity):
    """Rows created before the Activities module had no subject; fall back to
    the type label so timelines never render an empty heading."""
    if activity.subject:
        return activity.subject
    return (activity.type or "ACTIVITY").replace("_", " ").title()


def activity_ref(activity):
    return {
        "id": activity.id, "type": activity.type, "notes": activity.notes,
        "subject": activity_subject(activity), "status": activity.status,
        "durationMinutes": activity.durationMinutes,
        "occurredAt": iso(activity.occurredAt),
    }


def lead_detail(lead):
    data = lead_summary(lead)
    data["deal"] = (
        {"id": lead.deal.id, "title": lead.deal.title, "status": lead.deal.status, "amount": num(lead.deal.amount)}
        if lead.deal else None
    )
    data["tasks"] = [task_ref(t) for t in sorted(lead.tasks, key=lambda t: t.dueDate or datetime.max)]
    data["activities"] = [activity_ref(a) for a in sorted(lead.activities, key=lambda a: a.occurredAt, reverse=True)]
    return data


def lead_ref(lead):
    if not lead:
        return None
    return {"id": lead.id, "firstName": lead.firstName, "lastName": lead.lastName, "status": lead.status}


def deal_ref(deal):
    if not deal:
        return None
    return {"id": deal.id, "title": deal.title, "status": deal.status, "amount": num(deal.amount)}


def task_summary(task):
    """Shape read by the Tasks list, the dashboard and My Work."""
    return {
        "id": task.id, "title": task.title, "description": task.description,
        "status": task.status, "priority": task.priority,
        "dueDate": iso(task.dueDate), "completedAt": iso(task.completedAt),
        "createdAt": iso(task.createdAt), "updatedAt": iso(task.updatedAt),
        "assignee": user_ref(task.assignee),
        "lead": lead_ref(task.lead),
        "contact": contact_ref(task.contact),
        "company": company_ref(task.company),
        "deal": deal_ref(task.deal),
    }


def task_detail(task):
    """Same as task_summary today -- kept separate so the detail page's
    contract can grow without changing the list contract."""
    return task_summary(task)


def activity_summary(activity):
    """Full shape read by the Activities timeline, detail page, dashboard and
    My Work. Every related record is included so the UI can link out."""
    return {
        "id": activity.id,
        "type": activity.type,
        "subject": activity_subject(activity),
        "notes": activity.notes,
        "status": activity.status,
        "durationMinutes": activity.durationMinutes,
        "occurredAt": iso(activity.occurredAt),
        "createdAt": iso(activity.createdAt),
        "updatedAt": iso(activity.updatedAt),
        "user": user_ref(activity.user),
        "lead": lead_ref(activity.lead),
        "contact": contact_ref(activity.contact),
        "company": company_ref(activity.company),
        "deal": deal_ref(activity.deal),
    }


def activity_detail(activity):
    """Same as activity_summary today -- kept separate so the detail page's
    contract can grow without changing the list contract."""
    return activity_summary(activity)


# =====================================================================
# Serializers for Contacts, Companies, Deals, Pipelines, Calendar,
# Notifications, Email, Reminders, Automation and global Search.
# Shapes match src/types/{contact,company,deal,pipeline}.ts so the
# frontend contract is unchanged.
# =====================================================================


def stage_ref(stage):
    if not stage:
        return None
    return {"id": stage.id, "name": stage.name, "order": stage.order}


def pipeline_ref(pipeline):
    if not pipeline:
        return None
    return {"id": pipeline.id, "name": pipeline.name}


def contact_summary(contact):
    return {
        "id": contact.id,
        "firstName": contact.firstName,
        "lastName": contact.lastName,
        "jobTitle": contact.jobTitle,
        "email": contact.email,
        "phone": contact.phone,
        "mobilePhone": contact.mobilePhone,
        "status": contact.status,
        "source": contact.source,
        "tags": contact.tags or [],
        "address": contact.address,
        "city": contact.city,
        "state": contact.state,
        "country": contact.country,
        "postalCode": contact.postalCode,
        "website": contact.website,
        "linkedinUrl": contact.linkedinUrl,
        "notes": contact.notes,
        "lastContactedAt": iso(contact.lastContactedAt),
        "createdAt": iso(contact.createdAt),
        "updatedAt": iso(contact.updatedAt),
        "owner": user_ref(contact.owner),
        "company": company_ref(contact.company),
    }


def deal_summary(deal):
    return {
        "id": deal.id,
        "title": deal.title,
        "amount": num(deal.amount),
        "probability": deal.probability,
        "status": deal.status,
        "expectedCloseDate": iso(deal.expectedCloseDate),
        "closedAt": iso(deal.closedAt),
        "createdAt": iso(deal.createdAt),
        "updatedAt": iso(deal.updatedAt),
        "owner": user_ref(deal.owner),
        "company": company_ref(deal.company),
        "contact": contact_ref(deal.contact),
        "pipeline": pipeline_ref(deal.pipeline),
        "stage": stage_ref(deal.stage),
    }


def deal_detail(deal):
    data = deal_summary(deal)
    data["tasks"] = [task_ref(t) for t in sorted(deal.tasks, key=lambda t: t.dueDate or datetime.max)]
    data["activities"] = [activity_ref(a) for a in sorted(deal.activities, key=lambda a: a.occurredAt, reverse=True)]
    return data


def contact_detail(contact, deals):
    data = contact_summary(contact)
    data["tasks"] = [task_ref(t) for t in sorted(contact.tasks, key=lambda t: t.dueDate or datetime.max)]
    data["activities"] = [activity_ref(a) for a in sorted(contact.activities, key=lambda a: a.occurredAt, reverse=True)]
    data["leads"] = [
        {"id": l.id, "firstName": l.firstName, "lastName": l.lastName, "status": l.status}
        for l in contact.leads
    ]
    data["deals"] = [
        {
            "id": d.id, "title": d.title, "amount": num(d.amount), "status": d.status,
            "expectedCloseDate": iso(d.expectedCloseDate),
            "stage": stage_ref(d.stage), "company": company_ref(d.company),
        }
        for d in deals
    ]
    return data


def company_summary(company, contacts_count, deals_count):
    return {
        "id": company.id,
        "name": company.name,
        "industry": company.industry,
        "website": company.website,
        "phone": company.phone,
        "createdAt": iso(company.createdAt),
        "updatedAt": iso(company.updatedAt),
        "owner": user_ref(company.owner),
        "counts": {"contacts": contacts_count, "deals": deals_count},
    }


def company_detail(company):
    data = company_summary(company, len(company.contacts), len(company.deals))
    data["contacts"] = [
        {
            "id": c.id, "firstName": c.firstName, "lastName": c.lastName,
            "jobTitle": c.jobTitle, "email": c.email, "phone": c.phone, "status": c.status,
        }
        for c in sorted(company.contacts, key=lambda c: c.createdAt, reverse=True)
    ]
    data["deals"] = [
        {
            "id": d.id, "title": d.title, "amount": num(d.amount), "status": d.status,
            "expectedCloseDate": iso(d.expectedCloseDate),
            "stage": stage_ref(d.stage), "contact": contact_ref(d.contact),
        }
        for d in sorted(company.deals, key=lambda d: d.createdAt, reverse=True)
    ]
    data["tasks"] = [task_ref(t) for t in sorted(company.tasks, key=lambda t: t.dueDate or datetime.max)]
    data["activities"] = [activity_ref(a) for a in sorted(company.activities, key=lambda a: a.occurredAt, reverse=True)]
    data["leads"] = [
        {"id": l.id, "firstName": l.firstName, "lastName": l.lastName, "status": l.status}
        for l in company.leads
    ]
    return data


def work_item_summary(work):
    """Shape read by the Work list and detail pages."""
    return {
        "id": work.id, "title": work.title, "description": work.description,
        "type": work.type, "priority": work.priority, "status": work.status,
        "dueDate": iso(work.dueDate),
        "createdAt": iso(work.createdAt), "updatedAt": iso(work.updatedAt),
        "assignee": user_ref(work.assignee),
        "lead": lead_ref(work.lead),
        "contact": contact_ref(work.contact),
        "company": company_ref(work.company),
        "deal": deal_ref(work.deal),
    }


def work_item_detail(work):
    """Same as work_item_summary today -- kept separate so the detail page's
    contract can grow without changing the list contract."""
    return work_item_summary(work)


def pipeline_with_stages(pipeline):
    return {
        "id": pipeline.id,
        "name": pipeline.name,
        "stages": [stage_ref(s) for s in sorted(pipeline.stages, key=lambda s: s.order)],
    }


def calendar_event(event):
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "startAt": iso(event.startAt),
        "endAt": iso(event.endAt),
        "allDay": event.allDay,
        "location": event.location,
        "eventType": event.eventType,
        "status": event.status,
        "reminderMinutes": event.reminderMinutes,
        "relatedLeadId": event.relatedLeadId,
        "relatedContactId": event.relatedContactId,
        "relatedCompanyId": event.relatedCompanyId,
        "relatedDealId": event.relatedDealId,
        "relatedTaskId": event.relatedTaskId,
        "createdAt": iso(event.createdAt),
        "updatedAt": iso(event.updatedAt),
        "creator": user_ref(event.creator),
        "assignee": user_ref(event.assignee),
        "user": user_ref(event.user),
    }


def notification(item):
    return {
        "id": item.id,
        "type": item.type,
        "title": item.title,
        "message": item.message,
        "relatedEntity": item.relatedEntity,
        "relatedEntityId": item.relatedEntityId,
        "read": item.read,
        "readAt": iso(item.readAt),
        "createdAt": iso(item.createdAt),
    }


def email_summary(email):
    return {
        "id": email.id,
        "provider": email.provider,
        "fromName": email.fromName,
        "fromEmail": email.fromEmail,
        "replyTo": email.replyTo,
        "to": email.to,
        "cc": email.cc,
        "bcc": email.bcc,
        "subject": email.subject,
        "body": email.body,
        "relatedLeadId": email.relatedLeadId,
        "relatedContactId": email.relatedContactId,
        "relatedCompanyId": email.relatedCompanyId,
        "relatedDealId": email.relatedDealId,
        "status": email.status,
        "sentAt": iso(email.sentAt),
        "createdAt": iso(email.createdAt),
    }


def reminder(item):
    return {
        "id": item.id,
        "taskId": item.taskId,
        "leadId": item.leadId,
        "dealId": item.dealId,
        "reminderAt": iso(item.reminderAt),
        "offset": item.offset,
        "targetType": item.targetType,
        "createdAt": iso(item.createdAt),
    }


def automation_rule(rule):
    return {
        "id": rule.id,
        "name": rule.name,
        "type": rule.type,
        "enabled": rule.enabled,
        "config": rule.config,
        "createdAt": iso(rule.createdAt),
    }


def search_results(results):
    """Matches the group/label/meta shape the header's search dropdown reads."""
    return {
        "leads": [
            {
                "id": l.id, "firstName": l.firstName, "lastName": l.lastName,
                "companyName": l.companyName, "status": l.status,
                "owner": {"name": l.owner.name} if l.owner else None,
            }
            for l in results["leads"]
        ],
        "contacts": [
            {
                "id": c.id, "firstName": c.firstName, "lastName": c.lastName,
                "jobTitle": c.jobTitle,
                "company": {"name": c.company.name} if c.company else None,
            }
            for c in results["contacts"]
        ],
        "companies": [
            {"id": c.id, "name": c.name, "industry": c.industry}
            for c in results["companies"]
        ],
        "deals": [
            {
                "id": d.id, "title": d.title, "amount": num(d.amount), "status": d.status,
                "company": {"name": d.company.name} if d.company else None,
            }
            for d in results["deals"]
        ],
        "tasks": [
            {
                "id": t.id, "title": t.title, "status": t.status,
                "assignee": {"name": t.assignee.name} if t.assignee else None,
            }
            for t in results["tasks"]
        ],
        "activities": [
            {
                "id": a.id, "notes": a.notes, "type": a.type,
                "subject": activity_subject(a),
                "lead": {"firstName": a.lead.firstName, "lastName": a.lead.lastName} if a.lead else None,
                "contact": {"firstName": a.contact.firstName, "lastName": a.contact.lastName} if a.contact else None,
                "company": {"name": a.company.name} if a.company else None,
                "user": {"name": a.user.name} if a.user else None,
            }
            for a in results["activities"]
        ],
    }
