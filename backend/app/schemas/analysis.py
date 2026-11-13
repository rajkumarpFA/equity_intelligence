"""Pydantic schemas for financial ratios, DuPont analysis, and quality health scores."""

from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field


class GrowthRatios(BaseModel):
    """Multi-year CAGR and YoY growth metrics."""

    revenue_cagr_3y: float | None = None
    revenue_cagr_5y: float | None = None
    ebitda_cagr_3y: float | None = None
    ebitda_cagr_5y: float | None = None
    pat_cagr_3y: float | None = None
    pat_cagr_5y: float | None = None
    eps_cagr_3y: float | None = None
    eps_cagr_5y: float | None = None
    revenue_yoy_pct: float | None = None
    pat_yoy_pct: float | None = None


class DuPontDecomposition(BaseModel):
    """3-Stage DuPont ROE Decomposition."""

    net_profit_margin_pct: float | None = None
    asset_turnover: float | None = None
    financial_leverage: float | None = None
    calculated_roe_pct: float | None = None


class ProfitabilityRatios(BaseModel):
    """Profitability metrics."""

    operating_margin_pct: float | None = None
    ebitda_margin_pct: float | None = None
    net_profit_margin_pct: float | None = None
    return_on_equity_pct: float | None = None
    return_on_capital_employed_pct: float | None = None
    return_on_assets_pct: float | None = None
    dupont: DuPontDecomposition = Field(default_factory=DuPontDecomposition)


class SolvencyRatios(BaseModel):
    """Capital structure and solvency metrics (Industrial standards)."""

    debt_to_equity: float | None = None
    interest_coverage_ratio: float | None = None
    current_ratio: float | None = None
    quick_ratio: float | None = None
    debt_to_assets: float | None = None
    is_applicable: bool = True
    bypass_reason: str | None = None


class OperatingEfficiencyRatios(BaseModel):
    """Operating efficiency and cash cycle metrics."""

    asset_turnover: float | None = None
    inventory_days: float | None = None
    debtor_days: float | None = None
    creditor_days: float | None = None
    cash_conversion_cycle_days: float | None = None
    working_capital_days: float | None = None
    is_applicable: bool = True
    bypass_reason: str | None = None


class BankingRatios(BaseModel):
    """Banking and NBFC specific regulatory and operating metrics."""

    net_interest_margin_pct: float | None = None
    casa_ratio_pct: float | None = None
    cost_to_income_pct: float | None = None
    gross_npa_pct: float | None = None
    net_npa_pct: float | None = None
    capital_adequacy_ratio_pct: float | None = None
    is_applicable: bool = False


class HistoricalRatioPeriod(BaseModel):
    """Calculated ratios for a single historical period (e.g. FY2024)."""

    period_label: str
    fiscal_year: int | None = None
    period_end: str
    operating_margin_pct: float | None = None
    net_profit_margin_pct: float | None = None
    roe_pct: float | None = None
    roce_pct: float | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    interest_coverage: float | None = None
    cash_conversion_cycle_days: float | None = None


class CompanyRatiosResponse(BaseModel):
    """Complete financial ratios response for a company."""

    company_id: int
    company_name: str
    symbol: str
    is_financial_sector: bool
    reporting_basis: str  # CONSOLIDATED or STANDALONE
    latest_period_label: str
    growth: GrowthRatios
    profitability: ProfitabilityRatios
    solvency: SolvencyRatios
    efficiency: OperatingEfficiencyRatios
    banking: BankingRatios
    historical_trend: list[HistoricalRatioPeriod] = Field(default_factory=list)


class AltmanZScoreDetail(BaseModel):
    """Altman Z-Score detail."""

    score: float | None = None
    zone: str  # SAFE, GREY, DISTRESS, UNAVAILABLE
    model: str  # NON_MANUFACTURING_4_FACTOR or MANUFACTURING_5_FACTOR
    interpretation: str
    components: dict[str, float] = Field(default_factory=dict)
    is_applicable: bool = True
    bypass_reason: str | None = None


class PiotroskiFactorItem(BaseModel):
    """Individual Piotroski Factor item."""

    score: int
    description: str
    details: dict[str, Any] = Field(default_factory=dict)


class PiotroskiFScoreDetail(BaseModel):
    """9-Factor Piotroski F-Score detail."""

    score: int | None = None
    max_score: int = 9
    rating: str  # VERY_STRONG, MODERATE, WEAK, UNAVAILABLE
    summary: str
    profitability_score: int = 0
    leverage_score: int = 0
    efficiency_score: int = 0
    factors: dict[str, Any] = Field(default_factory=dict)
    is_applicable: bool = True
    bypass_reason: str | None = None


class QualityScoresResponse(BaseModel):
    """Financial health and quality scores for a company."""

    company_id: int
    company_name: str
    symbol: str
    is_financial_sector: bool
    period_label: str
    altman_z: AltmanZScoreDetail
    piotroski_f: PiotroskiFScoreDetail
