"""Pydantic schemas for multi-company peer comparison and competitor analysis."""

from pydantic import BaseModel, ConfigDict


class PeerSummaryItem(BaseModel):
    """Brief summary of a sector/industry peer company."""

    id: int
    name: str
    symbol: str
    exchange: str
    sector: str
    industry: str | None = None
    is_financial_sector: bool = False
    current_price: float | None = None
    price_change_pct: float | None = None
    market_cap_cr: float | None = None
    pe_ratio: float | None = None
    roce_pct: float | None = None

    model_config = ConfigDict(from_attributes=True)


class CompanyPeersResponse(BaseModel):
    """Response containing a company and its identified peers."""

    company_id: int
    company_name: str
    symbol: str
    sector: str
    industry: str | None = None
    peers_count: int
    peers: list[PeerSummaryItem]


class ComparisonCompanyHeader(BaseModel):
    """Header information for a single company in the comparison matrix."""

    id: int
    name: str
    symbol: str
    exchange: str
    isin: str
    sector: str
    industry: str | None = None
    is_financial_sector: bool = False
    current_price: float | None = None
    price_change_pct: float | None = None
    market_cap_cr: float | None = None


class ComparisonMetricValue(BaseModel):
    """Value of a specific metric for one company in the comparison."""

    raw_value: float | None = None
    formatted_value: str
    is_leader: bool = False
    is_laggard: bool = False
    bypass_reason: str | None = None


class ComparisonMetricRow(BaseModel):
    """A single metric row across all compared companies with benchmark statistics."""

    category: str
    metric_key: str
    metric_name: str
    unit: str
    higher_is_better: bool = True
    is_industrial_only: bool = False
    is_banking_only: bool = False
    values: dict[int, ComparisonMetricValue]  # company_id -> value
    peer_average: float | None = None


class RadarDimensionScore(BaseModel):
    """Scores (0-100) across 5 core quantitative dimensions for radar/relative strength visualizer."""

    company_id: int
    symbol: str
    growth: float
    profitability: float
    financial_health: float
    operating_efficiency: float
    valuation_attractiveness: float


class CompanyComparisonRequest(BaseModel):
    """Request payload to compare multiple companies."""

    company_ids: list[int]
    reporting_basis: str = "CONSOLIDATED"


class CompanyComparisonResponse(BaseModel):
    """Full side-by-side comparison matrix with categories, metrics, and radar scores."""

    reporting_basis: str
    companies_count: int
    companies: list[ComparisonCompanyHeader]
    categories: list[str]
    metrics: list[ComparisonMetricRow]
    radar_scores: list[RadarDimensionScore]
