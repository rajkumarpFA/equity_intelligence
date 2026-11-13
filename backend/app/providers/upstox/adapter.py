"""Upstox API data provider adapter."""

import asyncio
import gzip
import json
import logging
from datetime import date
from decimal import Decimal

import httpx

from app.core.config import get_settings
from app.providers.interfaces.base import BaseDataProvider
from app.providers.interfaces.models import (
    ProviderCandle,
    ProviderCompanyProfile,
    ProviderCorporateAction,
    ProviderFinancialStatement,
    ProviderInstrument,
    ProviderShareholding,
)

logger = logging.getLogger("app.providers.upstox")


class UpstoxProvider(BaseDataProvider):
    """Adapter for Upstox API v2."""

    def __init__(self, base_url: str | None = None, access_token: str | None = None):
        self.settings = get_settings()
        self.base_url = (base_url or self.settings.upstox_api_base_url).rstrip("/")
        self._token = access_token
        self.rate_limit_per_sec = self.settings.upstox_rate_limit_per_sec
        self._last_request_time = 0.0

    @property
    def provider_name(self) -> str:
        return "upstox"

    def is_configured(self) -> bool:
        if self._token and self._token.strip():
            return True
        return self.settings.upstox_configured

    def _get_auth_token(self) -> str | None:
        if self._token:
            return self._token
        if self.settings.upstox_access_token:
            return self.settings.upstox_access_token.get_secret_value()
        if self.settings.upstox_analytics_token:
            return self.settings.upstox_analytics_token.get_secret_value()
        return None

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "EquityIntelligence/0.1.0",
        }
        token = self._get_auth_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def _throttle(self) -> None:
        """Simple rate limiter ensuring requests stay within allowed per-second quota."""
        if self.rate_limit_per_sec > 0:
            delay = 1.0 / self.rate_limit_per_sec
            await asyncio.sleep(delay)

    async def get_instrument_master(self, exchange: str = "NSE") -> list[ProviderInstrument]:
        """Fetch Upstox instrument master catalog."""
        # Upstox provides publicly accessible daily instrument master files
        url = "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz"
        await self._throttle()

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.get(url, headers={"User-Agent": "EquityIntelligence/0.1.0"})
                if res.status_code != 200:
                    logger.warning("Upstox instrument master returned HTTP %s", res.status_code)
                    return []

                content = res.content
                if content.startswith(b"\x1f\x8b"):
                    content = gzip.decompress(content)

                raw_data = json.loads(content)
                if not isinstance(raw_data, list):
                    raw_data = []

                normalized: list[ProviderInstrument] = []

                for item in raw_data:
                    item_exchange = (item.get("exchange") or "").upper()
                    if item_exchange != exchange.upper():
                        continue

                    isin = item.get("isin")
                    symbol = item.get("trading_symbol") or item.get("symbol")
                    if not isin or not symbol:
                        continue

                    normalized.append(
                        ProviderInstrument(
                            exchange_code=item_exchange,
                            symbol=symbol,
                            name=item.get("name") or symbol,
                            isin=isin,
                            series=item.get("segment") or "EQ",
                            lot_size=int(item.get("lot_size") or 1),
                            instrument_type=item.get("instrument_type") or "EQUITY",
                            provider_instrument_key=item.get("instrument_key")
                            or f"{item_exchange}_{symbol}",
                            exchange_token=str(item.get("exchange_token") or ""),
                        )
                    )

                return normalized
        except (httpx.HTTPError, OSError, ValueError) as exc:
            logger.warning("Could not fetch Upstox instrument master: %s", exc)
            return []

    async def get_company_profile(
        self, isin: str, symbol: str | None = None
    ) -> ProviderCompanyProfile | None:
        """Fetch company profile from Upstox fundamentals."""
        if not self.is_configured():
            logger.info("Upstox not configured; skipping company profile fetch for %s", isin)
            return None

        # When credentials are provided, call Upstox fundamentals profile endpoint
        return None

    async def get_historical_candles(
        self,
        symbol: str,
        exchange: str = "NSE",
        from_date: date | None = None,
        to_date: date | None = None,
        provider_instrument_key: str | None = None,
    ) -> list[ProviderCandle]:
        """Fetch daily historical candles from Upstox."""
        instrument_key = provider_instrument_key or f"{exchange.upper()}_EQ|{symbol.upper()}"
        to_str = (to_date or date.today()).strftime("%Y-%m-%d")
        from_str = (from_date or date(2020, 1, 1)).strftime("%Y-%m-%d")

        url = f"{self.base_url}/historical-candle/{instrument_key}/day/{to_str}/{from_str}"
        await self._throttle()

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code != 200:
                    logger.debug(
                        "Upstox candle fetch for %s returned %s", instrument_key, res.status_code
                    )
                    return []

                body = res.json()
                candles_data = body.get("data", {}).get("candles", [])
                candles: list[ProviderCandle] = []

                for row in candles_data:
                    # Upstox candle format: [timestamp, open, high, low, close, volume, open_interest]
                    if len(row) >= 6:
                        dt = row[0][:10]  # "YYYY-MM-DD"
                        candles.append(
                            ProviderCandle(
                                trade_date=date.fromisoformat(dt),
                                open=Decimal(str(row[1])),
                                high=Decimal(str(row[2])),
                                low=Decimal(str(row[3])),
                                close=Decimal(str(row[4])),
                                volume=int(row[5]),
                                adj_close=Decimal(str(row[4])),
                            )
                        )

                # Return sorted chronologically
                candles.sort(key=lambda c: c.trade_date)
                return candles
        except (httpx.HTTPError, OSError, ValueError) as exc:
            logger.warning("Error fetching Upstox historical candles: %s", exc)
            return []

    async def get_financial_statements(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderFinancialStatement]:
        """Fetch financial statements from Upstox."""
        if not self.is_configured():
            logger.info("Upstox token not configured; financial statements unavailable via Upstox")
            return []
        return []

    async def get_shareholding(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderShareholding]:
        """Fetch shareholding disclosures."""
        if not self.is_configured():
            return []
        return []

    async def get_corporate_actions(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderCorporateAction]:
        """Fetch corporate actions."""
        if not self.is_configured():
            return []
        return []
