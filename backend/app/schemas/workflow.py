"""Pydantic schemas for Watchlists and Investment Thesis Journal (Phase 13)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ─── Watchlist Schemas ───────────────────────────────────────────────────────


class WatchlistItemCreate(BaseModel):
    company_id: int
    target_entry_price: float | None = None
    target_exit_price: float | None = None
    conviction: int = Field(default=3, ge=1, le=5)
    thesis_summary: str | None = None
    notes: str | None = None


class WatchlistItemUpdate(BaseModel):
    target_entry_price: float | None = None
    target_exit_price: float | None = None
    conviction: int | None = Field(default=None, ge=1, le=5)
    thesis_summary: str | None = None
    notes: str | None = None


class WatchlistItemRead(BaseModel):
    id: int
    watchlist_id: int
    company_id: int
    symbol: str
    company_name: str
    sector_name: str | None = None
    industry_name: str | None = None
    is_financial_sector: bool = False
    current_price: float | None = None
    price_change: float | None = None
    price_change_pct: float | None = None
    target_entry_price: float | None = None
    target_exit_price: float | None = None
    distance_to_entry_pct: float | None = None
    conviction: int = 3
    thesis_summary: str | None = None
    notes: str | None = None
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WatchlistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    color: str = Field(default="#00d992", max_length=20)


class WatchlistUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    color: str | None = Field(default=None, max_length=20)


class WatchlistRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str
    items_count: int = 0
    items: list[WatchlistItemRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Investment Journal Schemas ──────────────────────────────────────────────


class CatalystItem(BaseModel):
    title: str
    target_date: str | None = None
    status: str = "PENDING"  # PENDING, ACHIEVED, MISSED
    impact: str = "HIGH"  # HIGH, MEDIUM, LOW


class RiskItem(BaseModel):
    title: str
    severity: str = "MEDIUM"  # HIGH, MEDIUM, LOW
    mitigant: str | None = None


class InvestmentNoteCreate(BaseModel):
    company_id: int
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="THESIS", max_length=50)  # THESIS, EARNINGS, RISK, VALUATION, POST_MORTEM
    conviction_score: int = Field(default=3, ge=1, le=5)
    content: str = Field(..., min_length=1)  # Markdown text
    catalysts: list[dict[str, Any]] = Field(default_factory=list)
    key_risks: list[dict[str, Any]] = Field(default_factory=list)
    target_price: float | None = None
    review_date: datetime | None = None


class InvestmentNoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=50)
    conviction_score: int | None = Field(default=None, ge=1, le=5)
    content: str | None = None
    catalysts: list[dict[str, Any]] | None = None
    key_risks: list[dict[str, Any]] | None = None
    target_price: float | None = None
    review_date: datetime | None = None


class InvestmentNoteRead(BaseModel):
    id: int
    company_id: int
    symbol: str
    company_name: str
    title: str
    category: str
    conviction_score: int
    content: str
    catalysts: list[dict[str, Any]]
    key_risks: list[dict[str, Any]]
    target_price: float | None = None
    review_date: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
