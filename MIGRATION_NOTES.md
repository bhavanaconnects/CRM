# Migration notes — complete conversion

Next.js + React + TypeScript + Prisma  →  HTML + Tailwind + Vanilla JS +
FastAPI + SQLAlchemy + Pydantic, against the **existing PostgreSQL database**.

---

## Test results (all run in this environment against real PostgreSQL)

| Suite | Result |
|---|---|
| `backend/tests/smoke_test.py` — every API module, real HTTP | **61 / 61 passed** |
| `backend/tests/ui/run.js` — all pages in a real DOM (jsdom) | **17 / 17 passed, 0 JS errors** |
| `backend/tests/ui/interact.js` — modals, form submits, stage moves, search | **29 / 29 passed** |
| Model-vs-schema audit (all 16 tables) | every column present, all relationships resolve, no dangling FKs |
| Route parity audit vs original | **0 gaps** |
| CRUD coverage matrix vs original | **0 gaps** |
| Frontend→backend call audit (49 calls) | every call maps to a real route + method |
| Link audit | 0 broken links |
| `python -m compileall app` | clean |
| Server log after full run | 0 tracebacks |

The final verification rebuilt the database **from scratch** — the original
Prisma migrations, then this project's new migration — and ran everything
against that fresh database, not an incrementally-patched one.

The UI tests load each page in jsdom against the live API and assert on what
actually rendered — e.g. the dashboard showed real KPIs (`Pipeline Value
₹5,52,000`), the deals board rendered draggable cards in stage columns, and a
deal stage moved via the UI was confirmed changed in the database.

---

## Two findings that shaped this migration

### 1. Five tables were defined in Prisma but never migrated
`CalendarEvent`, `Notification`, `Email`, `Reminder` and `AutomationRule` exist in
`prisma/schema.prisma`, and the Next.js services call `prisma.calendarEvent`,
`prisma.notification` etc. — but **no migration in `prisma/migrations/` ever
created those tables**. Those five modules were broken at runtime in the original
app as well.

Fixed by a new additive migration:
`backend/db/migrations/20260917000000_calendar_notifications_email_reminders_automation.sql`

- Creates 5 tables, 8 enum types, 14 indexes, 12 foreign keys.
- **Purely additive**: no `DROP`, no `TRUNCATE`, no changes to existing tables or rows.
- Guarded with `IF NOT EXISTS` and `DO`-block exception handlers, so it is
  idempotent — verified by running it twice.

### 2. Four pages are placeholders in the source itself
`activities`, `reports`, `settings` and `tasks` are 13-line `EmptyState`
components in the original (`"This module hasn't been built yet"`). Migrating
them faithfully means keeping them as empty states — inventing functionality
would not be preserving existing behaviour.

**Their APIs are fully migrated and tested**, so filling these pages in later is
frontend-only work. Each file carries a comment saying exactly this.

---

## Gaps found during final verification and fixed

A systematic original-vs-migrated audit (route parity, page-by-page endpoint
usage, CRUD matrix) surfaced six real gaps. All are fixed:

1. **`/api/deals/{id}/stage` used the wrong HTTP method.** The original exports
   **PATCH**; the migration only accepted PUT. It now accepts both.
2. **Deal detail was missing the Follow-ups panel.** The original loads
   `/api/calendar?relatedDealId=<id>` and lets you schedule a call/meeting/
   follow-up against the deal. Panel and form added.
3. **My Work was missing the reminder-creation form.** The original can POST to
   `/api/reminders`; the migration only listed them. Form added.
4. **Companies list was missing per-row Edit and Delete buttons** present in the
   original's table. Added.
5. **Contacts bulk actions were missing "assign owner"** (the original supports
   delete / assignOwner / setStatus). Added.
6. **Leads bulk owner assignment used a `prompt()`** asking for a raw user ID —
   a stopgap, not what the original does. Replaced with an owner dropdown.

Additionally, the login page now reproduces `middleware.ts` behaviour: an
already-authenticated visitor is redirected to the dashboard.

## Bugs found and fixed during the migration

1. **Login cookie never set.** Returning a new `JSONResponse` discards the
   FastAPI-injected `Response` object's headers, so `set_cookie` was lost and
   every authenticated request 401'd. Fixed by setting the cookie on the object
   actually returned.
