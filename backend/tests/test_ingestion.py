"""Comprehensive test suite for Phase 5 Data Ingestion Pipeline & Normalization."""

import io
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import httpx
import pytest
from sqlalchemy import select

from app.ingestion.job_runner import (
    ConcurrentJobExecutionError,
    IngestionJobRunner,
)
from app.ingestion.normalizer import (
    determine_fiscal_period,
    normalize_metric_code,
    normalize_unit_and_value,
    parse_period_date,
)
from app.ingestion.rate_limiter import ProviderRateLimiterRegistry, RateLimiter
from app.ingestion.retry import compute_backoff_delay, with_retry_async, with_retry_sync
from app.models.company import Company, Exchange, Security
from app.models.financials import FinancialFact, FinancialStatement
from app.models.ingestion import IngestionJob, RejectedRecord
from app.models.market_data import PriceHistory
from app.providers.interfaces.models import ProviderCandle
from app.services.ingestion_service import IngestionService


# ---------------------------------------------------------
# 1. Rate Limiter Tests
# ---------------------------------------------------------
def test_rate_limiter_acquire():
    """Verify rate limiter allows initial burst and respects rate pacing."""
    limiter = RateLimiter(requests_per_second=20.0, burst_limit=2)
    # Burst allowed immediately
    assert limiter.acquire_sync(tokens=1.0, timeout=1.0) is True
    assert limiter.acquire_sync(tokens=1.0, timeout=1.0) is True

    # Provider registry lookup
    reg_limiter = ProviderRateLimiterRegistry.get_limiter("yahoo_finance")
    assert reg_limiter.rate == 2.0
    upstox_limiter = ProviderRateLimiterRegistry.get_limiter("upstox")
    assert upstox_limiter.rate == 5.0


# ---------------------------------------------------------
# 2. Retry with Exponential Backoff Tests
# ---------------------------------------------------------
def test_exponential_backoff_delay_calculation():
    """Verify backoff delays scale exponentially and respect maximum limits."""
    delay_0 = compute_backoff_delay(0, initial_delay=0.5, backoff_factor=2.0, jitter=False)
    delay_1 = compute_backoff_delay(1, initial_delay=0.5, backoff_factor=2.0, jitter=False)
    delay_2 = compute_backoff_delay(2, initial_delay=0.5, backoff_factor=2.0, jitter=False)

    assert delay_0 == 0.5
    assert delay_1 == 1.0
    assert delay_2 == 2.0

    max_delay = compute_backoff_delay(10, initial_delay=1.0, max_delay=10.0, jitter=False)
    assert max_delay == 10.0


def test_retry_sync_success_after_transient_failure():
    """Verify sync decorator retries on 429/503 and returns result on subsequent success."""
    attempts = 0

    @with_retry_sync(max_retries=3, initial_delay=0.01, jitter=False)
    def flaky_service():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            req = httpx.Request("GET", "https://api.test/data")
            resp = httpx.Response(status_code=429, request=req)
            raise httpx.HTTPStatusError("Rate limited", request=req, response=resp)
        return "success"

    result = flaky_service()
    assert result == "success"
    assert attempts == 3


def test_retry_sync_non_retryable_fails_immediately():
    """Verify non-retryable exceptions (like ValueError) do not trigger retries."""
    attempts = 0

    @with_retry_sync(max_retries=3, initial_delay=0.01)
    def broken_service():
        nonlocal attempts
        attempts += 1
        raise ValueError("Permanent invalid argument")

    with pytest.raises(ValueError, match="Permanent invalid argument"):
        broken_service()

    assert attempts == 1


@pytest.mark.asyncio
async def test_retry_async_transient_recovery():
    """Verify async decorator retries on connection error."""
    attempts = 0

    @with_retry_async(max_retries=2, initial_delay=0.01, jitter=False)
    async def async_fetch():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ConnectionError("Network blip")
        return 42

    result = await async_fetch()
    assert result == 42
    assert attempts == 2


