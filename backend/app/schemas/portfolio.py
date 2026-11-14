"""Pydantic schemas for Portfolio Management, Transactions, and Analytics."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PortfolioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    benchmark_symbol: str = "^NSEI"
    cash_balance: Decimal = Decimal("0.0000")


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    benchmark_symbol: str | None = None
    cash_balance: Decimal | None = None


class PortfolioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    benchmark_symbol: str
    cash_balance: float
    currency: str
    total_equity_value: float = 0.0
    total_invested_amount: float = 0.0
    total_unrealized_pnl: float = 0.0
    total_realized_pnl: float = 0.0
    portfolio_xirr: float | None = None
    holdings_count: int = 0
    created_at: datetime
    updated_at: datetime


class TransactionCreate(BaseModel):
    security_id: int | None = None
    company_id: int | None = None
    symbol: str | None = None
    # BUY, SELL, DIVIDEND, SPLIT, BONUS, DEPOSIT, WITHDRAWAL
    transaction_type: str
    trade_date: date
    trade_time: time | None = None
    order_sequence: int = 0
    quantity: Decimal | None = None
    price_per_share: Decimal | None = None
    amount: Decimal | None = None
    brokerage_charges: Decimal = Decimal("0.0000")
    taxes: Decimal = Decimal("0.0000")
    broker_trade_id: str | None = None
    notes: str | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int
    security_id: int | None = None
    company_id: int | None = None
    symbol: str | None = None
    company_name: str | None = None
    transaction_type: str
    trade_date: date
    trade_time: time | None = None
    order_sequence: int
    quantity: float | None = None
    price_per_share: float | None = None
    amount: float
    brokerage_charges: float
    taxes: float
    broker_trade_id: str | None = None
    notes: str | None = None
    created_at: datetime


class HoldingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    security_id: int
    company_id: int
    symbol: str
    company_name: str
    sector_name: str
    market_cap_category: str
    total_quantity: float
    average_buy_price: float
    invested_amount: float
    current_price: float | None = None
    current_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_pct: float | None = None
    realized_pnl: float = 0.0
    holding_xirr: float | None = None


class SectorAllocation(BaseModel):
    name: str
    value: float
    weight_pct: float


class MarketCapAllocation(BaseModel):
    tier: str
    value: float
    weight_pct: float


class PortfolioAnalyticsRead(BaseModel):
    portfolio_id: int
    portfolio_name: str
    total_net_worth: float
    total_stock_value: float
    invested_capital: float
    unrealized_pnl: float
    unrealized_pnl_pct: float | None = None
    realized_pnl: float
    cash_balance: float
    portfolio_xirr: float | None = None
    benchmark_symbol: str
    beta: float | None = None
    alpha: float | None = None
    sectors: list[SectorAllocation]
    market_caps: list[MarketCapAllocation]
    holdings: list[HoldingRead]


class CSVImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    errors: list[str]
