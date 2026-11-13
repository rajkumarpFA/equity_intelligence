"""Data ingestion, provenance, and integrity models."""

from datetime import UTC, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class DataSource(Base):
    """External data providers and ingestion sources (e.g., UPSTOX, YAHOO_FINANCE, NSE, BSE, MANUAL_UPLOAD)."""

    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # API, EXCHANGE_FILING, MANUAL_UPLOAD, SCRAPER
    base_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    jobs: Mapped[list["IngestionJob"]] = relationship("IngestionJob", back_populates="source")


class SourceDocument(Base):
    """Immutable audit copy of uploaded documents (annual reports, filings, CSVs) with SHA-256 integrity."""

    __tablename__ = "source_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sha256_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    document_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # ANNUAL_REPORT, QUARTERLY_REPORT, BHAVCOPY_CSV, FINANCIAL_STATEMENT_CSV
    fiscal_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fiscal_period: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Q1, Q2, Q3, Q4, FY

    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    upload_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    processed_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    meta_info: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class IngestionJob(Base):
    """Tracks state and metrics for every ingestion run, guaranteeing idempotency and auditability."""

    __tablename__ = "ingestion_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # INSTRUMENT_SYNC, PRICE_SYNC, FINANCIALS_SYNC, CSV_IMPORT, DOCUMENT_PARSE
    source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True
    )

    status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False, index=True
    )  # PENDING, RUNNING, COMPLETED, FAILED, PARTIAL_SUCCESS
    idempotency_key: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False, index=True
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    execution_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    source: Mapped["DataSource"] = relationship("DataSource", back_populates="jobs")
    rejected_records: Mapped[list["RejectedRecord"]] = relationship(
        "RejectedRecord", back_populates="job"
    )
    validation_results: Mapped[list["ValidationResult"]] = relationship(
        "ValidationResult", back_populates="job"
    )


class RejectedRecord(Base):
    """Quarantine for failed, conflicting, or malformed data to ensure zero silent data loss."""

    __tablename__ = "rejected_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingestion_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingestion_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True, index=True
    )

    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # SECURITY, PRICE, FINANCIAL_FACT, CORPORATE_ACTION, SHAREHOLDING
    rejection_reason: Mapped[str] = mapped_column(Text, nullable=False)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    review_status: Mapped[str] = mapped_column(
        String(20), default="UNRESOLVED", nullable=False
    )  # UNRESOLVED, DISMISSED, RESOLVED

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    job: Mapped[Optional["IngestionJob"]] = relationship(
        "IngestionJob", back_populates="rejected_records"
    )


class ValidationResult(Base):
    """Audit findings generated during data ingestion and Data Integrity Engine verification."""

    __tablename__ = "validation_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingestion_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingestion_jobs.id", ondelete="SET NULL"), nullable=True, index=True
    )

    rule_code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # e.g., BALANCE_SHEET_IDENTITY, OUTLIER_YOY, MISSING_MANDATORY_FIELD
    severity: Mapped[str] = mapped_column(
        String(20), default="WARNING", nullable=False
    )  # INFO, WARNING, ERROR, CRITICAL
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    job: Mapped[Optional["IngestionJob"]] = relationship(
        "IngestionJob", back_populates="validation_results"
    )
