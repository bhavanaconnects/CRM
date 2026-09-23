"""
Database engine/session setup.

IMPORTANT: This does NOT call Base.metadata.create_all() against the
configured database, on purpose. Your existing PostgreSQL schema was
created by Prisma Migrate, and this backend is written to read/write
the SAME tables using the SAME column and table names (see
app/models/). Auto-creating tables here would risk diverging from the
Prisma-managed schema. Table creation/changes should continue to be
done via SQL migrations (see /backend/db/migrations), not by SQLAlchemy.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
