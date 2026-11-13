"""Pydantic schemas for financial statements, multi-period matrices, and source provenance."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class StatementPeriodHeader(BaseModel):
    """Metadata for a financial statement filing period column in the matrix."""

    model_config = ConfigDict(from_attributes=True)

    statement_id: int
    fiscal_year: int
    fiscal_quarter: int | None = None
    period_type: str  # ANNUAL, QUARTERLY, HALF_YEARLY
    period_end: date
    publication_date: date | None = None
    is_audited: bool = True
    is_restated: bool = False
    version: int = 1
    display_label: str  # E.g. "FY2024" or "Q3 FY24"


class FactProvenanceDetail(BaseModel):
    """Detailed fact value with full audit provenance for drilldown drawers."""

    model_config = ConfigDict(from_attributes=True)

    fact_id: int
    metric_code: str
    metric_name: str
    category: str
    value: Decimal | None = None
    formatted_value: str | None = None
    raw_value: str | None = None
    raw_label: str | None = None
    currency: str = "INR"
    unit: str = "CRORES"
    line_number: int | None = None
    source_document_id: int | None = None
    source_document_name: str | None = None
    source_document_hash: str | None = None
    validation_status: str = "VERIFIED"
    is_restated: bool = False
    extraction_timestamp: datetime | None = None


class StatementRow(BaseModel):
    """A row in the financial statement matrix representing a single canonical metric."""

    metric_code: str
    metric_name: str
    category: str
    normal_balance: str = "CREDIT"
    unit: str = "CRORES"
    is_banking_specific: bool = False
    values: dict[str, Decimal | None] = Field(
        default_factory=dict,
        description="Map from period display label (e.g. 'FY2024') to normalized numeric value",
    )
    details: dict[str, FactProvenanceDetail | None] = Field(
        default_factory=dict,
        description="Map from period display label to provenance detail for click-to-verify drawer",
    )


class FinancialStatementMatrixResponse(BaseModel):
    """Multi-period financial statement matrix ready for tabular rendering."""

    company_id: int
    company_name: str
    isin: str
    statement_type: str  # INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW
    reporting_basis: str  # CONSOLIDATED, STANDALONE
    period_type: str  # ANNUAL, QUARTERLY
    periods: list[StatementPeriodHeader]
    rows: list[StatementRow]
    available_bases: list[str] = Field(default_factory=list)
    available_period_types: list[str] = Field(default_factory=list)


class CorporateActionDetail(BaseModel):
    """Corporate action event (splits, bonuses, dividends, rights)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    action_type: str  # DIVIDEND, SPLIT, BONUS, RIGHTS, BUYBACK
    announcement_date: date | None = None
    ex_date: date | None = None
    record_date: date | None = None
    ratio_numerator: Decimal | None = None
    ratio_denominator: Decimal | None = None
    dividend_amount: Decimal | None = None
    currency: str = "INR"
    notes: str | None = None
    action_summary: str | None = None


class ShareholdingPatternDetail(BaseModel):
    """Quarterly shareholding distribution pattern."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    period_end: date
    period_label: str | None = None
    promoter_pct: Decimal
    promoter_pledged_pct: Decimal = Decimal("0.0")
    fii_pct: Decimal
    dii_pct: Decimal
    public_pct: Decimal
    others_pct: Decimal = Decimal("0.0")


class AvailablePeriodsResponse(BaseModel):
    """Summary of available statements, bases, and periods for UI tab configuration."""

    company_id: int
    has_consolidated: bool = False
    has_standalone: bool = False
    has_annual: bool = False
    has_quarterly: bool = False
    statement_types_available: list[str] = Field(default_factory=list)
