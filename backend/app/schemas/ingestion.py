"""Pydantic schemas for data ingestion, background jobs, uploads, and provenance."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IngestionJobResponse(BaseModel):
    """Details and execution metrics of an ingestion job."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    source_id: int
    company_id: int | None = None
    status: str
    idempotency_key: str
    retry_count: int
    max_retries: int
    started_at: datetime | None = None
    completed_at: datetime | None = None
    records_processed: int
    records_inserted: int
    records_updated: int
    records_rejected: int
    error_message: str | None = None
    execution_metadata: dict[str, Any] | None = None
    created_at: datetime


class IngestionJobListResponse(BaseModel):
    """Paginated list of ingestion jobs."""

    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[IngestionJobResponse]


class TriggerPriceSyncRequest(BaseModel):
    """Payload to trigger on-demand price synchronization."""

    security_id: int = Field(..., description="Target security ID to sync candles for")
    days: int = Field(365, ge=1, le=3650, description="Historical lookback window in days")
    provider_name: str | None = Field(None, description="Optional provider override (e.g. yahoo_finance, upstox)")
    allow_reexecution: bool = Field(False, description="Whether to re-execute even if an idempotent job completed today")


class TriggerBenchmarkSyncRequest(BaseModel):
    """Payload to trigger price sync across all benchmark primary securities."""

    days: int = Field(180, ge=7, le=3650, description="Historical lookback window in days")


class RejectedRecordResponse(BaseModel):
    """Audit log entry for an unparseable, malformed, or rejected record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ingestion_job_id: int | None = None
    source_id: int | None = None
    entity_type: str
    rejection_reason: str
    raw_payload: dict[str, Any] | None = None
    review_status: str
    created_at: datetime


class RejectedRecordListResponse(BaseModel):
    """Paginated list of rejected records for manual review or reprocessing."""

    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[RejectedRecordResponse]


class SourceDocumentResponse(BaseModel):
    """Audit metadata for an uploaded annual report or dataset."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sha256_hash: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    document_type: str
    company_id: int | None = None
    fiscal_year: int | None = None
    fiscal_period: str | None = None
    upload_timestamp: datetime
    is_duplicate: bool = False


class ScheduledJobResponse(BaseModel):
    """Background scheduler task telemetry."""

    id: str
    name: str
    next_run_time: str | None = None
    trigger: str
