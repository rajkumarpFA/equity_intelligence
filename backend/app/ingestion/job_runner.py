"""Idempotent ingestion job runner and execution lifecycle manager."""

import logging
from datetime import UTC, datetime
from types import TracebackType
from typing import Any, Self

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ingestion import DataSource, IngestionJob, RejectedRecord

logger = logging.getLogger(__name__)


class IngestionJobError(Exception):
    """Base exception for ingestion pipeline errors."""


class ConcurrentJobExecutionError(IngestionJobError):
    """Raised when an ingestion job with the same idempotency key is already actively running."""


class DuplicateJobExecutionError(IngestionJobError):
    """Raised when an identical job has already completed and idempotency prohibits duplicate execution."""


class IngestionJobRunner:
    """Context manager for executing idempotent ingestion jobs with audit trails and metric counters."""

    def __init__(
        self,
        db: Session,
        job_type: str,
        source_name: str,
        idempotency_key: str,
        company_id: int | None = None,
        max_retries: int = 3,
        allow_reexecution: bool = False,
    ):
        self.db = db
        self.job_type = job_type
        self.source_name = source_name.upper()
        self.idempotency_key = idempotency_key
        self.company_id = company_id
        self.max_retries = max_retries
        self.allow_reexecution = allow_reexecution

        self.job: IngestionJob | None = None
        self.source: DataSource | None = None
        self.already_completed: bool = False

    def _ensure_source(self) -> DataSource:
        """Find or create data source record."""
        stmt = select(DataSource).where(DataSource.name == self.source_name)
        source = self.db.scalars(stmt).first()
        if not source:
            source = DataSource(
                name=self.source_name,
                source_type="API" if "API" in self.job_type else "MANUAL_UPLOAD",
                is_active=True,
                description=f"Auto-registered source {self.source_name}",
            )
            self.db.add(source)
            self.db.flush()
        return source

    def __enter__(self) -> Self:
        self.source = self._ensure_source()

        # Check existing job by idempotency key
        stmt = select(IngestionJob).where(IngestionJob.idempotency_key == self.idempotency_key)
        existing_job = self.db.scalars(stmt).first()

        if existing_job:
            if existing_job.status == "RUNNING":
                raise ConcurrentJobExecutionError(
                    f"Job '{self.idempotency_key}' is currently running (started at {existing_job.started_at})"
                )
            elif existing_job.status == "COMPLETED" and not self.allow_reexecution:
                logger.info(
                    "Job '%s' has already completed successfully. Skipping re-execution.",
                    self.idempotency_key,
                )
                self.already_completed = True
                self.job = existing_job
                return self
            else:
                # Existing failed or partial job being retried / re-executed
                self.job = existing_job
                self.job.retry_count += 1
                self.job.status = "RUNNING"
                self.job.started_at = datetime.now(UTC)
                self.job.completed_at = None
                self.job.error_message = None
                self.job.records_processed = 0
                self.job.records_inserted = 0
                self.job.records_updated = 0
                self.job.records_rejected = 0
        else:
            self.job = IngestionJob(
                job_type=self.job_type,
                source_id=self.source.id,
                company_id=self.company_id,
                status="RUNNING",
                idempotency_key=self.idempotency_key,
                retry_count=0,
                max_retries=self.max_retries,
                started_at=datetime.now(UTC),
                records_processed=0,
                records_inserted=0,
                records_updated=0,
                records_rejected=0,
                execution_metadata={},
            )
            self.db.add(self.job)

        self.db.commit()
        self.db.refresh(self.job)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> bool:
        if self.already_completed or not self.job:
            return False

        now = datetime.now(UTC)
        self.job.completed_at = now

        if exc_val is not None:
            # An unhandled exception occurred
            self.job.status = "FAILED"
            self.job.error_message = str(exc_val)
            self.db.commit()
            logger.error(
                "Ingestion job %d (%s) failed with exception: %s",
                self.job.id,
                self.idempotency_key,
                str(exc_val),
            )
            # Propagate exception
            return False

        # Evaluate final status based on records counters
        if self.job.records_rejected > 0:
            if self.job.records_inserted > 0 or self.job.records_updated > 0:
                self.job.status = "PARTIAL_SUCCESS"
            else:
                self.job.status = "FAILED"
                self.job.error_message = (
                    f"All {self.job.records_rejected} records were rejected."
                )
        else:
            self.job.status = "COMPLETED"

        self.db.commit()
        self.db.refresh(self.job)
        logger.info(
            "Ingestion job %d (%s) finished with status %s: %d processed, %d inserted, %d updated, %d rejected",
            self.job.id,
            self.idempotency_key,
            self.job.status,
            self.job.records_processed,
            self.job.records_inserted,
            self.job.records_updated,
            self.job.records_rejected,
        )
        return False

    def inc_processed(self, count: int = 1) -> None:
        if self.job:
            self.job.records_processed += count

    def inc_inserted(self, count: int = 1) -> None:
        if self.job:
            self.job.records_inserted += count

    def inc_updated(self, count: int = 1) -> None:
        if self.job:
            self.job.records_updated += count

    def record_rejection(
        self,
        entity_type: str,
        rejection_reason: str,
        raw_payload: dict[str, Any] | None = None,
    ) -> RejectedRecord:
        """Record malformed or conflicting raw data in rejected_records quarantine table."""
        if not self.job:
            raise IngestionJobError("Cannot record rejection outside active job context")

        self.job.records_rejected += 1
        record = RejectedRecord(
            ingestion_job_id=self.job.id,
            source_id=self.job.source_id,
            entity_type=entity_type,
            rejection_reason=rejection_reason,
            raw_payload=raw_payload,
            review_status="UNRESOLVED",
        )
        self.db.add(record)
        return record

    def set_meta(self, key: str, value: Any) -> None:
        """Store auxiliary diagnostic telemetry in job metadata."""
        if self.job:
            meta = dict(self.job.execution_metadata or {})
            meta[key] = value
            self.job.execution_metadata = meta
