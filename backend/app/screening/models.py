"""Pydantic schemas and AST models for the screening engine."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FilterCondition(BaseModel):
    """Single screening condition."""

    field: str
    operator: Literal[">", ">=", "<", "<=", "==", "!=", "between", "in", "not_in", "contains"]
    value: Any
    second_value: Any | None = None  # Used when operator == 'between'


class FilterExpression(BaseModel):
    """Abstract Syntax Tree node for multi-condition filtering with logical conjunction."""

    conjunction: Literal["AND", "OR"] = "AND"
    conditions: list[FilterCondition] = Field(default_factory=list)


class ScreenRequest(BaseModel):
    """Request payload to execute a screen."""

    filter_expression: FilterExpression = Field(default_factory=FilterExpression)
    sort_by: str = "market_cap"
    sort_direction: Literal["asc", "desc"] = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)
    include_financials: bool = True
    reporting_basis: Literal["CONSOLIDATED", "STANDALONE"] = "CONSOLIDATED"


class ScreenedCompanyItem(BaseModel):
    """Normalized computed screening metrics for a company."""

    company_id: int
    company_name: str
    isin: str
    symbol: str
    exchange: str
    sector_name: str
    industry_name: str | None = None
    is_financial_sector: bool
    latest_fiscal_year: int | None = None

    # Market & Valuation Multiples
    current_price: float | None = None
    price_change_pct: float | None = None
    market_cap_cr: float | None = None
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    ev_ebitda: float | None = None

    # Returns & Profitability
    roe_pct: float | None = None
    roce_pct: float | None = None
    roa_pct: float | None = None
    operating_margin_pct: float | None = None
    net_profit_margin_pct: float | None = None

    # Solvency & Capital Structure (Industrial)
    debt_to_equity: float | None = None
    interest_coverage: float | None = None
    current_ratio: float | None = None
    quick_ratio: float | None = None

    # Efficiency
    asset_turnover: float | None = None
    cash_conversion_cycle_days: float | None = None
    working_capital_days: float | None = None

    # Growth (CAGR)
    revenue_cagr_3y: float | None = None
    pat_cagr_3y: float | None = None
    revenue_cagr_5y: float | None = None
    pat_cagr_5y: float | None = None
    revenue_yoy_pct: float | None = None

    # Health & Distress Scores
    altman_z_score: float | None = None
    altman_zone: str = "UNAVAILABLE"
    piotroski_f_score: int | None = None
    piotroski_rating: str = "UNAVAILABLE"

    # Banking Specific (Financials)
    net_interest_margin_pct: float | None = None
    casa_ratio_pct: float | None = None
    gross_npa_pct: float | None = None
    capital_adequacy_ratio_pct: float | None = None


class ScreenResponse(BaseModel):
    """Paginated screener execution result."""

    total_count: int
    page: int
    page_size: int
    total_pages: int
    applied_filter_count: int
    reporting_basis: str
    items: list[ScreenedCompanyItem]


class SavedScreenCreate(BaseModel):
    """Payload to save a screener configuration."""

    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    filter_expression: FilterExpression
    sort_by: str = "market_cap"
    sort_direction: Literal["asc", "desc"] = "desc"


class SavedScreenUpdate(BaseModel):
    """Payload to update an existing saved screen."""

    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    filter_expression: FilterExpression | None = None
    sort_by: str | None = None
    sort_direction: Literal["asc", "desc"] | None = None


class SavedScreenRead(BaseModel):
    """Saved screen detail representation."""

    id: int
    name: str
    description: str | None = None
    filter_expression: dict[str, Any]
    sort_by: str
    sort_direction: str
    is_preset: bool
    created_at: datetime
    updated_at: datetime
