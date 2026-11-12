"""Pydantic schemas for company, securities, and taxonomy."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SectorBase(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class SectorRead(SectorBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class IndustryBase(BaseModel):
    name: str
    code: str | None = None
    sector_id: int


class IndustryRead(IndustryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class SecurityBase(BaseModel):
    symbol: str
    series: str = "EQ"
    exchange_token: str | None = None
    provider_instrument_key: str | None = None
    is_primary: bool = False
    is_active: bool = True
    lot_size: int = 1
    market_cap_category: str | None = None


class SecurityCreate(SecurityBase):
    exchange_code: str = Field(..., description="Exchange identifier code, e.g. NSE or BSE")


class SecurityRead(SecurityBase):
    id: int
    exchange_code: str
    exchange_name: str
    model_config = ConfigDict(from_attributes=True)


class CompanyBase(BaseModel):
    name: str
    legal_name: str | None = None
    isin: str = Field(..., min_length=12, max_length=12, description="12-character ISIN code")
    cin: str | None = None
    is_financial_sector: bool = False
    accounting_standard: str = "IND-AS"
    paid_up_capital: Decimal | None = None
    face_value: Decimal | None = None
    description: str | None = None
    website: str | None = None
    status: str = "ACTIVE"


class CompanyCreate(CompanyBase):
    sector_name: str | None = None
    industry_name: str | None = None
    securities: list[SecurityCreate] = []


class CompanyRead(CompanyBase):
    id: int
    sector: SectorRead | None = None
    industry: IndustryRead | None = None
    securities: list[SecurityRead] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompanySearchItem(BaseModel):
    """Summarized company item for search discovery lists."""

    id: int
    name: str
    isin: str
    cin: str | None = None
    sector_name: str | None = None
    industry_name: str | None = None
    is_financial_sector: bool
    status: str
    primary_symbol: str | None = None
    exchange_listings: list[str] = []
    securities: list[SecurityRead] = []

    model_config = ConfigDict(from_attributes=True)


class CompanySearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[CompanySearchItem]