# ---------------------------------------------------------
# 3. Normalization Tests
# ---------------------------------------------------------
def test_metric_code_normalization():
    """Verify diverse filing and CSV metric labels resolve to canonical codes."""
    assert normalize_metric_code("Revenue from operations") == "REVENUE"
    assert normalize_metric_code("Revenue from Operations (Net)") == "REVENUE"
    assert normalize_metric_code("Net Sales") == "REVENUE"
    assert normalize_metric_code("Profit After Tax") == "PAT"
    assert normalize_metric_code("Net Profit") == "PAT"
    assert normalize_metric_code("Profit for the period") == "PAT"
    assert normalize_metric_code("Operating Profit") == "EBITDA"
    assert normalize_metric_code("EBITDA") == "EBITDA"
    assert normalize_metric_code("Basic EPS") == "EPS"
    assert normalize_metric_code("Basic EPS (Rs.)") == "EPS"
    assert normalize_metric_code("Total Debt") == "TOTAL_DEBT"
    assert normalize_metric_code("Gross NPA %") == "NPA_GROSS_PCT"
    assert normalize_metric_code("CASA Ratio") == "CASA_RATIO"
    assert normalize_metric_code("Completely Bogus Line Item") is None


def test_unit_and_value_normalization():
    """Verify amount standardizations into Crores, Per-share, and Percentage."""
    # Crores unchanged
    val, unit = normalize_unit_and_value("1500.50", "CRORES", "REVENUE")
    assert val == Decimal("1500.50")
    assert unit == "CRORES"

    # Lakhs -> Crores (100 Lakhs = 1 Cr)
    val, unit = normalize_unit_and_value("25000", "LAKHS", "REVENUE")
    assert val == Decimal(250)
    assert unit == "CRORES"

    # Millions -> Crores (10 Mn = 1 Cr)
    val, unit = normalize_unit_and_value("100", "MILLIONS", "PAT")
    assert val == Decimal(10)
    assert unit == "CRORES"

    # Raw INR -> Crores (10,000,000 INR = 1 Cr)
    val, unit = normalize_unit_and_value("50000000", "INR", "TOTAL_ASSETS")
    assert val == Decimal(5)
    assert unit == "CRORES"

    # Bracketed negative numbers
    val, unit = normalize_unit_and_value("(123.45)", "CRORES", "PAT")
    assert val == Decimal("-123.45")
    assert unit == "CRORES"

    # Per share metric preserved in INR
    val, unit = normalize_unit_and_value("48.50", "INR", "EPS")
    assert val == Decimal("48.50")
    assert unit == "PER_SHARE"


def test_period_and_date_parsing():
    """Verify parsing of multiple date formats and fiscal year/quarter determination."""
    d1 = parse_period_date("2024-03-31")
    assert d1 == date(2024, 3, 31)

    d2 = parse_period_date("30-06-2023")
    assert d2 == date(2023, 6, 30)

    # Indian fiscal year: June 30, 2023 is Q1 of FY2024
    fy, fq, ptype = determine_fiscal_period(d2)
    assert fy == 2024
    assert fq == 1
    assert ptype == "QUARTERLY"

    # March 31, 2024 is Q4 / Annual of FY2024
    fy, fq, ptype = determine_fiscal_period(d1)
    assert fy == 2024
    assert fq == 4


# ---------------------------------------------------------
# 4. Ingestion Job Runner & Idempotency Tests
# ---------------------------------------------------------
def test_job_runner_lifecycle_and_idempotency(db_session):
    """Verify job execution transitions, metric counters, and duplicate prevention."""
    key = "TEST_JOB_KEY_001"

    # 1. Normal execution
    with IngestionJobRunner(
        db=db_session,
        job_type="PRICE_SYNC",
        source_name="YAHOO_FINANCE",
        idempotency_key=key,
    ) as runner:
        assert runner.job.status == "RUNNING"
        runner.inc_processed(10)
        runner.inc_inserted(8)
        runner.inc_updated(2)

    # Query completed job
    stmt = select(IngestionJob).where(IngestionJob.idempotency_key == key)
    job = db_session.scalars(stmt).first()
    assert job is not None
    assert job.status == "COMPLETED"
    assert job.records_processed == 10
    assert job.records_inserted == 8
    assert job.records_updated == 2

    # 2. Re-running with same key when COMPLETED skips re-execution
    with IngestionJobRunner(
        db=db_session,
        job_type="PRICE_SYNC",
        source_name="YAHOO_FINANCE",
        idempotency_key=key,
        allow_reexecution=False,
    ) as runner:
        assert runner.already_completed is True
        # Modifications in block should not change counters
        runner.inc_processed(5)

    # Reload from DB
    db_session.refresh(job)
    assert job.records_processed == 10  # Unchanged


