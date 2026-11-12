"""Health check endpoints verifying application and database readiness."""

from datetime import UTC, datetime

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from app.core.config import get_settings
from app.db.session import check_db_connectivity

router = APIRouter(prefix="/health", tags=["System Health"])
settings = get_settings()


class DatabaseHealth(BaseModel):
    connected: bool
    latency_ms: float | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    status: str
    app_name: str
    app_version: str
    app_env: str
    timestamp: datetime
    database: DatabaseHealth
    upstox_configured: bool


class PingResponse(BaseModel):
    status: str
    timestamp: datetime


@router.get("", response_model=HealthResponse)
def get_health(response: Response) -> HealthResponse:
    """Comprehensive readiness probe verifying database connectivity."""
    db_status = check_db_connectivity()
    is_healthy = db_status["connected"]

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="healthy" if is_healthy else "degraded",
        app_name=settings.app_name,
        app_version=settings.app_version,
        app_env=settings.app_env,
        timestamp=datetime.now(UTC),
        database=DatabaseHealth(**db_status),
        upstox_configured=settings.upstox_configured,
    )


@router.get("/ping", response_model=PingResponse)
def ping() -> PingResponse:
    """Lightweight liveness probe."""
    return PingResponse(
        status="ok",
        timestamp=datetime.now(UTC),
    )
