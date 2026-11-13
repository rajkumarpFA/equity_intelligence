"""Canonical Provider DTOs decoupled from external provider API response formats."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ProviderInstrument(BaseModel):
    """Normalized security instrument from an exchange or provider master file."""

    exchange_code: str  # NSE, BSE
    symbol: str
    name: str
    isin: str
    series: str = "EQ"
    lot_size: int = 1
    instrument_type: str = "EQUITY"
    provider_instrument_key: str
    exchange_token: str | None = None


class ProviderCompanyProfile(BaseModel):
    """Normalized company metadata from provider."""

    name: str
    legal_name: str | None = None
    isin: str
    cin: str | None = None
    sector_name: str | None = None
    industry_name: str | None = None
    description: str | None = None
    website: str | None = None
    is_financial_sector: bool = False
    paid_up_capital: Decimal | None = None
    face_value: Decimal | None = None


class ProviderFact(BaseModel):
    """Individual financial statement line-item / fact."""

    metric_name: str
    metric_code: str
    value: Decimal
    raw_value: str | None = None
    unit: str = "CRORES"  # CRORES, LAKHS, INR, PER_SHARE, RATIO, PERCENTAGE
    currency: str = "INR"


class ProviderFinancialStatement(BaseModel):
    """Normalized financial statement (Income Statement, Balance Sheet, Cash Flow)."""

    statement_type: Literal["INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW"]
    reporting_basis: Literal["STANDALONE", "CONSOLIDATED"]
    period_type: Literal["ANNUAL", "QUARTERLY"]
    period_start: date | None = None
    period_end: date
    publication_date: date | None = None
    is_restated: bool = False
    facts: list[ProviderFact] = Field(default_factory=list)


class ProviderShareholding(BaseModel):
    """Shareholding pattern disclosure for a period."""

    period_end: date
    promoter_holding_pct: Decimal | None = None
    promoter_pledged_pct: Decimal | None = None
    fii_holding_pct: Decimal | None = None
    dii_holding_pct: Decimal | None = None
    public_holding_pct: Decimal | None = None
    others_holding_pct: Decimal | None = None


class ProviderCorporateAction(BaseModel):
    """Corporate action event (dividend, split, bonus, rights)."""

    action_type: Literal["DIVIDEND", "SPLIT", "BONUS", "RIGHTS", "OTHER"]
    ex_date: date | None = None
    record_date: date | None = None
    announcement_date: date | None = None
    ratio: str | None = None  # e.g., "1:2" for split/bonus
    amount: Decimal | None = None  # Dividend amount per share
    currency: str = "INR"
    description: str | None = None


class ProviderCandle(BaseModel):
    """End-of-day price and volume candle."""

    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    adj_close: Decimal | None = None