2. **`updatedAt` NOT NULL violation on every insert.** Prisma's `@updatedAt` is
   enforced by the Prisma *client*, not by a database default — the column has no
   `DEFAULT` in Postgres. All 16 models now manage it in Python
   (`default=`/`onupdate=`), and the four bulk-update queries set it explicitly,
   since Core-style bulk updates bypass ORM `onupdate`.
3. **`TaskUpdate` schema was incomplete**, causing a 500 on task completion. The
   source uses `createTaskSchema.partial()`; the schema now matches.
4. **Missing `email-validator`** dependency for Pydantic `EmailStr`.
5. **Unguarded Tailwind CDN config.** If the CDN was blocked, `tailwind.config = …`
   threw and killed every other script on the page. Now guarded — styling
   degrades, the app keeps working. (Caught because the CDN is blocked in the
   build sandbox.)

---

## Behaviour deliberately preserved

- **bcrypt hashes and the JWT `crm_session` cookie are unchanged** (same
  algorithm, same 7-day expiry, same `SESSION_SECRET` env var), so existing users
  log in with their existing passwords — no resets.
- **The `{success, data}` / `{success, error}` response envelope** from
  `src/lib/api-response.ts` is preserved on every endpoint.
- **Lead conversion** keeps the full transaction: dedup company by name, dedup
  contact by email/phone, create the deal on the default pipeline's first stage,
  log a NOTE activity, mark the lead `CONVERTED` — all or nothing.
- **Deal notifications** still fire on won / lost / stage-change, and still fail
  silently so they can never block a deal update.
- **Sending an email still writes an `EMAIL` Activity** linked to the related records.
- **`Task.description`** is accepted by the API and ignored, exactly as before —
  the zod schema accepted it but the table has no such column.
- **Multi-tenant isolation**: every query is scoped by `organizationId`, and every
  foreign key supplied by a caller is verified to belong to the caller's org
  (`app/services/guards.py`). Explicitly tested: a second organisation gets 404s
  on every entity, sees 0 rows in lists, gets nothing from global search, and
  cannot move another org's deal.

---

## Known limitations (honest list)

1. **Docker Compose was never executed** — there is no Docker daemon in the build
   environment. The compose/nginx/Dockerfiles are written and internally
   consistent, but `docker compose up --build` is unverified. Everything was
   tested by running uvicorn and a static server directly.
2. **Tested with jsdom, not a real browser.** jsdom executes the real JS against
   the real API and catches runtime errors, but it does not do layout. Visual
   fidelity (spacing, responsive breakpoints) and true HTML5 drag-and-drop were
   not verified. The drag handlers are wired and the underlying
   `PUT /api/deals/{id}/stage` is tested, including through the detail page's
   stage buttons — but dragging with a real mouse is untested.
3. **Tested against a database built from your migration files**, seeded with
   representative fixtures — not against your production data.
4. **Reports has no backing endpoint** because the source never had one. Every
   other placeholder page (tasks, activities, settings) does have migrated APIs.
5. **The pipeline API is read-only** (`GET /api/pipelines`), matching the source —
   there was no pipeline create/edit endpoint to migrate. Pipelines and stages are
   still managed via the database/seed.
6. **`GET /api/automation` returns the My Work summary**, which is what the source
   endpoint did. There is no automation *execution* engine in the source — the
   rules are stored and displayed, never evaluated. That is preserved as-is.
7. **There is no role-based permission enforcement — in the original either.**
   `roles` exists as a table and users have a `roleId`, but the original code
   never checks it (no role comparison, no 403 anywhere in `src/`). Authorization
   is *organisation-scoped only*. The migration matches this exactly. If you need
   Admin-vs-Sales-Rep restrictions, that is new functionality to design, not
   something lost in migration.
8. **The email provider is a mock in the original too** (`MockEmailProvider` in
   `src/services/email.service.ts`). Sending records a row with status `SENT` and
   logs an Activity, but no mail leaves the system. The `EmailProviderType` enum
   already has `SMTP`/`RESEND`/`SENDGRID` slots for a real provider.
9. **Some migrated endpoints have no UI caller**, mirroring the original's own
   gaps: `GET /api/activities`, `GET /api/email`, `GET /api/email/{id}`,
   `POST /api/notifications`, `GET /api/calendar/{id}`. The original had no
   Activities or Email page either. The endpoints work and are tested.
