"""Abstract base class for all market and financial data providers."""

from abc import ABC, abstractmethod
from datetime import date

from app.providers.interfaces.models import (
    ProviderCandle,
    ProviderCompanyProfile,
    ProviderCorporateAction,
    ProviderFinancialStatement,
    ProviderInstrument,
    ProviderShareholding,
)


class BaseDataProvider(ABC):
    """Provider adapter interface ensuring domain logic remains independent of external APIs."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Unique identifier name for this provider (e.g. 'upstox', 'exchange', 'yahoo_finance')."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Check whether valid credentials/tokens are configured for this provider."""

    @abstractmethod
    async def get_instrument_master(self, exchange: str = "NSE") -> list[ProviderInstrument]:
        """Fetch instrument master catalog for the specified exchange."""

    @abstractmethod
    async def get_company_profile(
        self, isin: str, symbol: str | None = None
    ) -> ProviderCompanyProfile | None:
        """Fetch company profile and taxonomy information."""

    @abstractmethod
    async def get_historical_candles(
        self,
        symbol: str,
        exchange: str = "NSE",
        from_date: date | None = None,
        to_date: date | None = None,
        provider_instrument_key: str | None = None,
    ) -> list[ProviderCandle]:
        """Fetch historical EOD daily candles."""

    @abstractmethod
    async def get_financial_statements(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderFinancialStatement]:
        """Fetch available annual and quarterly financial statements (standalone and consolidated)."""

    @abstractmethod
    async def get_shareholding(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderShareholding]:
        """Fetch historical shareholding pattern disclosures."""

    @abstractmethod
    async def get_corporate_actions(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderCorporateAction]:
        """Fetch corporate actions history (dividends, splits, bonuses)."""
