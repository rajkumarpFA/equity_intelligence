"""Tests for Provider Adapters, Upstox Benchmark, and Report Generation."""

from decimal import Decimal
from pathlib import Path

import pytest

from app.providers import (
    OfficialExchangeProvider,
    UpstoxProvider,
    YahooFinanceProvider,
    get_active_price_provider,
    get_provider,
)
from app.providers.upstox.benchmark import run_benchmark


def test_provider_registry():
    """Verify provider factory returns appropriate adapter instances."""
    active = get_active_price_provider()
    assert isinstance(active, YahooFinanceProvider)
    assert active.provider_name == "yahoo_finance"

    upstox = get_provider("upstox")
    assert isinstance(upstox, UpstoxProvider)
    assert upstox.provider_name == "upstox"

    exchange = get_provider("official_exchange")
    assert isinstance(exchange, OfficialExchangeProvider)
    assert exchange.provider_name == "official_exchange"
    assert exchange.is_configured() is True

    yahoo = get_provider("yahoo_finance")
    assert isinstance(yahoo, YahooFinanceProvider)
    assert yahoo.provider_name == "yahoo_finance"

    with pytest.raises(ValueError, match="Unknown provider"):
        get_provider("non_existent_provider")


def test_upstox_provider_configuration_and_headers():
    """Verify Upstox provider token handling."""
    unconfigured = UpstoxProvider(access_token=None)
    assert unconfigured._get_auth_token() is None
    headers_unauth = unconfigured._get_headers()
    assert "Authorization" not in headers_unauth

    configured = UpstoxProvider(access_token="test_mock_token_123")
    assert configured.is_configured() is True
    assert configured._get_auth_token() == "test_mock_token_123"
    headers_auth = configured._get_headers()
    assert headers_auth["Authorization"] == "Bearer test_mock_token_123"


def test_official_exchange_csv_parser():
    """Verify CSV parser correctly extracts financial statement facts across periods."""
    csv_sample = """Metric,2024-03-31,2023-03-31
Revenue from Operations,1000.50,850.25
Operating Profit (EBITDA),250.00,200.00
Net Profit after Tax,150.75,120.50
"""
    provider = OfficialExchangeProvider()
    statements = provider.parse_financial_statements_csv(
        csv_sample,
        statement_type="INCOME_STATEMENT",
        reporting_basis="CONSOLIDATED",
    )

    assert len(statements) == 2
    stmt_2024 = next(s for s in statements if str(s.period_end) == "2024-03-31")
    assert stmt_2024.statement_type == "INCOME_STATEMENT"
    assert stmt_2024.reporting_basis == "CONSOLIDATED"
    assert len(stmt_2024.facts) == 3

    rev_fact = next(f for f in stmt_2024.facts if f.metric_code == "REVENUE_FROM_OPERATIONS")
    assert rev_fact.value == Decimal("1000.50")


def test_official_exchange_bhavcopy_parser():
    """Verify bhavcopy EOD price parser for target symbol."""
    csv_sample = """SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,TOTTRDQTY,TIMESTAMP
RELIANCE,EQ,2900.00,2950.00,2890.00,2940.50,500000,2024-03-28
TCS,EQ,3800.00,3850.00,3790.00,3820.00,200000,2024-03-28
RELIANCE,EQ,2945.00,2960.00,2930.00,2955.00,450000,2024-03-27
"""
    provider = OfficialExchangeProvider()
    candles = provider.parse_eod_bhavcopy_csv(csv_sample, target_symbol="RELIANCE")

    assert len(candles) == 2
    # Verify chronological sorting
    assert str(candles[0].trade_date) == "2024-03-27"
    assert str(candles[1].trade_date) == "2024-03-28"
    assert candles[1].close == Decimal("2940.50")
    assert candles[1].volume == 500000


@pytest.mark.asyncio
async def test_upstox_benchmark_and_reports_generation(tmp_path: Path):
    """Verify benchmark execution on 7 reference companies and generation of 4 governance reports."""
    summary = await run_benchmark(output_docs_dir=tmp_path)

    assert summary["benchmark_count"] == 7
    assert summary["decision"] == "CONDITIONAL GO"

    # Verify all 4 required reports were written
    cov_file = tmp_path / "upstox_coverage_report.md"
    qual_file = tmp_path / "upstox_data_quality_report.md"
    rec_file = tmp_path / "upstox_reconciliation_report.md"
    dec_file = tmp_path / "upstox_integration_decision.md"

    assert cov_file.exists()
    assert qual_file.exists()
    assert rec_file.exists()
    assert dec_file.exists()

    cov_text = cov_file.read_text()
    assert "Reliance Industries Limited" in cov_text
    assert "HDFC Bank Limited" in cov_text
    assert "Tata Technologies Limited" in cov_text

    dec_text = dec_file.read_text()
    assert "CONDITIONAL GO" in dec_text
    assert "Provider Independence Guarantee" in dec_text