def test_job_runner_concurrent_execution_guard(db_session):
    """Verify active running job prohibits duplicate simultaneous runs."""
    key = "CONCURRENT_JOB_KEY"

    # First runner starts
    runner1 = IngestionJobRunner(
        db=db_session,
        job_type="PRICE_SYNC",
        source_name="YAHOO_FINANCE",
        idempotency_key=key,
    )
    runner1.__enter__()
    assert runner1.job.status == "RUNNING"

    # Second runner attempts with same key while first is RUNNING
    runner2 = IngestionJobRunner(
        db=db_session,
        job_type="PRICE_SYNC",
        source_name="YAHOO_FINANCE",
        idempotency_key=key,
    )
    with pytest.raises(ConcurrentJobExecutionError, match="currently running"):
        runner2.__enter__()

    # Clean up runner1
    runner1.__exit__(None, None, None)


# ---------------------------------------------------------
# 5. Ingestion Service & Partial Failure Recovery Tests
# ---------------------------------------------------------
@pytest.fixture
def sample_company(db_session):
    """Create a sample test company in DB."""
    company = Company(
        name="Test Ingestion Corp",
        isin="INE999A01019",
        cin="L12345MH2020PLC123456",
        is_financial_sector=False,
    )
    db_session.add(company)
    db_session.flush()

    exchange = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(exchange)
    db_session.flush()

    security = Security(
        company_id=company.id,
        exchange_id=exchange.id,
        symbol="TESTCORP",
        is_primary=True,
    )
    db_session.add(security)
    db_session.commit()
    db_session.refresh(company)
    db_session.refresh(security)
    return company, security


def test_csv_ingestion_partial_failure_recovery(db_session, sample_company):
    """Verify that corrupt or unrecognized CSV rows are quarantined without failing valid rows."""
    company, _ = sample_company
    service = IngestionService(db_session)
    service.initialize_metadata()

    # CSV with 2 valid rows and 2 corrupted/unrecognized rows
    csv_data = (
        b"Metric,Date,Value,Unit\n"
        b"Revenue from Operations,2024-03-31,1000.0,CRORES\n"
        b"Unrecognized Mystery Metric,2024-03-31,50.0,CRORES\n"
        b"Net Profit,2024-03-31,150.0,CRORES\n"
        b"Operating Profit,INVALID_DATE_STRING,200.0,CRORES\n"
    )

    job = service.ingest_statement_csv(
        file_content=csv_data,
        filename="financials.csv",
        company_id=company.id,
        statement_type="INCOME_STATEMENT",
        reporting_basis="CONSOLIDATED",
    )

    assert job.status == "PARTIAL_SUCCESS"
    assert job.records_processed == 4
    assert job.records_inserted == 2  # Revenue & Net Profit
    assert job.records_rejected == 2  # Unrecognized metric & Invalid date

    # Verify quarantined records
    stmt = select(RejectedRecord).where(RejectedRecord.ingestion_job_id == job.id)
    rejections = list(db_session.scalars(stmt).all())
    assert len(rejections) == 2
    assert any("Unrecognized metric label" in r.rejection_reason for r in rejections)
    assert any("Invalid date" in r.rejection_reason for r in rejections)

    # Verify inserted facts in financial_statements
    stmt_facts = select(FinancialFact).join(FinancialStatement).where(FinancialStatement.company_id == company.id)
    facts = list(db_session.scalars(stmt_facts).all())
    assert len(facts) == 2


