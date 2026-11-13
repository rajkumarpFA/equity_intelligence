"""Pydantic schemas for quantitative valuation models and scenario persistence."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DCFScenarioAssumptions(BaseModel):
    """Assumptions used in running a DCF model."""

    forecast_years: int = Field(default=5, ge=1, le=10)
    revenue_growth_rates: list[float] = Field(
        default=[0.15, 0.14, 0.13, 0.12, 0.10],
        description="List of decimal annual growth rates per projection year (e.g. 0.15 for 15%)",
    )
    operating_margins: list[float] = Field(
        default=[0.20, 0.20, 0.20, 0.20, 0.20],
        description="Operating EBIT margin per projection year",
    )
    tax_rate: float = Field(default=0.25, ge=0.0, le=0.50)
    reinvestment_rates: list[float] = Field(
        default=[0.30, 0.30, 0.30, 0.30, 0.30],
        description="Reinvestment rate as fraction of NOPAT",
    )
    wacc: float = Field(default=0.12, ge=0.04, le=0.30, description="Weighted Average Cost of Capital")
    terminal_growth_rate: float = Field(default=0.05, ge=0.01, le=0.10, description="Perpetual growth rate")
    terminal_method: str = Field(default="GORDON_GROWTH", description="GORDON_GROWTH or EXIT_MULTIPLE")
    exit_multiple: float | None = Field(default=15.0, ge=1.0, le=60.0)


class DCFRunRequest(BaseModel):
    """Request payload to execute a DCF valuation."""

    company_id: int
    assumptions: DCFScenarioAssumptions
    current_price: float | None = None


class DCFProjectionItem(BaseModel):
    year: int
    revenue: float
    growth_pct: float
    ebit: float
    margin_pct: float
    nopat: float
    fcff: float
    discount_factor: float
    pv_fcff: float


class DCFResult(BaseModel):
    model: str = "DCF"
    terminal_value_method: str
    enterprise_value: float
    pv_explicit_fcf: float
    terminal_value: float
    pv_terminal_value: float
    total_debt: float
    cash_and_equivalents: float
    equity_value: float
    shares_outstanding: float
    current_price: float
    intrinsic_value_per_share: float
    margin_of_safety_pct: float
    is_undervalued: bool
    projections: list[DCFProjectionItem]
    status: str = "SUCCESS"
    reason: str | None = None


class SensitivityMatrixRequest(BaseModel):
    company_id: int
    base_growth_rate: float = 0.12
    base_operating_margin: float = 0.20
    base_wacc: float = 0.12
    base_terminal_growth: float = 0.05
    projection_years: int = 5
    current_price: float | None = None


class SensitivityMatrixCell(BaseModel):
    terminal_growth_pct: float
    value: float | None
    diff_pct: float | None


class SensitivityMatrixRow(BaseModel):
    wacc_pct: float
    values: list[SensitivityMatrixCell]


class SensitivityMatrixResponse(BaseModel):
    base_wacc_pct: float
    base_terminal_growth_pct: float
    current_price: float
    tg_headers: list[float]
    matrix: list[SensitivityMatrixRow]


class ReverseDCFRequest(BaseModel):
    company_id: int
    current_price: float | None = None
    wacc: float = 0.12
    terminal_growth_rate: float = 0.05
    operating_margin: float | None = None
    reinvestment_rate: float = 0.30
    projection_years: int = 5


class ReverseDCFResponse(BaseModel):
    model: str = "REVERSE_DCF"
    current_price: float
    implied_revenue_growth_pct: float
    historical_revenue_cagr_pct: float | None = None
    growth_gap_pct: float | None = None
    is_optimistic: bool = False
    assumptions: dict[str, Any]
    status: str = "SUCCESS"
    reason: str | None = None


class HistoricalMultiplesResponse(BaseModel):
    model: str = "HISTORICAL_MULTIPLES"
    current_price: float
    pe: dict[str, Any]
    pb: dict[str, Any]
    ev_ebitda: dict[str, Any]
    blended_target_price: float | None = None
    blended_margin_of_safety_pct: float | None = None
    status: str = "SUCCESS"
    reason: str | None = None


class DDMRequest(BaseModel):
    company_id: int
    cost_of_equity: float = 0.13
    dividend_growth_rate: float = 0.06
    high_growth_period_years: int = 0
    high_growth_rate: float | None = None
    current_price: float | None = None


class DDMResponse(BaseModel):
    model: str = "DDM"
    is_applicable: bool
    bypass_reason: str | None = None
    message: str | None = None
    latest_dps: float | None = None
    cost_of_equity_pct: float | None = None
    dividend_growth_pct: float | None = None
    current_price: float | None = None
    intrinsic_value: float | None = None
    margin_of_safety_pct: float | None = None
    is_undervalued: bool | None = None


class GrahamRequest(BaseModel):
    company_id: int
    expected_growth_rate: float = 0.10
    benchmark_yield_pct: float = 7.10
    current_price: float | None = None


class GrahamResponse(BaseModel):
    model: str = "GRAHAM"
    is_applicable: bool
    bypass_reason: str | None = None
    message: str | None = None
    latest_eps: float | None = None
    latest_bvps: float | None = None
    expected_growth_pct: float | None = None
    benchmark_yield_pct: float | None = None
    current_price: float | None = None
    graham_value: float | None = None
    graham_number: float | None = None
    margin_of_safety_pct: float | None = None
    is_undervalued: bool | None = None


class ValuationSummaryResponse(BaseModel):
    company_id: int
    symbol: str
    company_name: str
    sector_name: str | None
    industry_name: str | None
    is_financial_sector: bool
    current_price: float
    dcf: DCFResult | None = None
    reverse_dcf: ReverseDCFResponse | None = None
    historical_multiples: HistoricalMultiplesResponse | None = None
    ddm: DDMResponse | None = None
    graham: GrahamResponse | None = None
    consensus_fair_value: float | None = None
    consensus_upside_pct: float | None = None
    applicable_models_count: int = 0


class SavedValuationCreate(BaseModel):
    company_id: int
    model_type: str = "DCF"
    scenario_name: str = "BASE"
    intrinsic_value: float | None = None
    current_price_at_run: float | None = None
    margin_of_safety_pct: float | None = None
    assumptions: dict[str, Any] = Field(default_factory=dict)
    projections: list[Any] = Field(default_factory=list)
    notes: str | None = None


class SavedValuationRead(BaseModel):
    id: int
    company_id: int
    model_type: str
    scenario_name: str
    intrinsic_value: float | None = None
    current_price_at_run: float | None = None
    margin_of_safety_pct: float | None = None
    assumptions: dict[str, Any]
    projections: list[Any]
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
