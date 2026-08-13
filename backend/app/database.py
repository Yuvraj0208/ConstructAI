"""Database engine, session factory, and declarative base."""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# SQLite needs check_same_thread=False so the connection can be shared across
# FastAPI's threadpool. For other databases this argument is ignored.
is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Serverless Postgres (Neon, Supabase…) suspends idle compute, so a connection
# sitting in the pool is often dead by the next request. pool_pre_ping checks it
# first and reconnects transparently instead of raising; pool_recycle drops
# connections before the provider does.
pool_args = {} if is_sqlite else {"pool_pre_ping": True, "pool_recycle": 300}

engine = create_engine(settings.database_url, connect_args=connect_args, future=True, **pool_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
