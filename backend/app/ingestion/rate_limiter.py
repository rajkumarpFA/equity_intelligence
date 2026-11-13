"""Token bucket and sliding window rate limiter for provider API requests."""

import asyncio
import threading
import time
from typing import ClassVar


class RateLimiter:
    """Thread-safe and async-safe token bucket rate limiter.
    
    Ensures that calls to external providers (Upstox, Yahoo Finance, NSE/BSE)
    never violate API quotas or trigger HTTP 429 throttling.
    """

    def __init__(self, requests_per_second: float = 5.0, burst_limit: int | None = None):
        self.rate = float(requests_per_second)
        self.burst_limit = float(burst_limit if burst_limit is not None else requests_per_second)
        self._tokens = self.burst_limit
        self._last_timestamp = time.monotonic()
        self._sync_lock = threading.Lock()
        self._async_lock = asyncio.Lock()

    def _replenish(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_timestamp
        self._tokens = min(self.burst_limit, self._tokens + elapsed * self.rate)
        self._last_timestamp = now

    def acquire_sync(self, tokens: float = 1.0, timeout: float = 30.0) -> bool:
        """Synchronously wait until a token is available."""
        start_wait = time.monotonic()
        while True:
            with self._sync_lock:
                self._replenish()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return True
                deficit = tokens - self._tokens
                wait_time = deficit / self.rate

            if time.monotonic() - start_wait + wait_time > timeout:
                return False

            time.sleep(min(wait_time, 0.2))

    async def acquire_async(self, tokens: float = 1.0, timeout: float = 30.0) -> bool:
        """Asynchronously wait until a token is available."""
        start_wait = time.monotonic()
        while True:
            async with self._async_lock:
                self._replenish()
                if self._tokens >= tokens:
                    self._tokens -= tokens
                    return True
                deficit = tokens - self._tokens
                wait_time = deficit / self.rate

            if time.monotonic() - start_wait + wait_time > timeout:
                return False

            await asyncio.sleep(min(wait_time, 0.2))


class ProviderRateLimiterRegistry:
    """Registry managing domain/provider specific rate limiters."""

    _limiters: ClassVar[dict[str, RateLimiter]] = {}
    _lock: ClassVar[threading.Lock] = threading.Lock()

    # Default limits per provider (calls per second)
    DEFAULT_RATES: ClassVar[dict[str, float]] = {
        "upstox": 5.0,
        "yahoo_finance": 2.0,
        "exchange": 1.0,
        "default": 5.0,
    }

    @classmethod
    def get_limiter(cls, provider_name: str) -> RateLimiter:
        key = provider_name.lower().strip()
        with cls._lock:
            if key not in cls._limiters:
                rate = cls.DEFAULT_RATES.get(key, cls.DEFAULT_RATES["default"])
                cls._limiters[key] = RateLimiter(requests_per_second=rate)
            return cls._limiters[key]

    @classmethod
    def reset(cls) -> None:
        """Clear registry limiters (primarily for test isolation)."""
        with cls._lock:
            cls._limiters.clear()
