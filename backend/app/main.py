"""FastAPI application entrypoint and middleware configuration."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import engine

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup initialization and graceful shutdown."""
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)
    try:
        settings.storage_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Storage directory verified: %s", settings.storage_dir)
    except OSError as exc:
        logger.warning("Could not verify storage directory %s: %s", settings.storage_dir, exc)

    yield

    logger.info("Shutting down %s gracefully...", settings.app_name)
    engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Personal Indian Stock Research & Investment Intelligence Platform API",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root():
    """Root metadata response."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
    }
