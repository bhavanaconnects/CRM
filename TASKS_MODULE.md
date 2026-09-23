# Tasks module

Implemented inside the existing CRM: same architecture (HTML + Tailwind
+ vanilla JS on the frontend, FastAPI + SQLAlchemy + PostgreSQL on the
backend), same API envelope, same design system, same auth. No new project,
no framework changes, no redesign.

The old `pages/tasks` placeholder ("Tasks module coming next") is gone.

---

## What already existed

The Tasks backend was **partly built** before this change:

* `Task` model in `app/models/core.py`
* `app/repositories/task_repository.py` with list/create/update only
* `GET`, `POST`, `PUT` on `/api/tasks`
* `TASK_STATUSES` / `TASK_PRIORITIES` and `taskStatusTone()` in
  `frontend/shared/format.js`

So this work **completed** that code rather than replacing it. The frontend
page was the only pure placeholder.

---

## Database

The `tasks` table was missing two things the module needs, so both were added:

| Column | Type | Why |
| --- | --- | --- |
| `description` | `TEXT` | Requirement 1/2. The original Prisma model had none, and the old repository explicitly dropped the field. |
| `completedAt` | `TIMESTAMP(3)` | Needed for "recently completed" in My Work, and to distinguish *when* a task was completed from `updatedAt`. |

Plus three indexes backing the list filters and the dashboard counters
(`organizationId` + `dueDate` / `status` / `assigneeId`).

**Safety and repeatability**

* `backend/db/migrations/20260918000000_tasks_description_completed_at.sql`
  uses `ADD COLUMN IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
* The one `UPDATE` is a backfill guarded by `WHERE "completedAt" IS NULL`, so
  it can never overwrite a real value.
* No `DROP`, no `TRUNCATE`, no column rewrites. Existing data is untouched.
* `app/bootstrap.py` runs the same statements at startup
  (`_apply_additive_migrations`), because `Base.metadata.create_all()` only
  creates *missing tables* — it never adds a column to a table that already
  exists. Running it repeatedly is a no-op.

---

## Backend

New: `app/services/task_service.py`, following the same shape as
`lead_service` / `contact_service` (thin router, guards in the service,
`NotFoundError` for missing rows).

`app/repositories/task_repository.py` was completed with single fetch, delete,
completion, filtering/search/sorting, stats and the My Work buckets.

### Endpoints

All require an authenticated session and are scoped to the caller's
organization. All use the existing `{success, data}` / `{success, error}`
envelope.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tasks` | filters, search, sort, pagination |
| `POST` | `/api/tasks` | |
| `GET` | `/api/tasks/stats` | `dueToday`, `overdue`, `open`, `completed`, `total`; `?mine=true` or `?assigneeId=` to scope |
| `GET` | `/api/tasks/my-work` | current user's `today`, `upcoming`, `overdue`, `noDueDate`, `recentlyCompleted`, `stats` |
| `GET` | `/api/tasks/{id}` | |
| `PUT` | `/api/tasks/{id}` | |
| `PATCH` | `/api/tasks/{id}/complete` | `{"completed": true/false}`, or empty body to toggle |
| `DELETE` | `/api/tasks/{id}` | |

The two static paths are declared **before** `/{task_id}` so the dynamic route
doesn't swallow them.

`GET /api/tasks` query params: `page`, `pageSize`, `status`, `priority`,
`assigneeId`, `search`, `view`, `dueFrom`, `dueTo`, `leadId`, `contactId`,
`companyId`, `dealId`, `sortBy`, `sortDir`.
`view` is one of `all | today | upcoming | overdue | completed`.

### Tenant guards

Every foreign key a caller can supply — assignee, lead, contact, company,
deal — is verified to belong to the caller's organization before the write.
`assert_lead_in_org()` was added to `app/services/guards.py` for this; the
other four guards already existed.

### Other backend touches

* `app/schemas/task.py` — `description` is now persisted; blank/whitespace
  titles are rejected; `TaskCompleteRequest` added.
* `app/schemas/serializers.py` — `task_summary` now carries description,
  timestamps, `completedAt` and the related lead/contact/company/deal refs;
  `task_detail` added. `task_ref` (used by the lead/contact/company/deal
  detail pages) is **unchanged**, so those pages keep working as-is.
* `app/routers/dashboard.py` + `dashboard_repository.py` — dashboard payload
  gained `taskStats`, which delegates to `task_repository.get_stats()` so the
  dashboard and the Tasks page can never disagree.
* `app/repositories/search_repository.py` — global search now matches task
  descriptions as well as titles.

### One design decision worth knowing

Due dates are captured with **day** granularity (a `<input type="date">`), so
a task is *overdue once its due day has passed* — not from 00:01 on the day
it's due. Defining overdue as `dueDate < now` would flip every task due today
into "overdue" a minute after midnight. Backend and frontend use the identical
rule, so the counters, the views and the row styling always agree.

Note this differs deliberately from the pre-existing
`dashboard.productivity.tasksOverdue` counter, which was left untouched.

---

## Frontend

| File | Change |
| --- | --- |
| `pages/tasks/tasks.js` | rewritten — the full list module |
| `pages/tasks/detail.html`, `task-detail.js` | new — task detail page |
| `pages/dashboard/dashboard.js` | Tasks stat card; today's tasks link to the detail page |
| `pages/my-work/my-work.js` | rewritten to use `/api/tasks/my-work` |
| `shared/format.js` | Tasks display helpers (additive) |
| `shared/layout.js` | global search task hits open the detail page |

Everything goes through the existing `api.get/post/put/patch/del` wrapper.
Nothing is hardcoded — the list, the filter dropdowns and the counters all
come from the API.

**Tasks list**: clickable stat cards (due today / overdue / open / completed),
view tabs (All, Today, Upcoming, Overdue, Completed), filters for status,
priority, assignee and a due-date range, title+description search, sortable
columns, a per-row complete checkbox, edit and delete, and pagination. Loading,
empty, and error states all use the shared `ui.js` chrome. `?view=overdue`
deep links work, which is how the dashboard and My Work cards navigate in.

**Create/edit modal**: title, description, status, priority, due date,
assigned user, and related lead / contact / company / deal. Required fields are
validated client-side before the request and server-side on the way in; server
errors render inside the modal.

**Delete**: a real confirmation dialog, not `window.confirm`.

**Status labels**: the database stores the Prisma enum value `PENDING`; the UI
renders it as **To Do**, per the spec. The enum was not renamed — that would
have meant an `ALTER TYPE` on live data for a cosmetic gain.

---

## Verifying it

```bash
docker compose up --build          # or run backend + frontend yourself
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Log in as `admin@example.com` / `DemoPass123!`, then open **Tasks**.

Then run the end-to-end smoke test against the running API:

```bash
cd backend
python tests/smoke_test.py
```

`tests/smoke_test.py` was extended with roughly 35 new assertions covering:
create, list, search by title and by description, every filter and every view,
detail, edit, complete, reopen, complete-via-status, delete, validation of
required fields, unknown-id 404s, rejected foreign keys, stats, my-work
bucketing and user scoping, dashboard task counts, cross-organization
isolation on every task route, unauthenticated access on every task route, and
persistence across a fresh login.

**These tests were written but not executed.** The environment this module was
built in had no PostgreSQL and no way to install FastAPI/SQLAlchemy, so
verification there was limited to static checks (Python compile of every
changed module, `node --check` on every changed script, route-ordering and
contract review). Run the smoke test on your machine before trusting the
module in anger.

---

## Not in scope

`Settings`, `Activities` and `Reports` still show their own
"module coming next" placeholders. Only the Tasks placeholder was removed, as
requested.
