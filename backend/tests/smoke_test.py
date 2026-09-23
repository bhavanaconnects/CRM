"""
End-to-end smoke test against a running FastAPI server + PostgreSQL.

Exercises every migrated module through real HTTP requests, including
multi-tenant isolation checks. Run with the API on http://localhost:8000:

    python tests/smoke_test.py
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

BASE = "http://localhost:8000"

PASSED, FAILED = [], []


def client():
    jar = CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(op, method, path, body=None, expect=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"} if body is not None else {},
    )
    try:
        with op.open(req) as res:
            status, payload = res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        status, payload = e.code, json.loads(e.read() or b"{}")
    return status, payload


def check(name, cond, detail=""):
    (PASSED if cond else FAILED).append(name)
    print(f"{'PASS' if cond else 'FAIL'}  {name}{'' if cond else '  -> ' + str(detail)[:300]}")


def main():
    admin = client()

    # ---------- Auth ----------
    s, p = call(admin, "POST", "/api/auth/login",
                {"email": "admin@example.com", "password": "DemoPass123!"})
    check("auth: login", s == 200 and p.get("success"), p)

    s, p = call(admin, "GET", "/api/auth/me")
    check("auth: me", s == 200 and p["data"]["email"] == "admin@example.com", p)
    org_users = call(admin, "GET", "/api/users")[1]["data"]
    owner_id = org_users[0]["id"]

    s, p = call(admin, "POST", "/api/auth/login",
                {"email": "admin@example.com", "password": "WrongPassword"})
    check("auth: bad password rejected", s == 401, p)

    # ---------- Dashboard ----------
    s, p = call(admin, "GET", "/api/dashboard")
    check("dashboard: loads", s == 200 and "kpis" in p["data"], p)
    check("dashboard: productivity block", "productivity" in p["data"], p)

    # ---------- Pipelines ----------
    s, p = call(admin, "GET", "/api/pipelines")
    check("pipelines: list", s == 200 and len(p["data"]) >= 1, p)
    pipeline = p["data"][0]
    stage_ids = [st["id"] for st in pipeline["stages"]]

    # ---------- Companies ----------
    s, p = call(admin, "POST", "/api/companies",
                {"name": "Smoke Test Co", "industry": "Software",
                 "website": "https://smoke.example", "phone": "9990001111"})
    check("companies: create", s == 201, p)
    company_id = p["data"]["id"]

    s, p = call(admin, "GET", f"/api/companies/{company_id}")
    check("companies: detail has counts+relations",
          s == 200 and "counts" in p["data"] and "contacts" in p["data"], p)

    s, p = call(admin, "GET", "/api/companies?search=Smoke")
    check("companies: search", s == 200 and p["data"]["total"] >= 1, p)

    s, p = call(admin, "GET", "/api/companies/duplicate-check?name=" + urllib.parse.quote("Smoke Test Co") + "")
    check("companies: duplicate-check", s == 200 and p["data"], p)

    s, p = call(admin, "PUT", f"/api/companies/{company_id}", {"industry": "Consulting"})
    check("companies: update", s == 200 and p["data"]["industry"] == "Consulting", p)

    s, p = call(admin, "POST", "/api/companies", {"name": "Bad URL Co", "website": "not-a-url"})
    check("companies: invalid URL rejected", s == 422, p)

    # ---------- Contacts ----------
    s, p = call(admin, "POST", "/api/contacts",
                {"firstName": "Smoke", "lastName": "Contact", "email": "smoke@example.com",
                 "phone": "9990002222", "companyId": company_id, "ownerId": owner_id,
                 "tags": ["test"]})
    check("contacts: create", s == 201, p)
    contact_id = p["data"]["id"]

    s, p = call(admin, "GET", f"/api/contacts/{contact_id}")
    check("contacts: detail has deals/tasks/activities/leads",
          s == 200 and all(k in p["data"] for k in ("deals", "tasks", "activities", "leads")), p)

    s, p = call(admin, "GET", "/api/contacts?search=Smoke&sortBy=name&sortDir=asc")
    check("contacts: search + sort", s == 200 and p["data"]["total"] >= 1, p)

    s, p = call(admin, "GET", "/api/contacts/duplicate-check?email=smoke@example.com")
    check("contacts: duplicate-check", s == 200 and p["data"], p)

    s, p = call(admin, "POST", "/api/contacts",
                {"firstName": "Bad", "lastName": "Phone", "phone": "abc"})
    check("contacts: invalid phone rejected", s == 422, p)

    s, p = call(admin, "POST", "/api/contacts",
                {"firstName": "Cross", "lastName": "Tenant",
                 "companyId": "00000000-0000-0000-0000-000000000000"})
    check("contacts: unknown companyId rejected", s == 400, p)

    # ---------- Deals ----------
    s, p = call(admin, "POST", "/api/deals",
                {"title": "Smoke Deal", "amount": 250000, "probability": 30,
                 "pipelineId": pipeline["id"], "stageId": stage_ids[0],
                 "companyId": company_id, "contactId": contact_id, "ownerId": owner_id})
    check("deals: create", s == 201, p)
    deal_id = p["data"]["id"]

    s, p = call(admin, "GET", "/api/deals/board")
    check("deals: kanban board", s == 200 and isinstance(p["data"], list), p)

    s, p = call(admin, "PUT", f"/api/deals/{deal_id}/stage", {"stageId": stage_ids[1]})
    check("deals: change stage (drag/drop)",
          s == 200 and p["data"]["stage"]["id"] == stage_ids[1], p)

    s, p = call(admin, "PUT", f"/api/deals/{deal_id}", {"status": "WON"})
    check("deals: mark won sets closedAt",
          s == 200 and p["data"]["status"] == "WON" and p["data"]["closedAt"], p)

    s, p = call(admin, "PUT", f"/api/deals/{deal_id}", {"status": "OPEN"})
    check("deals: reopen clears closedAt",
          s == 200 and p["data"]["closedAt"] is None, p)

    s, p = call(admin, "PUT", f"/api/deals/{deal_id}/stage",
                {"stageId": "00000000-0000-0000-0000-000000000000"})
    check("deals: stage outside pipeline rejected", s == 400, p)

    s, p = call(admin, "GET", f"/api/deals/{deal_id}")
    check("deals: detail has tasks/activities",
          s == 200 and "tasks" in p["data"] and "activities" in p["data"], p)

    # Deal won should have produced a notification for the owner
    s, p = call(admin, "GET", "/api/notifications")
    check("notifications: deal-won notification created",
          s == 200 and any(n["type"] == "DEAL_WON" for n in p["data"]["items"]), p)

    # ---------- Tasks ----------
    import datetime as _dt
    today = _dt.date.today().isoformat()
    yesterday = (_dt.date.today() - _dt.timedelta(days=1)).isoformat()
    next_week = (_dt.date.today() + _dt.timedelta(days=7)).isoformat()

    s, p = call(admin, "POST", "/api/tasks",
                {"title": "Smoke task", "description": "Created by the smoke test",
                 "dealId": deal_id, "contactId": contact_id, "companyId": company_id,
                 "priority": "HIGH", "assigneeId": owner_id, "dueDate": today})
    check("tasks: create", s == 201, p)
    task_id = p["data"]["id"]
    check("tasks: description persisted",
          p["data"].get("description") == "Created by the smoke test", p)
    check("tasks: related records returned",
          p["data"].get("deal") and p["data"].get("contact") and p["data"].get("company"), p)
    check("tasks: defaults to To Do", p["data"]["status"] == "PENDING", p)

    s, p = call(admin, "POST", "/api/tasks", {"title": "  "})
    check("tasks: blank title rejected", s == 422, s)

    s, p = call(admin, "POST", "/api/tasks",
                {"title": "Overdue smoke task", "dueDate": yesterday, "assigneeId": owner_id})
    overdue_task_id = p["data"]["id"] if s == 201 else None
    check("tasks: create overdue", s == 201, p)

    s, p = call(admin, "POST", "/api/tasks",
                {"title": "Upcoming smoke task", "dueDate": next_week,
                 "assigneeId": owner_id, "priority": "LOW"})
    upcoming_task_id = p["data"]["id"] if s == 201 else None
    check("tasks: create upcoming", s == 201, p)

    s, p = call(admin, "GET", "/api/tasks?page=1&pageSize=20")
    check("tasks: list", s == 200 and p["data"]["total"] >= 3, p)

    s, p = call(admin, "GET", "/api/tasks?search=Overdue%20smoke")
    check("tasks: search by title",
          s == 200 and any(t["id"] == overdue_task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?search=by%20the%20smoke%20test")
    check("tasks: search by description",
          s == 200 and any(t["id"] == task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?priority=HIGH")
    check("tasks: filter by priority",
          s == 200 and all(t["priority"] == "HIGH" for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/tasks?assigneeId={owner_id}")
    check("tasks: filter by assignee",
          s == 200 and all(t["assignee"] and t["assignee"]["id"] == owner_id
                           for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?status=PENDING")
    check("tasks: filter by status",
          s == 200 and all(t["status"] == "PENDING" for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?view=overdue")
    check("tasks: overdue view",
          s == 200 and any(t["id"] == overdue_task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?view=today")
    check("tasks: today view",
          s == 200 and any(t["id"] == task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/tasks?view=upcoming")
    check("tasks: upcoming view",
          s == 200 and any(t["id"] == upcoming_task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/tasks?dueFrom={next_week}&dueTo={next_week}")
    check("tasks: due-date range filter",
          s == 200 and [t["id"] for t in p["data"]["items"]] == [upcoming_task_id], p)

    s, p = call(admin, "GET", f"/api/tasks/{task_id}")
    check("tasks: detail", s == 200 and p["data"]["id"] == task_id, p)

    s, p = call(admin, "GET", "/api/tasks/stats")
    check("tasks: stats envelope",
          s == 200 and all(k in p["data"] for k in ("dueToday", "overdue", "open", "completed")), p)
    check("tasks: stats count overdue", p["data"]["overdue"] >= 1, p)
    check("tasks: stats count due today", p["data"]["dueToday"] >= 1, p)

    s, p = call(admin, "GET", "/api/tasks/my-work")
    check("tasks: my-work buckets",
          s == 200 and all(k in p["data"] for k in
                           ("today", "upcoming", "overdue", "recentlyCompleted", "stats")), p)
    check("tasks: my-work is user-scoped",
          all(t["assignee"] and t["assignee"]["id"] == owner_id
              for t in p["data"]["today"] + p["data"]["upcoming"] + p["data"]["overdue"]), p)

    s, p = call(admin, "PUT", f"/api/tasks/{task_id}",
                {"title": "Smoke task (edited)", "priority": "URGENT", "description": "Edited"})
    check("tasks: edit", s == 200 and p["data"]["title"] == "Smoke task (edited)"
          and p["data"]["priority"] == "URGENT" and p["data"]["description"] == "Edited", p)

    s, p = call(admin, "PATCH", f"/api/tasks/{task_id}/complete", {"completed": True})
    check("tasks: complete", s == 200 and p["data"]["status"] == "COMPLETED"
          and p["data"]["completedAt"], p)

    s, p = call(admin, "GET", "/api/tasks?view=completed")
    check("tasks: completed view",
          s == 200 and any(t["id"] == task_id for t in p["data"]["items"]), p)

    s, p = call(admin, "PATCH", f"/api/tasks/{task_id}/complete", {"completed": False})
    check("tasks: reopen", s == 200 and p["data"]["status"] == "PENDING"
          and p["data"]["completedAt"] is None, p)

    s, p = call(admin, "PUT", f"/api/tasks/{task_id}", {"status": "COMPLETED"})
    check("tasks: complete via status update",
          s == 200 and p["data"]["status"] == "COMPLETED" and p["data"]["completedAt"], p)

    s, p = call(admin, "POST", "/api/tasks",
                {"title": "Bad relation", "assigneeId": "does-not-exist"})
    check("tasks: unknown assignee rejected", s == 400, s)

    s, p = call(admin, "GET", "/api/tasks/does-not-exist")
    check("tasks: unknown id is 404", s == 404 and p.get("success") is False, p)

    for tid in (overdue_task_id, upcoming_task_id):
        if tid:
            s, p = call(admin, "DELETE", f"/api/tasks/{tid}")
            check("tasks: delete", s == 200 and p["data"]["deleted"] is True, p)

    s, p = call(admin, "GET", f"/api/tasks/{overdue_task_id}")
    check("tasks: deleted task is gone", s == 404, s)

    s, p = call(admin, "GET", "/api/dashboard")
    check("dashboard: task stats included",
          s == 200 and all(k in p["data"].get("taskStats", {})
                           for k in ("dueToday", "overdue", "open", "completed")), p)

    # ---------- Activities ----------
    # This section runs before the Leads regression block, so it creates the
    # lead and the second-org client it needs.
    s, p = call(admin, "POST", "/api/leads",
                {"firstName": "Activity", "lastName": "Lead"})
    lead_id = p["data"]["id"] if s == 201 else None
    check("activities: setup lead created", s == 201, p)

    other_act = client()
    s, p = call(other_act, "POST", "/api/auth/login",
                {"email": "other@example.com", "password": "DemoPass123!"})
    check("activities: second org logs in", s == 200, p)

    act_today = _dt.date.today().isoformat()
    act_past = (_dt.date.today() - _dt.timedelta(days=3)).isoformat()
    act_future = (_dt.date.today() + _dt.timedelta(days=5)).isoformat()

    # Backwards compatibility: the old minimal payload (no subject) still works.
    s, p = call(admin, "POST", "/api/activities",
                {"type": "CALL", "notes": "Smoke call", "dealId": deal_id})
    check("activities: create (legacy payload, no subject)", s == 201, p)
    legacy_activity_id = p["data"]["id"] if s == 201 else None
    check("activities: subject derived when omitted",
          p["data"].get("subject") == "Call", p)

    s, p = call(admin, "POST", "/api/activities",
                {"type": "MEETING", "subject": "Smoke discovery meeting",
                 "notes": "Walked through requirements", "status": "COMPLETED",
                 "durationMinutes": 45, "occurredAt": f"{act_past}T10:30:00",
                 "leadId": lead_id, "userId": owner_id})
    check("activities: create with all fields", s == 201, p)
    activity_id = p["data"]["id"] if s == 201 else None
    check("activities: duration stored", p["data"].get("durationMinutes") == 45, p)
    check("activities: assigned user stored",
          p["data"].get("user") and p["data"]["user"]["id"] == owner_id, p)
    check("activities: related lead returned",
          p["data"].get("lead") and p["data"]["lead"]["id"] == lead_id, p)

    s, p = call(admin, "POST", "/api/activities",
                {"type": "NOTE", "subject": "Smoke note", "notes": "Just a note",
                 "durationMinutes": 30, "contactId": contact_id,
                 "occurredAt": f"{act_today}T08:00:00"})
    note_activity_id = p["data"]["id"] if s == 201 else None
    check("activities: duration dropped for non-timed types",
          s == 201 and p["data"]["durationMinutes"] is None, p)

    s, p = call(admin, "POST", "/api/activities",
                {"type": "MEETING", "subject": "Smoke planned meeting",
                 "notes": "Upcoming demo", "status": "PLANNED",
                 "occurredAt": f"{act_future}T11:00:00", "companyId": company_id,
                 "userId": owner_id})
    planned_activity_id = p["data"]["id"] if s == 201 else None
    check("activities: create planned", s == 201, p)

    s, p = call(admin, "POST", "/api/activities", {"type": "CALL", "notes": "   "})
    check("activities: blank notes rejected", s == 422, s)

    s, p = call(admin, "POST", "/api/activities",
                {"type": "CALL", "notes": "bad link", "leadId": "does-not-exist"})
    check("activities: unknown lead rejected", s == 400, s)

    s, p = call(admin, "GET", "/api/activities?page=1&pageSize=10")
    check("activities: list", s == 200 and p["data"]["total"] >= 4, p)

    s, p = call(admin, "GET", f"/api/activities/{activity_id}")
    check("activities: detail", s == 200 and p["data"]["id"] == activity_id, p)

    s, p = call(admin, "GET", "/api/activities/does-not-exist")
    check("activities: unknown id is 404", s == 404 and p.get("success") is False, p)

    s, p = call(admin, "GET", "/api/activities?search=discovery")
    check("activities: search by subject",
          s == 200 and any(a["id"] == activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/activities?search=Walked%20through")
    check("activities: search by notes",
          s == 200 and any(a["id"] == activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/activities?type=MEETING")
    check("activities: filter by type",
          s == 200 and all(a["type"] == "MEETING" for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/activities?status=PLANNED")
    check("activities: filter by status",
          s == 200 and all(a["status"] == "PLANNED" for a in p["data"]["items"])
          and any(a["id"] == planned_activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/activities?userId={owner_id}")
    check("activities: filter by assigned user",
          s == 200 and all(a["user"] and a["user"]["id"] == owner_id
                           for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/activities?dateFrom={act_past}&dateTo={act_past}")
    check("activities: filter by date range",
          s == 200 and [a["id"] for a in p["data"]["items"]] == [activity_id], p)

    # CRM integration: related-record filtering is what the Lead/Contact/
    # Company/Deal pages rely on.
    s, p = call(admin, "GET", f"/api/activities?leadId={lead_id}")
    check("activities: filter by related lead",
          s == 200 and all(a["lead"] and a["lead"]["id"] == lead_id
                           for a in p["data"]["items"])
          and any(a["id"] == activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/activities?contactId={contact_id}")
    check("activities: filter by related contact",
          s == 200 and any(a["id"] == note_activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/activities?companyId={company_id}")
    check("activities: filter by related company",
          s == 200 and any(a["id"] == planned_activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/activities?dealId={deal_id}")
    check("activities: filter by related deal",
          s == 200 and any(a["id"] == legacy_activity_id for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/leads/{lead_id}")
    check("activities: appear on the lead detail payload",
          s == 200 and any(a["id"] == activity_id for a in p["data"]["activities"]), p)
    check("activities: lead payload carries subject/status",
          s == 200 and all("subject" in a and "status" in a for a in p["data"]["activities"]), p)

    s, p = call(admin, "GET", "/api/activities/upcoming?limit=10")
    check("activities: upcoming list",
          s == 200 and any(a["id"] == planned_activity_id for a in p["data"]["items"])
          and all(a["status"] == "PLANNED" for a in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/activities/upcoming?mine=true&limit=10")
    check("activities: upcoming scoped to me", s == 200, p)

    s, p = call(admin, "PUT", f"/api/activities/{activity_id}",
                {"subject": "Smoke discovery meeting (edited)",
                 "notes": "Edited notes", "durationMinutes": 60, "status": "COMPLETED"})
    check("activities: edit",
          s == 200 and p["data"]["subject"] == "Smoke discovery meeting (edited)"
          and p["data"]["notes"] == "Edited notes"
          and p["data"]["durationMinutes"] == 60, p)

    s, p = call(admin, "PUT", f"/api/activities/{activity_id}", {"status": "CANCELLED"})
    check("activities: partial update keeps other fields",
          s == 200 and p["data"]["status"] == "CANCELLED"
          and p["data"]["subject"] == "Smoke discovery meeting (edited)", p)

    s, p = call(admin, "GET", "/api/dashboard")
    check("dashboard: recent activities include subject",
          s == 200 and all("subject" in a for a in p["data"]["recentActivities"]), p)
    check("dashboard: upcoming activities included",
          s == 200 and "upcomingActivities" in p["data"], p)

    # Database persistence: a brand-new session must read the row back.
    fresh_act = client()
    call(fresh_act, "POST", "/api/auth/login",
         {"email": "admin@example.com", "password": "DemoPass123!"})
    s, p = call(fresh_act, "GET", f"/api/activities/{activity_id}")
    check("activities: persisted in the database across sessions",
          s == 200 and p["data"]["subject"] == "Smoke discovery meeting (edited)", p)

    # Cross-org isolation.
    for method, path, body in (
        ("GET", f"/api/activities/{activity_id}", None),
        ("PUT", f"/api/activities/{activity_id}", {"subject": "hijacked"}),
        ("DELETE", f"/api/activities/{activity_id}", None),
    ):
        s, p = call(other_act, method, path, body)
        check(f"isolation: other org cannot {method} our activity", s == 404, s)

    # Unauthenticated access.
    anon_act = client()
    for method, path, body in (
        ("GET", "/api/activities", None),
        ("POST", "/api/activities", {"type": "CALL", "notes": "x"}),
        ("GET", "/api/activities/upcoming", None),
        ("GET", f"/api/activities/{activity_id}", None),
        ("DELETE", f"/api/activities/{activity_id}", None),
    ):
        s, p = call(anon_act, method, path, body)
        check(f"auth: unauthenticated {method} {path} blocked", s == 401, s)

    for aid in (note_activity_id, planned_activity_id, legacy_activity_id, activity_id):
        if aid:
            s, p = call(admin, "DELETE", f"/api/activities/{aid}")
            check("activities: delete", s == 200 and p["data"]["deleted"] is True, p)

    s, p = call(admin, "GET", f"/api/activities/{activity_id}")
    check("activities: deleted activity is gone", s == 404, s)

    if lead_id:
        call(admin, "DELETE", f"/api/leads/{lead_id}")

    # ---------- Calendar ----------
    s, p = call(admin, "POST", "/api/calendar",
                {"title": "Smoke meeting", "startAt": "2026-10-01T10:00:00Z",
                 "endAt": "2026-10-01T11:00:00Z", "eventType": "MEETING",
                 "relatedDealId": deal_id, "assignedUserId": owner_id})
    check("calendar: create event", s == 201, p)
    event_id = p["data"]["id"]

    s, p = call(admin, "GET", "/api/calendar?start=2026-09-01T00:00:00Z&end=2026-11-01T00:00:00Z")
    check("calendar: list in range", s == 200 and len(p["data"]) >= 1, p)

    s, p = call(admin, "PUT", f"/api/calendar/{event_id}", {"status": "CONFIRMED"})
    check("calendar: update", s == 200 and p["data"]["status"] == "CONFIRMED", p)

    s, p = call(admin, "POST", "/api/calendar",
                {"title": "Bad deal link", "startAt": "2026-10-01T10:00:00Z",
                 "relatedDealId": "00000000-0000-0000-0000-000000000000"})
    check("calendar: unknown dealId rejected", s == 400, p)

    s, p = call(admin, "DELETE", f"/api/calendar/{event_id}")
    check("calendar: delete", s == 200, p)

    # ---------- Email ----------
    s, p = call(admin, "POST", "/api/email/send",
                {"to": "someone@example.com", "subject": "Smoke subject",
                 "body": "Hello from the smoke test", "relatedDealId": deal_id})
    check("email: send (mock provider)", s == 201 and p["data"]["status"] == "SENT", p)
    email_id = p["data"]["id"]

    s, p = call(admin, "GET", f"/api/email/{email_id}")
    check("email: get by id", s == 200, p)

    s, p = call(admin, "GET", "/api/email")
    check("email: list", s == 200 and len(p["data"]) >= 1, p)

    s, p = call(admin, "GET", "/api/activities?page=1&pageSize=50")
    check("email: send logged an EMAIL activity",
          any(a["type"] == "EMAIL" for a in p["data"]["items"]), p)

    # ---------- Reminders ----------
    s, p = call(admin, "POST", "/api/reminders",
                {"reminderAt": "2026-10-05T09:00:00Z", "taskId": task_id,
                 "offset": "MINUTES_30", "targetType": "TASK"})
    check("reminders: create", s == 201, p)

    s, p = call(admin, "GET", "/api/reminders")
    check("reminders: list", s == 200 and len(p["data"]) >= 1, p)

    # ---------- Automation / My Work ----------
    s, p = call(admin, "GET", "/api/automation")
    check("automation: my-work summary + rules",
          s == 200 and all(k in p["data"] for k in
                           ("openTasks", "upcomingMeetings", "pendingFollowUps", "rules")), p)

    # ---------- Notifications ----------
    s, p = call(admin, "PATCH", "/api/notifications/read-all")
    check("notifications: mark all read", s == 200, p)
    s, p = call(admin, "GET", "/api/notifications")
    check("notifications: unread count now 0", p["data"]["unreadCount"] == 0, p)

    # ---------- Global search ----------
    s, p = call(admin, "GET", "/api/search?q=Smoke")
    check("search: finds across entities",
          s == 200 and (p["data"]["companies"] or p["data"]["contacts"] or p["data"]["deals"]), p)
    s, p = call(admin, "GET", "/api/search?q=")
    check("search: empty query returns empty groups",
          s == 200 and p["data"]["leads"] == [], p)

    # ---------- Leads (regression from phase 1) ----------
    s, p = call(admin, "POST", "/api/leads",
                {"firstName": "Smoke", "lastName": "Lead", "estimatedValue": 1000})
    check("leads: create", s == 201, p)
    lead_id = p["data"]["id"]
    s, p = call(admin, "POST", f"/api/leads/{lead_id}/convert",
                {"company": {"mode": "new"}, "contact": {"mode": "new"},
                 "deal": {"create": True, "title": "Converted deal", "amount": 1000}})
    check("leads: convert creates contact+deal",
          s == 200 and p["data"]["contactId"] and p["data"]["dealId"], p)
    s, p = call(admin, "POST", f"/api/leads/{lead_id}/convert", {})
    check("leads: double-convert rejected", s == 409, p)

    # ---------- Multi-tenant isolation ----------
    other = client()
    s, p = call(other, "POST", "/api/auth/login",
                {"email": "other@example.com", "password": "DemoPass123!"})
    check("isolation: second org logs in", s == 200, p)

    for label, path in [
        ("contact", f"/api/contacts/{contact_id}"),
        ("company", f"/api/companies/{company_id}"),
        ("deal", f"/api/deals/{deal_id}"),
        ("lead", f"/api/leads/{lead_id}"),
    ]:
        s, p = call(other, "GET", path)
        check(f"isolation: other org cannot read {label} (404)", s == 404, s)

    s, p = call(other, "GET", "/api/deals")
    check("isolation: other org sees 0 deals", p["data"]["total"] == 0, p)
    s, p = call(other, "GET", "/api/search?q=Smoke")
    check("isolation: other org search returns nothing",
          all(not v for v in p["data"].values()), p)
    s, p = call(other, "PUT", f"/api/deals/{deal_id}/stage", {"stageId": stage_ids[0]})
    check("isolation: other org cannot move our deal", s == 404, s)
    s, p = call(other, "GET", f"/api/tasks/{task_id}")
    check("isolation: other org cannot read our task", s == 404, s)
    s, p = call(other, "PUT", f"/api/tasks/{task_id}", {"title": "hijacked"})
    check("isolation: other org cannot edit our task", s == 404, s)
    s, p = call(other, "PATCH", f"/api/tasks/{task_id}/complete", {"completed": True})
    check("isolation: other org cannot complete our task", s == 404, s)
    s, p = call(other, "DELETE", f"/api/tasks/{task_id}")
    check("isolation: other org cannot delete our task", s == 404, s)
    s, p = call(other, "GET", "/api/tasks")
    check("isolation: other org task list excludes ours",
          s == 200 and all(t["id"] != task_id for t in p["data"]["items"]), p)

    # ---------- Unauthenticated ----------
    anon = client()
    s, p = call(anon, "GET", "/api/dashboard")
    check("auth: unauthenticated dashboard blocked", s == 401, s)
    s, p = call(anon, "GET", "/api/deals")
    check("auth: unauthenticated deals blocked", s == 401, s)
    for path, method in (("/api/tasks", "GET"), ("/api/tasks", "POST"),
                         ("/api/tasks/stats", "GET"), ("/api/tasks/my-work", "GET"),
                         (f"/api/tasks/{task_id}", "GET"), (f"/api/tasks/{task_id}", "DELETE")):
        s, p = call(anon, method, path, {"title": "x"} if method == "POST" else None)
        check(f"auth: unauthenticated {method} {path} blocked", s == 401, s)


    # ---------- Work module ----------
    work_today = _dt.date.today().isoformat()
    work_future = (_dt.date.today() + _dt.timedelta(days=10)).isoformat()

    s, p = call(admin, "POST", "/api/work",
                {"title": "Smoke work item", "description": "Created by the smoke test",
                 "type": "MEETING", "priority": "HIGH", "status": "OPEN",
                 "dueDate": work_today, "assigneeId": owner_id,
                 "leadId": lead_id, "contactId": contact_id,
                 "companyId": company_id, "dealId": deal_id})
    check("work: create", s == 201, p)
    work_id = p["data"]["id"] if s == 201 else None
    check("work: related records returned",
          s == 201 and p["data"].get("lead") and p["data"].get("contact")
          and p["data"].get("company") and p["data"].get("deal"), p)
    check("work: defaults respected", p["data"]["status"] == "OPEN", p)

    s, p = call(admin, "POST", "/api/work", {"title": "  "})
    check("work: blank title rejected", s == 422, s)

    s, p = call(admin, "POST", "/api/work",
                {"title": "Bad relation", "assigneeId": "does-not-exist"})
    check("work: unknown assignee rejected", s == 400, s)

    s, p = call(admin, "POST", "/api/work",
                {"title": "Smoke future work", "type": "CALL", "priority": "LOW",
                 "status": "IN_PROGRESS", "dueDate": work_future, "assigneeId": owner_id})
    future_work_id = p["data"]["id"] if s == 201 else None
    check("work: create second item", s == 201, p)

    s, p = call(admin, "GET", "/api/work?page=1&pageSize=20")
    check("work: list", s == 200 and p["data"]["total"] >= 2, p)

    s, p = call(admin, "GET", "/api/work?search=Smoke%20work%20item")
    check("work: search by title",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/work?search=by%20the%20smoke%20test")
    check("work: search by description",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/work?status=IN_PROGRESS")
    check("work: filter by status",
          s == 200 and all(w["status"] == "IN_PROGRESS" for w in p["data"]["items"])
          and any(w["id"] == future_work_id for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/work?priority=HIGH")
    check("work: filter by priority",
          s == 200 and all(w["priority"] == "HIGH" for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/work?type=MEETING")
    check("work: filter by type",
          s == 200 and all(w["type"] == "MEETING" for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/work?assigneeId={owner_id}")
    check("work: filter by assigned user",
          s == 200 and all(w["assignee"] and w["assignee"]["id"] == owner_id
                           for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", f"/api/work?dueFrom={work_today}&dueTo={work_today}")
    check("work: filter by due date range",
          s == 200 and [w["id"] for w in p["data"]["items"]] == [work_id], p)

    s, p = call(admin, "GET", f"/api/work?leadId={lead_id}")
    check("work: filter by related lead",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)
    s, p = call(admin, "GET", f"/api/work?contactId={contact_id}")
    check("work: filter by related contact",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)
    s, p = call(admin, "GET", f"/api/work?companyId={company_id}")
    check("work: filter by related company",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)
    s, p = call(admin, "GET", f"/api/work?dealId={deal_id}")
    check("work: filter by related deal",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)

    s, p = call(admin, "GET", "/api/work?sortBy=title&sortDir=asc")
    check("work: sort by title", s == 200, p)

    s, p = call(admin, "GET", f"/api/work/{work_id}")
    check("work: detail", s == 200 and p["data"]["id"] == work_id, p)

    s, p = call(admin, "GET", "/api/work/does-not-exist")
    check("work: unknown id is 404", s == 404 and p.get("success") is False, p)

    s, p = call(admin, "PUT", f"/api/work/{work_id}",
                {"title": "Smoke work item (edited)", "status": "COMPLETED",
                 "priority": "URGENT", "description": "Edited"})
    check("work: edit",
          s == 200 and p["data"]["title"] == "Smoke work item (edited)"
          and p["data"]["status"] == "COMPLETED"
          and p["data"]["priority"] == "URGENT"
          and p["data"]["description"] == "Edited", p)

    s, p = call(admin, "GET", "/api/work?status=COMPLETED")
    check("work: filter reflects edit",
          s == 200 and any(w["id"] == work_id for w in p["data"]["items"]), p)

    # Database persistence: a brand-new session must read the row back.
    fresh_work = client()
    call(fresh_work, "POST", "/api/auth/login",
         {"email": "admin@example.com", "password": "DemoPass123!"})
    s, p = call(fresh_work, "GET", f"/api/work/{work_id}")
    check("work: persisted in the database across sessions",
          s == 200 and p["data"]["title"] == "Smoke work item (edited)", p)

    # Cross-org isolation.
    for method, path, body in (
        ("GET", f"/api/work/{work_id}", None),
        ("PUT", f"/api/work/{work_id}", {"title": "hijacked"}),
        ("DELETE", f"/api/work/{work_id}", None),
    ):
        s, p = call(other, method, path, body)
        check(f"isolation: other org cannot {method} our work item", s == 404, s)
    s, p = call(other, "GET", "/api/work")
    check("isolation: other org work list excludes ours",
          s == 200 and all(w["id"] != work_id for w in p["data"]["items"]), p)

    # Unauthenticated access.
    anon_work = client()
    for method, path, body in (
        ("GET", "/api/work", None),
        ("POST", "/api/work", {"title": "x"}),
        ("GET", f"/api/work/{work_id}", None),
        ("PUT", f"/api/work/{work_id}", {"title": "x"}),
        ("DELETE", f"/api/work/{work_id}", None),
    ):
        s, p = call(anon_work, method, path, body)
        check(f"auth: unauthenticated {method} {path} blocked", s == 401, s)

    for wid in (work_id, future_work_id):
        if wid:
            s, p = call(admin, "DELETE", f"/api/work/{wid}")
            check("work: delete", s == 200 and p["data"]["deleted"] is True, p)

    s, p = call(admin, "GET", f"/api/work/{work_id}")
    check("work: deleted item is gone", s == 404, s)

    # ---------- Database persistence ----------
    # Re-login on a brand-new client: the row must come back from PostgreSQL,
    # not from any in-process state.
    fresh = client()
    call(fresh, "POST", "/api/auth/login",
         {"email": "admin@example.com", "password": "DemoPass123!"})
    s, p = call(fresh, "GET", f"/api/tasks/{task_id}")
    check("tasks: persisted in the database across sessions",
          s == 200 and p["data"]["title"] == "Smoke task (edited)", p)

    # ---------- Cleanup of created rows ----------
    call(admin, "DELETE", f"/api/tasks/{task_id}")
    call(admin, "DELETE", f"/api/deals/{deal_id}")
    call(admin, "DELETE", f"/api/contacts/{contact_id}")
    call(admin, "DELETE", f"/api/companies/{company_id}")

    # ---------- Logout ----------
    s, p = call(admin, "POST", "/api/auth/logout")
    check("auth: logout", s == 200, p)
    s, p = call(admin, "GET", "/api/auth/me")
    check("auth: session cleared after logout", s == 401, s)

    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    if FAILED:
        print("Failed:", ", ".join(FAILED))
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
