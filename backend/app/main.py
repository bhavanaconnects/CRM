from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    activities, auth, automation, calendar, companies, contacts, dashboard,
    deals, email, leads, notifications, pipelines, reminders, search, tasks, users, work,
)
from app.utils.errors import AppError, app_error_handler, unhandled_error_handler
from app.bootstrap import initialize_database

app = FastAPI(title="CRM API", version="1.0.0")

@app.on_event("startup")
def startup() -> None:
    initialize_database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # required: the frontend sends the crm_session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

for router in (
    auth.router,
    dashboard.router,
    leads.router,
    contacts.router,
    companies.router,
    deals.router,
    pipelines.router,
    tasks.router,
    activities.router,
    work.router,
    calendar.router,
    notifications.router,
    email.router,
    reminders.router,
    automation.router,
    search.router,
    users.router,
):
    app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