def test_csv_tabular_screener_format_ingestion(db_session, sample_company):
    """Verify tabular CSV (metric in col 0, periods in col 1..N) parses multi-year trends."""
    company, _ = sample_company
    service = IngestionService(db_session)
    service.initialize_metadata()

    tabular_csv = (
        b"Metric,2022-03-31,2023-03-31,2024-03-31\n"
        b"Sales,500,600,750\n"
        b"Operating Profit,100,130,160\n"
        b"Net Profit,60,80,105\n"
    )

    job = service.ingest_statement_csv(
        file_content=tabular_csv,
        filename="screener_multiyear.csv",
        company_id=company.id,
        statement_type="INCOME_STATEMENT",
        reporting_basis="CONSOLIDATED",
        unit="CRORES",
    )

    assert job.status == "COMPLETED"
    assert job.records_rejected == 0
    # 3 metrics * 3 periods = 9 facts
    assert job.records_inserted == 9

    # Re-running the same CSV with allow_reexecution updates instead of duplicating
    job2 = service.ingest_statement_csv(
        file_content=tabular_csv,
        filename="screener_multiyear.csv",
        company_id=company.id,
        statement_type="INCOME_STATEMENT",
        reporting_basis="CONSOLIDATED",
        unit="CRORES",
        allow_reexecution=True,
    )
    assert job2.records_updated == 9
    assert job2.records_inserted == 0


def test_source_document_upload_and_deduplication(db_session, sample_company):
    """Verify SHA-256 deduplication and storage of uploaded documents."""
    company, _ = sample_company
    service = IngestionService(db_session)

    pdf_bytes = b"%PDF-1.4 Mock Annual Report Content for Reliance Industries FY24"

    # 1. First upload
    doc1, is_new1 = service.upload_document(
        file_bytes=pdf_bytes,
        filename="Reliance_AR_2024.pdf",
        mime_type="application/pdf",
        document_type="ANNUAL_REPORT",
        company_id=company.id,
        fiscal_year=2024,
    )
    assert is_new1 is True
    assert doc1.id is not None
    assert doc1.document_type == "ANNUAL_REPORT"

    # 2. Duplicate upload with same contents
    doc2, is_new2 = service.upload_document(
        file_bytes=pdf_bytes,
        filename="Another_Copy_Same_Content.pdf",
        mime_type="application/pdf",
        document_type="ANNUAL_REPORT",
        company_id=company.id,
        fiscal_year=2024,
    )
    assert is_new2 is False
    assert doc2.id == doc1.id
    assert doc2.sha256_hash == doc1.sha256_hash


def test_source_document_oversized_rejected(db_session):
    """Verify oversized file upload (> 50MB) is rejected with clear error."""
    service = IngestionService(db_session)
    oversized = b"0" * (51 * 1024 * 1024)  # 51 MB

    with pytest.raises(ValueError, match="exceeds maximum allowed limit"):
        service.upload_document(
            file_bytes=oversized,
            filename="massive_dump.pdf",
            mime_type="application/pdf",
            document_type="ANNUAL_REPORT",
        )


def test_source_document_disallowed_type_rejected(db_session):
    """Verify unsafe or disallowed file types (.exe, .sh) are rejected."""
    service = IngestionService(db_session)
    malicious = b"echo hello"

    with pytest.raises(ValueError, match="Unsupported file type"):
        service.upload_document(
            file_bytes=malicious,
            filename="install.exe",
            mime_type="application/x-msdownload",
            document_type="ANNUAL_REPORT",
        )


