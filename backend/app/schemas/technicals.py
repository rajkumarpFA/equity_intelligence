"""Pydantic schemas for technical indicators, moving averages, and EOD chart data."""

from pydantic import BaseModel, ConfigDict


class CandleDataPoint(BaseModel):
    """Single historical EOD OHLCV candlestick point."""

    trade_date: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    adj_close: float | None = None

    model_config = ConfigDict(from_attributes=True)


class IndicatorPoint(BaseModel):
    """Single point for an overlay line indicator (SMA, EMA, RSI)."""

    trade_date: str
    value: float | None = None


class MACDPoint(BaseModel):
    """Single point for MACD indicator."""

    trade_date: str
    macd: float | None = None
    signal: float | None = None
    histogram: float | None = None


class BollingerBandsPoint(BaseModel):
    """Single point for Bollinger Bands."""

    trade_date: str
    upper: float | None = None
    middle: float | None = None
    lower: float | None = None
    bandwidth: float | None = None
    percent_b: float | None = None


class HistoricalReturns(BaseModel):
    """Percentage returns over standardized horizons."""

    return_1d: float | None = None
    return_1w: float | None = None
    return_1m: float | None = None
    return_3m: float | None = None
    return_6m: float | None = None
    return_1y: float | None = None
    cagr_3y: float | None = None
    cagr_5y: float | None = None


class DrawdownStats(BaseModel):
    """Maximum peak-to-trough drawdown and 52-week price extremes."""

    max_drawdown_pct: float | None = None
    peak_date: str | None = None
    trough_date: str | None = None
    high_52w: float | None = None
    low_52w: float | None = None
    current_drawdown_from_52w_high_pct: float | None = None


class PivotPoints(BaseModel):
    """Classical floor trader pivot points."""

    pivot: float
    r1: float
    s1: float
    r2: float
    s2: float
    r3: float
    s3: float


class TechnicalsSummary(BaseModel):
    """Comprehensive snapshot of latest technical indicators, trend signals, and oscillators."""

    last_close: float
    last_date: str
    price_change: float | None = None
    price_change_pct: float | None = None

    sma_20: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    ema_12: float | None = None
    ema_26: float | None = None

    rsi_14: float | None = None
    rsi_condition: str  # "OVERBOUGHT", "OVERSOLD", "NEUTRAL"

    macd: float | None = None
    macd_signal: float | None = None
    macd_histogram: float | None = None

    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    bb_bandwidth: float | None = None
    bb_squeeze: bool = False

    avg_volume_20d: float | None = None
    volume_vs_20d_ratio: float | None = None

    trend_signal: str  # "BULLISH", "BEARISH", "NEUTRAL"
    trend_explanation: str

    returns: HistoricalReturns
    drawdown: DrawdownStats
    pivots: PivotPoints | None = None


class CompanyTechnicalsResponse(BaseModel):
    """Top-level response delivering full EOD price history and technical indicator series."""

    company_id: int
    security_id: int
    symbol: str
    exchange: str
    timeframe: str
    data_points_count: int

    candles: list[CandleDataPoint]
    sma_20: list[IndicatorPoint]
    sma_50: list[IndicatorPoint]
    sma_200: list[IndicatorPoint]
    ema_12: list[IndicatorPoint]
    ema_26: list[IndicatorPoint]
    rsi_14: list[IndicatorPoint]
    macd: list[MACDPoint]
    bollinger_bands: list[BollingerBandsPoint]

    summary: TechnicalsSummary
