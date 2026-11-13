"""Price service for retrieving, caching, and serving latest EOD market quotes."""

import asyncio
import logging
import time
from datetime import date, timedelta
from decimal import Decimal

from app.providers import get_active_price_provider

logger = logging.getLogger("app.services.price")

# In-memory quote cache: symbol -> {"current_price": Decimal, "price_change": Decimal, "price_change_pct": Decimal, "price_date": date, "ts": float}
_QUOTE_CACHE: dict[str, dict] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache


class PriceService:
    def __init__(self):
        self.provider = get_active_price_provider()
        self._semaphore = asyncio.Semaphore(2)

    def clear_cache(self) -> None:
        """Clear all cached price quotes."""
        _QUOTE_CACHE.clear()

    def get_cached_quotes_for_symbols(self, symbols: list[str]) -> dict[str, dict]:
        """Retrieve already-cached price quotes without triggering any external network requests."""
        quotes = {}
        for sym in symbols:
            upper = sym.upper()
            for ex in ["NSE", "BSE"]:
                key = f"{ex}_{upper}"
                if key in _QUOTE_CACHE:
                    quotes[upper] = _QUOTE_CACHE[key]
                    break
        return quotes

    async def get_latest_quote_async(
        self, symbol: str, exchange: str = "NSE", force_refresh: bool = False
    ) -> dict | None:
        """Fetch latest price quote with 5-minute in-memory caching or forced refresh."""
        cache_key = f"{exchange.upper()}_{symbol.upper()}"
        now = time.time()

        if not force_refresh and cache_key in _QUOTE_CACHE:
            cached = _QUOTE_CACHE[cache_key]
            if now - cached["ts"] < CACHE_TTL_SECONDS:
                return cached

        try:
            # Query recent 30-day window to calculate latest close & previous day change
            recent_from = date.today() - timedelta(days=30)
            candles = await self.provider.get_historical_candles(
                symbol=symbol,
                exchange=exchange,
                from_date=recent_from,
            )
            if not candles:
                return None

            latest = candles[-1]
            prev = candles[-2] if len(candles) > 1 else latest
            change = latest.close - prev.close
            change_pct = (change / prev.close * 100) if prev.close != 0 else Decimal("0.0")

            quote = {
                "current_price": latest.close,
                "price_change": round(change, 2),
                "price_change_pct": round(change_pct, 2),
                "price_date": latest.trade_date,
                "ts": now,
            }
            _QUOTE_CACHE[cache_key] = quote
            return quote
        except (OSError, ValueError, KeyError) as exc:
            logger.warning("Error fetching quote for %s: %r", symbol, exc)
            return None

    def get_latest_quote(
        self, symbol: str, exchange: str = "NSE", force_refresh: bool = False
    ) -> dict | None:
        """Synchronous wrapper to get quote."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(
                        asyncio.run,
                        self.get_latest_quote_async(symbol, exchange, force_refresh=force_refresh),
                    ).result()
            return loop.run_until_complete(
                self.get_latest_quote_async(symbol, exchange, force_refresh=force_refresh)
            )
        except (RuntimeError, OSError):
            return asyncio.run(
                self.get_latest_quote_async(symbol, exchange, force_refresh=force_refresh)
            )

    async def get_quotes_for_symbols(
        self, symbols: list[str], exchange: str = "NSE", force_refresh: bool = False
    ) -> dict[str, dict]:
        """Fetch quotes concurrently for multiple symbols with bounded concurrency."""
        async def _fetch_throttled(sym: str) -> tuple[str, dict | None]:
            async with self._semaphore:
                quote = await self.get_latest_quote_async(sym, exchange, force_refresh=force_refresh)
                await asyncio.sleep(0.15)
                return sym.upper(), quote

        tasks = [_fetch_throttled(sym) for sym in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        quotes = {}
        for res in results:
            if isinstance(res, tuple) and res[1] is not None:
                quotes[res[0]] = res[1]
        return quotes

    def get_quotes_for_symbols_sync(
        self, symbols: list[str], exchange: str = "NSE", force_refresh: bool = False
    ) -> dict[str, dict]:
        """Synchronous wrapper to get multiple quotes concurrently."""
        try:
            return asyncio.run(
                self.get_quotes_for_symbols(symbols, exchange, force_refresh=force_refresh)
            )
        except (RuntimeError, OSError):
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(
                    asyncio.run,
                    self.get_quotes_for_symbols(symbols, exchange, force_refresh=force_refresh),
                ).result()