def test_price_history_sync_and_deduplication(db_session, sample_company):
    """Verify EOD price sync upserts candles without duplicate records."""
    _company, security = sample_company
    service = IngestionService(db_session)
    service.initialize_metadata()

    # Mock provider returning 2 daily candles
    candles = [
        ProviderCandle(
            trade_date=date(2024, 1, 1),
            open=Decimal("100.0"),
            high=Decimal("105.0"),
            low=Decimal("98.0"),
            close=Decimal("103.0"),
            volume=500000,
        ),
        ProviderCandle(
            trade_date=date(2024, 1, 2),
            open=Decimal("103.0"),
            high=Decimal("108.0"),
            low=Decimal("102.0"),
            close=Decimal("107.5"),
            volume=600000,
        ),
    ]

    mock_provider = MagicMock()
    mock_provider.provider_name = "mock_provider"
    mock_provider.get_historical_candles.return_value = candles

    with patch("app.services.ingestion_service.get_active_price_provider", return_value=mock_provider):
        job = service.sync_eod_prices_for_security(
            security_id=security.id,
            days=30,
            allow_reexecution=True,
        )

    assert job.status == "COMPLETED"
    assert job.records_inserted == 2

    # Verify rows in DB
    stmt = select(PriceHistory).where(PriceHistory.security_id == security.id)
    prices = list(db_session.scalars(stmt).all())
    assert len(prices) == 2

    # Run again with adjusted price on 2024-01-02
    candles_updated = [
        candles[0],
        ProviderCandle(
            trade_date=date(2024, 1, 2),
            open=Decimal("103.0"),
            high=Decimal("108.0"),
            low=Decimal("102.0"),
            close=Decimal("109.0"),  # Revised close
            volume=600000,
        ),
    ]
    mock_provider.get_historical_candles.return_value = candles_updated

    with patch("app.services.ingestion_service.get_active_price_provider", return_value=mock_provider):
        job2 = service.sync_eod_prices_for_security(
            security_id=security.id,
            days=30,
            allow_reexecution=True,
        )

    assert job2.records_inserted == 0
    assert job2.records_updated == 1

    # Total count should still be exactly 2
    prices_after = list(db_session.scalars(stmt).all())
    assert len(prices_after) == 2


# ---------------------------------------------------------
# 6. FastAPI Ingestion Endpoints Tests
# ---------------------------------------------------------
def test_api_initialize_metadata(client):
    """Test POST /api/v1/ingestion/initialize."""
    response = client.post("/api/v1/ingestion/initialize")
    assert response.status_code == 200
    data = response.json()
    assert "metrics_seeded" in data
    assert "sources_seeded" in data


def test_api_scheduled_jobs(client):
    """Test GET /api/v1/ingestion/scheduled-jobs."""
    response = client.get("/api/v1/ingestion/scheduled-jobs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_api_jobs_pagination(client):
    """Test GET /api/v1/ingestion/jobs."""
    response = client.get("/api/v1/ingestion/jobs?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


def test_api_rejected_records_empty(client):
    """Test GET /api/v1/ingestion/rejected-records."""
    response = client.get("/api/v1/ingestion/rejected-records")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert data["total"] == 0


def test_api_upload_csv_statement(client, sample_company):
    """Test POST /api/v1/ingestion/upload/csv."""
    company, _ = sample_company
    client.post("/api/v1/ingestion/initialize")

    csv_content = (
        "Metric,Date,Value\n"
        "Net Sales,2024-03-31,500.0\n"
        "PAT,2024-03-31,65.0\n"
    )

    files = {"file": ("statement.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {
        "company_id": str(company.id),
        "statement_type": "INCOME_STATEMENT",
        "reporting_basis": "CONSOLIDATED",
        "unit": "CRORES",
    }

    response = client.post("/api/v1/ingestion/upload/csv", files=files, data=data)
    assert response.status_code == 200
    job_data = response.json()
    assert job_data["status"] == "COMPLETED"
    assert job_data["records_inserted"] == 2


def test_api_upload_source_document(client, sample_company):
    """Test POST /api/v1/ingestion/upload/report."""
    company, _ = sample_company

    pdf_content = b"%PDF-1.4 Fake Annual Report Content for Testing API Endpoint"
    files = {"file": ("Annual_Report_2024.pdf", io.BytesIO(pdf_content), "application/pdf")}
    data = {
        "company_id": str(company.id),
        "fiscal_year": "2024",
        "document_type": "ANNUAL_REPORT",
    }

    # First upload
    response = client.post("/api/v1/ingestion/upload/report", files=files, data=data)
    assert response.status_code == 200
    doc_data = response.json()
    assert doc_data["file_name"] == "Annual_Report_2024.pdf"
    assert doc_data["is_duplicate"] is False

    # Second upload with same bytes
    files2 = {"file": ("Annual_Report_2024.pdf", io.BytesIO(pdf_content), "application/pdf")}
    response2 = client.post("/api/v1/ingestion/upload/report", files=files2, data=data)
    assert response2.status_code == 200
    doc_data2 = response2.json()
    assert doc_data2["is_duplicate"] is True
    assert doc_data2["id"] == doc_data["id"]
