"""Optional Yahoo Finance historical price adapter for experimentation only."""

import logging
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import ClassVar

import httpx

from app.ingestion.rate_limiter import ProviderRateLimiterRegistry
from app.providers.interfaces.base import BaseDataProvider
from app.providers.interfaces.models import (
    ProviderCandle,
    ProviderCompanyProfile,
    ProviderCorporateAction,
    ProviderFinancialStatement,
    ProviderInstrument,
    ProviderShareholding,
)

logger = logging.getLogger("app.providers.yahoo_finance")


class YahooFinanceProvider(BaseDataProvider):
    """Optional historical price adapter for experimentation. Never the source of truth for financials."""

    # Ticker aliases for symbols that changed or restructured on Yahoo Finance
    SYMBOL_ALIASES: ClassVar[dict[str, str]] = {
        "TATAMOTORS": "TMCV",
    }

    @property
    def provider_name(self) -> str:
        return "yahoo_finance"

    def is_configured(self) -> bool:
        # Public experimental chart queries require no authentication token
        return True

    async def get_instrument_master(self, exchange: str = "NSE") -> list[ProviderInstrument]:
        return []

    async def get_company_profile(
        self, isin: str, symbol: str | None = None
    ) -> ProviderCompanyProfile | None:
        return None

    async def get_historical_candles(
        self,
        symbol: str,
        exchange: str = "NSE",
        from_date: date | None = None,
        to_date: date | None = None,
        provider_instrument_key: str | None = None,
    ) -> list[ProviderCandle]:
        """Fetch historical EOD daily candles from Yahoo Finance query API."""
        # Indian tickers use suffix .NS for NSE and .BO for BSE
        clean_symbol = self.SYMBOL_ALIASES.get(symbol.upper(), symbol.upper())
        ticker_suffix = ".NS" if exchange.upper() == "NSE" else ".BO"
        ticker = f"{clean_symbol}{ticker_suffix}"

        period1 = int(
            datetime.combine(
                from_date or date(2020, 1, 1), datetime.min.time(), tzinfo=UTC
            ).timestamp()
        )
        period2 = int(
            datetime.combine(to_date or date.today(), datetime.max.time(), tzinfo=UTC).timestamp()
        )

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?period1={period1}&period2={period2}&interval=1d"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }

        limiter = ProviderRateLimiterRegistry.get_limiter("yahoo_finance")

        # Retry transient connection drops or throttling up to 2 attempts
        for attempt in range(2):
            try:
                await limiter.acquire_async()
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.get(url, headers=headers)
                    if res.status_code != 200:
                        logger.debug("Yahoo Finance returned status %s for %s", res.status_code, ticker)
                        return []

                    data = res.json()
                    result = data.get("chart", {}).get("result", [])
                    if not result:
                        return []

                    quote_root = result[0]
                    timestamps = quote_root.get("timestamp", [])
                    indicators = quote_root.get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    adjclose_list = indicators.get("adjclose", [{}])[0].get("adjclose", [])

                    opens = quote.get("open", [])
                    highs = quote.get("high", [])
                    lows = quote.get("low", [])
                    closes = quote.get("close", [])
                    volumes = quote.get("volume", [])

                    candles: list[ProviderCandle] = []
                    for i, ts in enumerate(timestamps):
                        if i < len(opens) and opens[i] is not None and closes[i] is not None:
                            t_date = datetime.fromtimestamp(ts, tz=UTC).date()
                            adj_c = (
                                adjclose_list[i]
                                if i < len(adjclose_list) and adjclose_list[i] is not None
                                else closes[i]
                            )
                            candles.append(
                                ProviderCandle(
                                    trade_date=t_date,
                                    open=Decimal(str(round(opens[i], 4))),
                                    high=Decimal(str(round(highs[i], 4))),
                                    low=Decimal(str(round(lows[i], 4))),
                                    close=Decimal(str(round(closes[i], 4))),
                                    volume=int(volumes[i] or 0),
                                    adj_close=Decimal(str(round(adj_c, 4))),
                                )
                            )

                    candles.sort(key=lambda c: c.trade_date)
                    return candles
            except (httpx.RemoteProtocolError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
                if attempt == 0:
                    logger.debug("Retrying Yahoo Finance for %s after %r", ticker, exc)
                    import asyncio

                    await asyncio.sleep(0.5)
                    continue
                logger.warning(
                    "Error fetching Yahoo Finance historical candles for %s: %r", ticker, exc
                )
                return []
            except (httpx.HTTPError, OSError, ValueError) as exc:
                logger.warning(
                    "Error fetching Yahoo Finance historical candles for %s: %r", ticker, exc
                )
                return []
        return []

    async def get_financial_statements(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderFinancialStatement]:
        # Specification Section 7 rule: Never use Yahoo Finance as source of truth for financials
        return []

    async def get_shareholding(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderShareholding]:
        return []

    async def get_corporate_actions(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderCorporateAction]:
        return []
