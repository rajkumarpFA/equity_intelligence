"""SQLAlchemy engine, session factory, and database dependency."""

import time
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""


settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and guarantee cleanup on completion."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connectivity() -> dict:
    """Verify live database connectivity and measure ping roundtrip latency."""
    start_time = time.perf_counter()
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;")).scalar()
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            if result == 1:
                return {
                    "connected": True,
                    "latency_ms": latency_ms,
                    "error": None,
                }
            return {
                "connected": False,
                "latency_ms": latency_ms,
                "error": "Unexpected probe result",
            }
    except (SQLAlchemyError, OSError) as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "connected": False,
            "latency_ms": latency_ms,
            "error": f"{type(exc).__name__}: {exc!s}",
        }
