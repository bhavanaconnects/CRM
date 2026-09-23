# CRM — HTML + CSS + Tailwind + Vanilla JS + FastAPI + PostgreSQL

## Quick start (the workflow you wanted)

Open **two VS Code terminals**.

### Terminal 1 — backend + database

From the project root:

```powershell
docker compose up -d --build
```

Check:

```powershell
docker compose ps
docker compose logs backend --tail 30
```

The backend is:

- http://localhost:8000
- Swagger: http://localhost:8000/docs

The backend automatically creates missing database tables/enums and seeds the local demo data.

### Terminal 2 — frontend

```powershell
cd frontend
npm install
npm run dev
```

You will get a normal Vite URL directly in the terminal:

```text
Local: http://localhost:5173/
```

Open that URL. It redirects to the CRM login page.

### Demo login

```text
Email:    admin@example.com
Password: DemoPass123!
```

A second test user is also seeded:

```text
Email:    other@example.com
Password: DemoPass123!
```

## Build

```powershell
cd frontend
npm run build
```

## Important fixes in this version

- Added the missing `frontend/package.json`, so `npm install` and `npm run dev` work.
- Added Vite development server on port 5173.
- Added Vite `/api` proxy to FastAPI on port 8000.
- Kept the HTML/CSS/Tailwind/Vanilla JS frontend.
- Fixed localhost session-cookie behavior by using development mode locally.
- Added database startup/bootstrap for a fresh `crm` database.
- Added all PostgreSQL enum types safely before creating missing tables.
- Added demo admin credentials.
- Added a default sales pipeline and stages so dashboard/deals can load.
- Added PostgreSQL healthcheck so backend waits for the database.
- Added CORS support for both Vite 5173 and Docker/Nginx 8080.
- Removed the obsolete Compose `version` field warning.

## If you want Docker frontend instead

The existing Docker/Nginx frontend remains available at:

```text
http://localhost:8080
```

But for the development workflow you requested, use:

```powershell
cd frontend
npm run dev
```

and use the URL printed by Vite.
