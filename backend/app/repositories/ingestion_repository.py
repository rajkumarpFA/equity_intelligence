"""Repository for ingestion audit, data sources, documents, financial statements, and facts."""

import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.ingestion.normalizer import STANDARD_FINANCIAL_METRICS
from app.models.financials import FinancialFact, FinancialMetric, FinancialStatement
from app.models.ingestion import (
    DataSource,
    IngestionJob,
    RejectedRecord,
    SourceDocument,
)
from app.models.market_data import PriceHistory
from app.providers.interfaces.models import ProviderCandle

logger = logging.getLogger(__name__)


class IngestionRepository:
    """Database persistence and query handler for ingestion operations."""

    def __init__(self, db: Session):
        self.db = db

    def seed_financial_metrics(self) -> int:
        """Seed standard financial metric definitions into financial_metrics table."""
        count = 0
        for item in STANDARD_FINANCIAL_METRICS:
            stmt = select(FinancialMetric).where(FinancialMetric.code == item["code"])
            existing = self.db.scalars(stmt).first()
            if not existing:
                metric = FinancialMetric(
                    code=item["code"],
                    name=item["name"],
                    category=item["category"],
                    is_banking_specific=item["is_banking_specific"],
                    description=item.get("description"),
                    normal_balance=item.get("normal_balance", "CREDIT"),
                )
                self.db.add(metric)
                count += 1
        if count > 0:
            self.db.commit()
            logger.info("Seeded %d standard financial metrics", count)
        return count

    def seed_default_data_sources(self) -> int:
        """Seed default data source definitions into data_sources table."""
        sources = [
            ("YAHOO_FINANCE", "API", "https://query1.finance.yahoo.com", "Free active historical EOD candles provider"),
            ("UPSTOX", "API", "https://api.upstox.com/v2", "Optional Upstox Market Data and 1-Year Analytics provider"),
            ("NSE", "EXCHANGE_FILING", "https://www.nseindia.com", "National Stock Exchange of India regulatory disclosures"),
            ("BSE", "EXCHANGE_FILING", "https://www.bseindia.com", "Bombay Stock Exchange corporate announcements"),
            ("MANUAL_UPLOAD", "MANUAL_UPLOAD", None, "User-uploaded CSV or bhavcopy datasets"),
            ("ANNUAL_REPORT", "MANUAL_UPLOAD", None, "Uploaded corporate annual reports and investor PDFs"),
        ]
        count = 0
        for name, src_type, url, desc_text in sources:
            stmt = select(DataSource).where(DataSource.name == name)
            if not self.db.scalars(stmt).first():
                self.db.add(
                    DataSource(
                        name=name,
                        source_type=src_type,
                        base_url=url,
                        description=desc_text,
                        is_active=True,
                    )
                )
                count += 1
        if count > 0:
            self.db.commit()
            logger.info("Seeded %d default data sources", count)
        return count

    def get_data_source_by_name(self, name: str) -> DataSource | None:
        stmt = select(DataSource).where(DataSource.name == name.upper())
        return self.db.scalars(stmt).first()

    def get_metric_by_code(self, code: str) -> FinancialMetric | None:
        stmt = select(FinancialMetric).where(FinancialMetric.code == code.upper())
        return self.db.scalars(stmt).first()

    def get_source_document_by_hash(self, sha256_hash: str) -> SourceDocument | None:
        stmt = select(SourceDocument).where(SourceDocument.sha256_hash == sha256_hash)
        return self.db.scalars(stmt).first()

    def get_source_document_by_id(self, doc_id: int) -> SourceDocument | None:
        stmt = select(SourceDocument).where(SourceDocument.id == doc_id)
        return self.db.scalars(stmt).first()

    def list_source_documents(
        self,
        company_id: int | None = None,
        fiscal_year: int | None = None,
        document_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[int, list[dict[str, Any]]]:
        """List source documents with company metadata."""
        from sqlalchemy import func

        from app.models.company import Company, Security

        stmt = select(SourceDocument)
        if company_id is not None:
            stmt = stmt.where(SourceDocument.company_id == company_id)
        if fiscal_year is not None:
            stmt = stmt.where(SourceDocument.fiscal_year == fiscal_year)
        if document_type is not None:
            stmt = stmt.where(SourceDocument.document_type == document_type)

        total_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(total_stmt) or 0

        stmt = stmt.order_by(desc(SourceDocument.upload_timestamp)).limit(limit).offset(offset)
        docs = list(self.db.scalars(stmt).all())

        items: list[dict[str, Any]] = []
        company_cache: dict[int, tuple[str, str | None]] = {}

        for doc in docs:
            c_name = None
            c_symbol = None
            if doc.company_id:
                if doc.company_id not in company_cache:
                    comp = self.db.get(Company, doc.company_id)
                    if comp:
                        # find primary security or first security
                        sec_stmt = select(Security).where(Security.company_id == comp.id)
                        secs = list(self.db.scalars(sec_stmt).all())
                        primary_sec = next((s for s in secs if s.is_primary), secs[0] if secs else None)
                        company_cache[doc.company_id] = (comp.name, primary_sec.symbol if primary_sec else None)
                    else:
                        company_cache[doc.company_id] = (None, None)
                c_name, c_symbol = company_cache[doc.company_id]

            items.append({
                "id": doc.id,
                "sha256_hash": doc.sha256_hash,
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "file_size_bytes": doc.file_size_bytes,
                "mime_type": doc.mime_type,
                "document_type": doc.document_type,
                "company_id": doc.company_id,
                "company_name": c_name,
                "company_symbol": c_symbol,
                "fiscal_year": doc.fiscal_year,
                "fiscal_period": doc.fiscal_period,
                "upload_timestamp": doc.upload_timestamp,
                "is_duplicate": False,
            })

        return total, items

    def create_source_document(
        self,
        sha256_hash: str,
        file_name: str,
        file_path: str,
        file_size_bytes: int,
        mime_type: str,
        document_type: str,
        company_id: int | None = None,
        fiscal_year: int | None = None,
        fiscal_period: str | None = None,
        meta_info: dict[str, Any] | None = None,
    ) -> SourceDocument:
        doc = SourceDocument(
            sha256_hash=sha256_hash,
            file_name=file_name,
            file_path=file_path,
            file_size_bytes=file_size_bytes,
            mime_type=mime_type,
            document_type=document_type,
            company_id=company_id,
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period,
            meta_info=meta_info,
            upload_timestamp=datetime.now(UTC),
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def upsert_financial_statement(
        self,
        company_id: int,
        statement_type: str,
        reporting_basis: str,
        period_type: str,
        period_end: date,
        fiscal_year: int,
        fiscal_quarter: int | None = None,
        period_start: date | None = None,
        publication_date: date | None = None,
        is_audited: bool = True,
        is_restated: bool = False,
        version: int = 1,
    ) -> tuple[FinancialStatement, bool]:
        """Get existing or create new financial statement container."""
        stmt = select(FinancialStatement).where(
            FinancialStatement.company_id == company_id,
            FinancialStatement.statement_type == statement_type,
            FinancialStatement.reporting_basis == reporting_basis,
            FinancialStatement.period_type == period_type,
            FinancialStatement.period_end == period_end,
            FinancialStatement.version == version,
        )
        existing = self.db.scalars(stmt).first()
        if existing:
            # Update mutable metadata if changed
            existing.is_audited = is_audited
            existing.publication_date = publication_date or existing.publication_date
            return existing, False

        statement = FinancialStatement(
            company_id=company_id,
            statement_type=statement_type,
            reporting_basis=reporting_basis,
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            fiscal_year=fiscal_year,
            fiscal_quarter=fiscal_quarter,
            publication_date=publication_date,
            is_audited=is_audited,
            is_restated=is_restated,
            version=version,
        )
        self.db.add(statement)
        self.db.flush()
        return statement, True

    def upsert_financial_fact(
        self,
        statement_id: int,
        metric_id: int,
        value: Decimal,
        raw_value: str | None = None,
        currency: str = "INR",
        unit: str = "CRORES",
        source_id: int | None = None,
        source_document_id: int | None = None,
        source_page: int | None = None,
        extraction_method: str = "API",
        validation_status: str = "UNVERIFIED",
    ) -> tuple[FinancialFact, bool]:
        """Upsert atomic financial fact line item."""
        stmt = select(FinancialFact).where(
            FinancialFact.statement_id == statement_id,
            FinancialFact.metric_id == metric_id,
        )
        fact = self.db.scalars(stmt).first()
        if fact:
            # Update existing fact
            fact.value = value
            fact.raw_value = raw_value
            fact.currency = currency
            fact.unit = unit
            fact.source_id = source_id or fact.source_id
            fact.source_document_id = source_document_id or fact.source_document_id
            fact.source_page = source_page or fact.source_page
            fact.extraction_method = extraction_method
            fact.validation_status = validation_status
            fact.extraction_timestamp = datetime.now(UTC)
            return fact, False

        fact = FinancialFact(
            statement_id=statement_id,
            metric_id=metric_id,
            value=value,
            raw_value=raw_value,
            currency=currency,
            unit=unit,
            source_id=source_id,
            source_document_id=source_document_id,
            source_page=source_page,
            extraction_method=extraction_method,
            validation_status=validation_status,
            extraction_timestamp=datetime.now(UTC),
        )
        self.db.add(fact)
        self.db.flush()
        return fact, True

    def upsert_price_candles(
        self,
        security_id: int,
        candles: Sequence[ProviderCandle],
        source_id: int | None = None,
    ) -> tuple[int, int]:
        """Upsert a sequence of historical OHLCV candles, returning (inserted_count, updated_count)."""
        inserted = 0
        updated = 0

        for candle in candles:
            stmt = select(PriceHistory).where(
                PriceHistory.security_id == security_id,
                PriceHistory.trade_date == candle.trade_date,
            )
            existing = self.db.scalars(stmt).first()
            if existing:
                # Update if values changed
                if (
                    existing.close != candle.close
                    or existing.volume != candle.volume
                    or existing.high != candle.high
                    or existing.low != candle.low
                ):
                    existing.open = candle.open
                    existing.high = candle.high
                    existing.low = candle.low
                    existing.close = candle.close
                    existing.volume = candle.volume
                    existing.adj_close = candle.adj_close
                    existing.source_id = source_id or existing.source_id
                    updated += 1
            else:
                new_price = PriceHistory(
                    security_id=security_id,
                    trade_date=candle.trade_date,
                    open=candle.open,
                    high=candle.high,
                    low=candle.low,
                    close=candle.close,
                    volume=candle.volume,
                    adj_close=candle.adj_close,
                    source_id=source_id,
                )
                self.db.add(new_price)
                inserted += 1

        self.db.flush()
        return inserted, updated

    def list_jobs(
        self,
        skip: int = 0,
        limit: int = 50,
        status: str | None = None,
        job_type: str | None = None,
    ) -> tuple[list[IngestionJob], int]:
        """List past and running ingestion jobs with pagination."""
        query = select(IngestionJob)
        if status:
            query = query.where(IngestionJob.status == status.upper())
        if job_type:
            query = query.where(IngestionJob.job_type == job_type.upper())

        # Get total count
        count_stmt = select(IngestionJob.id)
        if status:
            count_stmt = count_stmt.where(IngestionJob.status == status.upper())
        if job_type:
            count_stmt = count_stmt.where(IngestionJob.job_type == job_type.upper())
        total = len(self.db.scalars(count_stmt).all())

        stmt = query.order_by(desc(IngestionJob.created_at)).offset(skip).limit(limit)
        items = list(self.db.scalars(stmt).all())
        return items, total

    def get_job_by_id(self, job_id: int) -> IngestionJob | None:
        stmt = select(IngestionJob).where(IngestionJob.id == job_id)
        return self.db.scalars(stmt).first()

    def list_rejected_records(
        self,
        skip: int = 0,
        limit: int = 50,
        review_status: str | None = None,
        job_id: int | None = None,
    ) -> tuple[list[RejectedRecord], int]:
        """List rejected/quarantined records with pagination."""
        query = select(RejectedRecord)
        if review_status:
            query = query.where(RejectedRecord.review_status == review_status.upper())
        if job_id:
            query = query.where(RejectedRecord.ingestion_job_id == job_id)

        count_stmt = select(RejectedRecord.id)
        if review_status:
            count_stmt = count_stmt.where(RejectedRecord.review_status == review_status.upper())
        if job_id:
            count_stmt = count_stmt.where(RejectedRecord.ingestion_job_id == job_id)
        total = len(self.db.scalars(count_stmt).all())

        stmt = query.order_by(desc(RejectedRecord.created_at)).offset(skip).limit(limit)
        items = list(self.db.scalars(stmt).all())
        return items, total
