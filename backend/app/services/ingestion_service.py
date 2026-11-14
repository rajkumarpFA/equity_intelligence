"""Service orchestrating data ingestion, price sync, CSV parsing, and document upload."""

import hashlib
import io
import logging
import os
from datetime import UTC, date, datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.job_runner import IngestionJobRunner
from app.ingestion.normalizer import (
    determine_fiscal_period,
    normalize_metric_code,
    normalize_unit_and_value,
    parse_period_date,
)
from app.ingestion.rate_limiter import ProviderRateLimiterRegistry
from app.ingestion.retry import with_retry_sync
from app.models.company import Company, Security
from app.models.ingestion import IngestionJob, SourceDocument
from app.providers import get_active_price_provider, get_provider
from app.repositories.company_repository import CompanyRepository
from app.repositories.ingestion_repository import IngestionRepository

logger = logging.getLogger(__name__)
settings = get_settings()


class IngestionService:
    """Business logic for all ingestion pipelines, idempotency checks, and document processing."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = IngestionRepository(db)
        self.company_repo = CompanyRepository(db)

    def initialize_metadata(self) -> dict[str, int]:
        """Seed standard financial metrics catalog and default data sources."""
        metrics_seeded = self.repo.seed_financial_metrics()
        sources_seeded = self.repo.seed_default_data_sources()
        return {
            "metrics_seeded": metrics_seeded,
            "sources_seeded": sources_seeded,
        }

    def sync_eod_prices_for_security(
        self,
        security_id: int,
        days: int = 365,
        provider_name: str | None = None,
        allow_reexecution: bool = False,
    ) -> IngestionJob:
        """Fetch historical EOD candles for a security and upsert them idempotently."""
        # 1. Fetch security & company
        stmt = select(Security).where(Security.id == security_id)
        security = self.db.scalars(stmt).first()
        if not security:
            raise ValueError(f"Security with id {security_id} not found")

        provider = (
            get_provider(provider_name)
            if provider_name
            else get_active_price_provider()
        )
        source_name = provider.provider_name.upper()

        # Idempotency key scoped to security and current date
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        idempotency_key = f"PRICE_SYNC:{security.symbol}:{days}D:{today_str}"

        limiter = ProviderRateLimiterRegistry.get_limiter(provider.provider_name)

        with IngestionJobRunner(
            db=self.db,
            job_type="PRICE_SYNC",
            source_name=source_name,
            idempotency_key=idempotency_key,
            company_id=security.company_id,
            allow_reexecution=allow_reexecution,
        ) as runner:
            if runner.already_completed:
                return runner.job

            # Rate limit before making external request
            limiter.acquire_sync()

            # Execute fetch with retry
            @with_retry_sync(max_retries=3, initial_delay=0.5)
            def _fetch_candles():
                return provider.get_historical_candles(
                    symbol=security.symbol,
                    exchange=security.exchange.code if security.exchange else "NSE",
                    instrument_token=security.provider_instrument_key or security.symbol,
                    days=days,
                )

            candles = _fetch_candles()
            runner.inc_processed(len(candles))

            # Upsert into database
            inserted, updated = self.repo.upsert_price_candles(
                security_id=security.id,
                candles=candles,
                source_id=runner.source.id if runner.source else None,
            )
            runner.inc_inserted(inserted)
            runner.inc_updated(updated)
            runner.set_meta("candles_count", len(candles))
            runner.set_meta("days_requested", days)

            return runner.job

    def sync_all_benchmark_prices(self, days: int = 180) -> list[IngestionJob]:
        """Convenience method to sync prices across all primary securities."""
        primary_securities = self.db.scalars(
            select(Security).where(Security.is_primary == True, Security.is_active == True)
        ).all()
        jobs = []
        for sec in primary_securities:
            try:
                job = self.sync_eod_prices_for_security(sec.id, days=days, allow_reexecution=True)
                jobs.append(job)
            except Exception as e:  # noqa: BLE001
                logger.error("Failed to sync prices for %s: %s", sec.symbol, str(e))
        return jobs

    def ingest_statement_csv(
        self,
        file_content: bytes,
        filename: str,
        company_id: int,
        reporting_basis: str = "CONSOLIDATED",
        statement_type: str = "INCOME_STATEMENT",
        unit: str = "CRORES",
        currency: str = "INR",
        idempotency_key: str | None = None,
        allow_reexecution: bool = False,
    ) -> IngestionJob:
        """Parse, normalize, and ingest financial statement CSV with partial failure quarantine."""
        # Ensure company exists
        company = self.company_repo.get_by_id(company_id)
        if not company:
            raise ValueError(f"Company id {company_id} not found")

        # Compute checksum for idempotency
        file_hash = hashlib.sha256(file_content).hexdigest()
        key = idempotency_key or f"CSV_STMT:{company_id}:{statement_type}:{reporting_basis}:{file_hash[:16]}"

        with IngestionJobRunner(
            db=self.db,
            job_type="CSV_IMPORT",
            source_name="MANUAL_UPLOAD",
            idempotency_key=key,
            company_id=company_id,
            allow_reexecution=allow_reexecution,
        ) as runner:
            if runner.already_completed:
                return runner.job

            # Parse CSV
            try:
                df = pd.read_csv(io.BytesIO(file_content))
            except Exception as e:
                runner.record_rejection("CSV_IMPORT", f"Corrupt CSV format: {e!s}", {"filename": filename})
                raise ValueError(f"Failed to parse CSV: {e!s}") from e

            if df.empty:
                runner.record_rejection("CSV_IMPORT", "Uploaded CSV file is completely empty", {"filename": filename})
                return runner.job

            # Normalize column names
            df.columns = [str(c).strip() for c in df.columns]

            # We support two common CSV formats:
            # 1. Row-based (Metric, Period_End / Fiscal_Year, Value)
            # 2. Screener / BSE style tabular (Metric name in first column, period dates as subsequent columns)
            cols = [c.lower() for c in df.columns]

            if "metric" in cols and any(c in cols for c in ("value", "amount")):
                self._process_row_based_csv(df, runner, company, statement_type, reporting_basis, unit, currency)
            else:
                self._process_tabular_csv(df, runner, company, statement_type, reporting_basis, unit, currency)

            return runner.job

    def _process_row_based_csv(
        self,
        df: pd.DataFrame,
        runner: IngestionJobRunner,
        company: Company,
        statement_type: str,
        reporting_basis: str,
        default_unit: str,
        currency: str,
    ) -> None:
        """Process CSV where each row specifies (metric, period_end, value)."""
        metric_col = next(c for c in df.columns if c.lower() == "metric")
        value_col = next(c for c in df.columns if c.lower() in ("value", "amount"))
        date_col = next(
            (c for c in df.columns if c.lower() in ("period_end", "date", "period", "year")),
            None,
        )

        for _, row in df.iterrows():
            runner.inc_processed()
            raw_metric = str(row[metric_col]).strip()
            raw_val = row[value_col]

            # 1. Normalize metric code
            code = normalize_metric_code(raw_metric)
            if not code:
                runner.record_rejection(
                    "FINANCIAL_FACT",
                    f"Unrecognized metric label: '{raw_metric}'",
                    row.to_dict(),
                )
                continue

            metric = self.repo.get_metric_by_code(code)
            if not metric:
                # Seed on-the-fly if needed
                self.repo.seed_financial_metrics()
                metric = self.repo.get_metric_by_code(code)

            # 2. Determine period
            try:
                if date_col and pd.notna(row[date_col]):
                    period_end = parse_period_date(str(row[date_col]))
                else:
                    period_end = date(datetime.now(UTC).year, 3, 31)
                fy, fq, period_type = determine_fiscal_period(period_end)
            except Exception as e:  # noqa: BLE001
                runner.record_rejection(
                    "FINANCIAL_FACT",
                    f"Invalid date '{row.get(date_col)}': {e!s}",
                    row.to_dict(),
                )
                continue

            # 3. Normalize value & unit
            try:
                row_unit = str(row.get("unit", default_unit)).strip()
                norm_val, norm_unit = normalize_unit_and_value(raw_val, row_unit, code)
            except Exception as e:  # noqa: BLE001
                runner.record_rejection(
                    "FINANCIAL_FACT",
                    f"Failed to normalize value '{raw_val}': {e!s}",
                    row.to_dict(),
                )
                continue

            # 4. Upsert statement & fact
            statement, _is_new_stmt = self.repo.upsert_financial_statement(
                company_id=company.id,
                statement_type=statement_type,
                reporting_basis=reporting_basis,
                period_type=period_type,
                period_end=period_end,
                fiscal_year=fy,
                fiscal_quarter=fq,
            )

            _fact, is_new_fact = self.repo.upsert_financial_fact(
                statement_id=statement.id,
                metric_id=metric.id,
                value=norm_val,
                raw_value=str(raw_val),
                currency=currency,
                unit=norm_unit,
                source_id=runner.source.id if runner.source else None,
                extraction_method="CSV_IMPORT",
                validation_status="VERIFIED",
            )

            if is_new_fact:
                runner.inc_inserted()
            else:
                runner.inc_updated()

    def _process_tabular_csv(
        self,
        df: pd.DataFrame,
        runner: IngestionJobRunner,
        company: Company,
        statement_type: str,
        reporting_basis: str,
        default_unit: str,
        currency: str,
    ) -> None:
        """Process tabular CSV where first column is metric name, and subsequent columns are periods."""
        metric_col = df.columns[0]
        period_columns = df.columns[1:]

        for _, row in df.iterrows():
            raw_metric = str(row[metric_col]).strip()
            code = normalize_metric_code(raw_metric)
            if not code:
                runner.inc_processed()
                runner.record_rejection(
                    "FINANCIAL_FACT",
                    f"Unrecognized metric label: '{raw_metric}'",
                    {"row_metric": raw_metric},
                )
                continue

            metric = self.repo.get_metric_by_code(code)
            if not metric:
                self.repo.seed_financial_metrics()
                metric = self.repo.get_metric_by_code(code)

            for col in period_columns:
                runner.inc_processed()
                raw_val = row[col]
                if pd.isna(raw_val) or str(raw_val).strip() == "":
                    continue

                try:
                    period_end = parse_period_date(str(col))
                    fy, fq, period_type = determine_fiscal_period(period_end)
                except Exception as e:  # noqa: BLE001
                    runner.record_rejection(
                        "FINANCIAL_FACT",
                        f"Unparseable period column header '{col}': {e!s}",
                        {"column": str(col), "metric": raw_metric},
                    )
                    continue

                try:
                    norm_val, norm_unit = normalize_unit_and_value(raw_val, default_unit, code)
                except Exception as e:  # noqa: BLE001
                    runner.record_rejection(
                        "FINANCIAL_FACT",
                        f"Failed to normalize value '{raw_val}' for metric '{code}': {e!s}",
                        {"column": str(col), "value": str(raw_val)},
                    )
                    continue

                statement, _ = self.repo.upsert_financial_statement(
                    company_id=company.id,
                    statement_type=statement_type,
                    reporting_basis=reporting_basis,
                    period_type=period_type,
                    period_end=period_end,
                    fiscal_year=fy,
                    fiscal_quarter=fq,
                )

                _fact, is_new_fact = self.repo.upsert_financial_fact(
                    statement_id=statement.id,
                    metric_id=metric.id,
                    value=norm_val,
                    raw_value=str(raw_val),
                    currency=currency,
                    unit=norm_unit,
                    source_id=runner.source.id if runner.source else None,
                    extraction_method="CSV_IMPORT",
                    validation_status="VERIFIED",
                )

                if is_new_fact:
                    runner.inc_inserted()
                else:
                    runner.inc_updated()

    def upload_document(
        self,
        file_bytes: bytes,
        filename: str,
        mime_type: str,
        document_type: str,
        company_id: int | None = None,
        fiscal_year: int | None = None,
        fiscal_period: str | None = None,
    ) -> tuple[SourceDocument, bool]:
        """Validate, store, and record an audit source document with SHA-256 deduplication."""
        # 1. File size validation (max 50MB by default)
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise ValueError(
                f"File size ({len(file_bytes) / (1024*1024):.2f} MB) exceeds maximum allowed limit of {settings.max_upload_size_mb} MB"
            )

        # 2. File type validation
        allowed_extensions = {".pdf", ".csv", ".txt", ".json"}
        _, ext = os.path.splitext(filename.lower())

        if ext not in allowed_extensions:
            raise ValueError(f"Unsupported file type / extension '{ext}'. Allowed: PDF, CSV, TXT, JSON.")

        allowed_mimes = {
            "application/pdf",
            "text/csv",
            "text/plain",
            "application/json",
            "application/octet-stream",
        }
        if mime_type and mime_type not in allowed_mimes:
            raise ValueError(f"Unsupported MIME type '{mime_type}'.")

        # Magic bytes check for PDF
        if ext == ".pdf" and not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Corrupt or invalid PDF file header (missing '%PDF-').")

        # 3. Calculate SHA-256 hash
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # 4. Check for duplicate upload
        existing = self.repo.get_source_document_by_hash(sha256_hash)
        if existing:
            logger.info("Duplicate document detected: hash=%s (existing id=%d)", sha256_hash, existing.id)
            return existing, False

        # 5. Persist file safely to disk
        storage_dir = settings.effective_storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        safe_filename = f"{sha256_hash[:16]}_{os.path.basename(filename)}"
        target_path = os.path.join(storage_dir, safe_filename)

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        # 6. Record metadata in DB
        doc = self.repo.create_source_document(
            sha256_hash=sha256_hash,
            file_name=filename,
            file_path=target_path,
            file_size_bytes=len(file_bytes),
            mime_type=mime_type,
            document_type=document_type,
            company_id=company_id,
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
            meta_info={"storage_path": target_path, "extension": ext},
        )
        return doc, True
