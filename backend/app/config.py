"""
Environment configuration.

Mirrors the Next.js app's .env usage:
  DATABASE_URL     -> same Postgres connection string used by Prisma
  SESSION_SECRET   -> same JWT signing secret used to sign the crm_session cookie
                      (kept as the same env var name on purpose so existing
                      sessions/tooling that reference it aren't confused)
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://crm_user:crm_password@localhost:5432/crm"
    session_secret: str = "replace-with-a-long-random-string"
    session_cookie_name: str = "crm_session"
    session_duration_seconds: int = 60 * 60 * 24 * 7  # 7 days, matches src/lib/session.ts
    cors_origins: list[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5500",
    ]
    environment: str = "development"
    seed_demo_data: bool = True
    demo_email: str = "admin@example.com"
    demo_password: str = "DemoPass123!"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


settings = Settings()
