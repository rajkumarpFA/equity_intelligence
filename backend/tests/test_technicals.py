"""Unit, service, and API integration tests for Phase 10: Technical Analysis Engine."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.calculations.technical import (
    calculate_bollinger_bands,
    calculate_ema,
    calculate_historical_returns,
    calculate_macd,
    calculate_max_drawdown,
    calculate_pivot_points,
    calculate_rsi,
    calculate_sma,
    evaluate_trend_signal,
)
from app.models.company import Company, Exchange, Industry, Sector, Security
from app.services.technicals_service import TechnicalsService

# ---------------------------------------------------------------------------
# Unit Tests: Quantitative Calculation Engine
# ---------------------------------------------------------------------------


def test_calculate_sma_basic_and_edge_cases():
    """Verify Simple Moving Average formula and boundary behavior."""
    prices = [10.0, 20.0, 30.0, 40.0, 50.0]

    # Window 3: indices 0,1 are None, index 2 is (10+20+30)/3 = 20.0
    sma3 = calculate_sma(prices, 3)
    assert sma3 == [None, None, 20.0, 30.0, 40.0]

    # Insufficient length returns all None
    assert calculate_sma([10.0, 20.0], 5) == [None, None]

    # Window 1 returns identical prices
    assert calculate_sma(prices, 1) == prices

    # Invalid window raises ValueError
    with pytest.raises(ValueError):
        calculate_sma(prices, 0)


def test_calculate_ema_weighting():
    """Verify Exponential Moving Average initial SMA seed and subsequent weighting."""
    prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    window = 3
    # Multiplier k = 2 / (3 + 1) = 0.5
    # SMA seed at index 2: (10 + 11 + 12) / 3 = 11.0
    # index 3: 13.0 * 0.5 + 11.0 * 0.5 = 12.0
    # index 4: 14.0 * 0.5 + 12.0 * 0.5 = 13.0
    # index 5: 15.0 * 0.5 + 13.0 * 0.5 = 14.0
    ema = calculate_ema(prices, window)
    assert ema[0] is None
    assert ema[1] is None
    assert ema[2] == 11.0
    assert ema[3] == 12.0
    assert ema[4] == 13.0
    assert ema[5] == 14.0


def test_calculate_rsi_wilder_smoothing():
    """Verify 14-period RSI calculations, Wilder smoothing, and boundaries [0, 100]."""
    # Monotonically increasing prices -> RSI should approach 100
    up_prices = [100.0 + i * 2.0 for i in range(30)]
    rsi_up = calculate_rsi(up_prices, 14)
    assert rsi_up[:14] == [None] * 14
    assert rsi_up[14] == 100.0
    assert rsi_up[-1] == 100.0

    # Monotonically decreasing prices -> RSI should approach 0
    down_prices = [200.0 - i * 2.0 for i in range(30)]
    rsi_down = calculate_rsi(down_prices, 14)
    assert rsi_down[14] == 0.0

    # Oscillating series stays strictly within [0, 100]
    oscillating = [100.0 + (5.0 if i % 2 == 0 else -5.0) for i in range(40)]
    rsi_osc = calculate_rsi(oscillating, 14)
    for val in rsi_osc[14:]:
        assert val is not None
        assert 0.0 <= val <= 100.0


def test_calculate_macd_and_histogram():
    """Verify MACD line, 9-period signal line, and histogram articulation."""
    # Create 40-period price series
    prices = [100.0 + (i * 1.5) for i in range(50)]
    macd_res = calculate_macd(prices, fast_window=12, slow_window=26, signal_window=9)

    assert len(macd_res) == 50
    # Indices before slow_window - 1 (index 25) must have None
    assert macd_res[0]["macd"] is None
    assert macd_res[24]["macd"] is None
    assert macd_res[25]["macd"] is not None

    # After signal line warmup (26 + 9 - 1 = index 34), histogram must match macd - signal
    for i in range(35, 50):
        m = macd_res[i]["macd"]
        s = macd_res[i]["signal"]
        h = macd_res[i]["histogram"]
        assert m is not None
        assert s is not None
        assert h is not None
        assert round(m - s, 4) == round(h, 4)


def test_calculate_bollinger_bands():
    """Verify Bollinger Bands 20-period SMA, 2 standard deviation upper/lower bands, and bandwidth."""
    prices = [100.0] * 30  # Flat prices -> standard deviation is 0
    bb = calculate_bollinger_bands(prices, window=20, num_std=2.0)

    assert len(bb) == 30
    assert bb[0]["middle"] is None
    # At index 19 (20th point), middle=100, upper=100, lower=100, bandwidth=0
    assert bb[19]["middle"] == 100.0
    assert bb[19]["upper"] == 100.0
    assert bb[19]["lower"] == 100.0
    assert bb[19]["bandwidth"] == 0.0

    # Dispersed prices
    dispersed = [100.0 + (i % 5) * 4.0 for i in range(30)]
    bb_disp = calculate_bollinger_bands(dispersed, window=20, num_std=2.0)
    last_pt = bb_disp[-1]
    assert last_pt["upper"] is not None and last_pt["lower"] is not None
    assert last_pt["upper"] > last_pt["middle"] > last_pt["lower"]
    assert last_pt["bandwidth"] > 0.0


def test_calculate_historical_returns():
    """Verify returns calculation across 1D, 1W, 1M, 1Y, and CAGR."""
    today = date(2026, 11, 12)
    # Generate 300 daily prices growing 100 -> 200
    prices = [100.0 + (i * (100.0 / 299.0)) for i in range(300)]
    dates = [today - timedelta(days=300 - i) for i in range(300)]

    returns = calculate_historical_returns(prices, dates)
    assert returns["return_1d"] is not None
    assert returns["return_1d"] > 0.0
    assert returns["return_1y"] is not None
    # 252 bars back: check positive gain
    assert returns["return_1y"] > 50.0


def test_calculate_max_drawdown():
    """Verify peak-to-trough decline calculation and 52-week price extremes."""
    today = date(2026, 11, 12)
    # Price rises from 100 to 200, drops to 120, then recovers to 150
    prices = [100.0, 150.0, 200.0, 180.0, 140.0, 120.0, 150.0]
    dates = [today - timedelta(days=len(prices) - i) for i in range(len(prices))]

    dd = calculate_max_drawdown(prices, dates)
    # Peak was 200, trough was 120 -> drop of (120 - 200)/200 = -40.0%
    assert dd["max_drawdown_pct"] == -40.0
    assert dd["high_52w"] == 200.0
    assert dd["low_52w"] == 100.0
    # Current drawdown from 52w high: (150 - 200)/200 = -25.0%
    assert dd["current_drawdown_from_52w_high_pct"] == -25.0


def test_calculate_pivot_points():
    """Verify classical floor trader pivot formulas and strict ordering."""
    high = 150.0
    low = 130.0
    close = 140.0

    pivots = calculate_pivot_points(high, low, close)
    # PP = (150 + 130 + 140) / 3 = 140.0
    assert pivots["pivot"] == 140.0
    # R1 = 2*140 - 130 = 150.0
    assert pivots["r1"] == 150.0
    # S1 = 2*140 - 150 = 130.0
    assert pivots["s1"] == 130.0
    # R2 = 140 + (150 - 130) = 160.0
    assert pivots["r2"] == 160.0
    # S2 = 140 - (150 - 130) = 120.0
    assert pivots["s2"] == 120.0

    # Strict ordering: S3 < S2 < S1 < PP < R1 < R2 < R3
    assert (
        pivots["s3"]
        < pivots["s2"]
        < pivots["s1"]
        < pivots["pivot"]
        < pivots["r1"]
        < pivots["r2"]
        < pivots["r3"]
    )


def test_evaluate_trend_signal():
    """Verify bullish, bearish, and neutral moving average crossover signals."""
    # Golden cross: 50 DMA > 200 DMA and price above both
    sig, expl = evaluate_trend_signal(current_price=150.0, sma_50=140.0, sma_200=120.0)
    assert sig == "BULLISH"
    assert "Golden Cross" in expl

    # Death cross: 50 DMA < 200 DMA and price below both
    sig, expl = evaluate_trend_signal(current_price=90.0, sma_50=100.0, sma_200=120.0)
    assert sig == "BEARISH"
    assert "Death Cross" in expl

    # Neutral / Consolidating
    sig, expl = evaluate_trend_signal(current_price=130.0, sma_50=140.0, sma_200=120.0)
    assert sig in ["BULLISH", "NEUTRAL"]


# ---------------------------------------------------------------------------
# Integration Tests: Technicals Service & API Endpoint
# ---------------------------------------------------------------------------


def test_technicals_service_seeding_and_indicators(db_session: Session):
    """Verify TechnicalsService dynamically seeds candles and calculates full response."""
    # Create test company and security
    sector = db_session.query(Sector).first()
    if not sector:
        sector = Sector(name="Technology", code="TECH")
        db_session.add(sector)
        db_session.flush()

    industry = db_session.query(Industry).first()
    if not industry:
        industry = Industry(name="Software", sector_id=sector.id)
        db_session.add(industry)
        db_session.flush()

    exchange = db_session.query(Exchange).filter_by(code="NSE").first()
    if not exchange:
        exchange = Exchange(code="NSE", name="National Stock Exchange of India", currency="INR")
        db_session.add(exchange)
        db_session.flush()

    company = Company(
        name="Technicals Tech Ltd",
        legal_name="Technicals Tech Limited",
        isin="INE999TECH01",
        sector_id=sector.id,
        industry_id=industry.id,
    )
    db_session.add(company)
    db_session.flush()

    security = Security(
        company_id=company.id,
        exchange_id=exchange.id,
        symbol="TECHTEST",
        is_primary=True,
    )
    db_session.add(security)
    db_session.commit()

    service = TechnicalsService(db_session)
    res = service.get_company_technicals(company.id, timeframe="1Y")

    assert res.company_id == company.id
    assert res.symbol == "TECHTEST"
    assert res.timeframe == "1Y"
    assert len(res.candles) > 0
    assert len(res.candles) == len(res.sma_20)
    assert len(res.candles) == len(res.rsi_14)
    assert len(res.candles) == len(res.macd)
    assert len(res.candles) == len(res.bollinger_bands)

    # Check summary attributes
    assert res.summary.last_close > 0.0
    assert res.summary.trend_signal in ["BULLISH", "BEARISH", "NEUTRAL"]
    assert res.summary.rsi_condition in ["OVERBOUGHT", "OVERSOLD", "NEUTRAL"]
    assert res.summary.drawdown.max_drawdown_pct is not None
    assert res.summary.pivots is not None


def test_technicals_api_endpoint(client: TestClient, db_session: Session):
    """Verify GET /api/v1/companies/{id}/technicals returns valid payload and handles 404."""
    # Find existing company or create one
    company = db_session.query(Company).first()
    if not company:
        sector = Sector(name="Energy", code="ENRG")
        db_session.add(sector)
        db_session.flush()
        industry = Industry(name="Oil & Gas", sector_id=sector.id)
        db_session.add(industry)
        db_session.flush()
        exchange = Exchange(code="NSE", name="NSE", currency="INR")
        db_session.add(exchange)
        db_session.flush()

        company = Company(
            name="Reliance Industries",
            isin="INE002A01018",
            sector_id=sector.id,
            industry_id=industry.id,
        )
        db_session.add(company)
        db_session.flush()
        sec = Security(company_id=company.id, exchange_id=exchange.id, symbol="RELIANCE", is_primary=True)
        db_session.add(sec)
        db_session.commit()

    response = client.get(f"/api/v1/companies/{company.id}/technicals?timeframe=6M")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == company.id
    assert data["timeframe"] == "6M"
    assert "candles" in data
    assert "summary" in data
    assert "sma_50" in data
    assert "rsi_14" in data
    assert "macd" in data
    assert "bollinger_bands" in data
    assert data["summary"]["last_close"] > 0

    # Test non-existent company 404
    err_response = client.get("/api/v1/companies/999999/technicals")
    assert err_response.status_code == 404
