"""Providers package aggregating market data adapters."""

from app.core.config import get_settings
from app.providers.exchange.adapter import OfficialExchangeProvider
from app.providers.interfaces.base import BaseDataProvider
from app.providers.interfaces.models import (
    ProviderCandle,
    ProviderCompanyProfile,
    ProviderCorporateAction,
    ProviderFact,
    ProviderFinancialStatement,
    ProviderInstrument,
    ProviderShareholding,
)
from app.providers.upstox.adapter import UpstoxProvider
from app.providers.yahoo_finance.adapter import YahooFinanceProvider

_PROVIDERS: dict[str, BaseDataProvider] = {
    "upstox": UpstoxProvider(),
    "official_exchange": OfficialExchangeProvider(),
    "yahoo_finance": YahooFinanceProvider(),
}


def get_provider(name: str = "upstox") -> BaseDataProvider:
    """Retrieve data provider by name."""
    if name not in _PROVIDERS:
        raise ValueError(f"Unknown provider: '{name}'. Supported: {list(_PROVIDERS.keys())}")
    return _PROVIDERS[name]


def get_active_price_provider() -> BaseDataProvider:
    """Retrieve active price provider based on application configuration."""
    settings = get_settings()
    provider_name = settings.default_price_provider.lower().strip()
    if provider_name in _PROVIDERS:
        provider = _PROVIDERS[provider_name]
        if provider.is_configured():
            return provider
    # Fallback to yahoo_finance which requires no token
    return _PROVIDERS["yahoo_finance"]


__all__ = [
    "BaseDataProvider",
    "OfficialExchangeProvider",
    "ProviderCandle",
    "ProviderCompanyProfile",
    "ProviderCorporateAction",
    "ProviderFact",
    "ProviderFinancialStatement",
    "ProviderInstrument",
    "ProviderShareholding",
    "UpstoxProvider",
    "YahooFinanceProvider",
    "get_active_price_provider",
    "get_provider",
]
