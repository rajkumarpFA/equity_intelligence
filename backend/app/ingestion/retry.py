"""Exponential backoff and jitter retry mechanism for transient failures."""

import asyncio
import functools
import logging
import random
import time
from collections.abc import Callable, Sequence
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
DEFAULT_RETRYABLE_EXCEPTIONS: tuple[type[Exception], ...] = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    ConnectionError,
    TimeoutError,
)


def is_retryable_exception(exc: Exception) -> bool:
    """Determine if an exception is transient and safe to retry."""
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS_CODES
    return isinstance(exc, DEFAULT_RETRYABLE_EXCEPTIONS)


def compute_backoff_delay(
    attempt: int,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    max_delay: float = 30.0,
    jitter: bool = True,
) -> float:
    """Compute exponential backoff with full jitter to prevent thundering herd problems."""
    delay = min(max_delay, initial_delay * (backoff_factor**attempt))
    if jitter:
        # Full jitter between 0 and computed delay
        delay = random.uniform(delay * 0.5, delay * 1.5)
    return max(0.01, delay)


def with_retry_sync(
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    max_delay: float = 30.0,
    jitter: bool = True,
    retryable_exceptions: Sequence[type[Exception]] | None = None,
) -> Callable:
    """Decorator for synchronous functions with exponential backoff retry."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    last_exception = exc
                    # Check if retryable
                    is_retryable = is_retryable_exception(exc)
                    if retryable_exceptions:
                        is_retryable = is_retryable or isinstance(exc, tuple(retryable_exceptions))

                    if not is_retryable or attempt >= max_retries:
                        logger.warning(
                            "Sync call %s failed definitively on attempt %d/%d: %s",
                            func.__name__,
                            attempt + 1,
                            max_retries + 1,
                            str(exc),
                        )
                        raise

                    wait_sec = compute_backoff_delay(
                        attempt, initial_delay, backoff_factor, max_delay, jitter
                    )
                    logger.info(
                        "Sync call %s transient failure (%s). Retrying in %.2fs (attempt %d/%d)",
                        func.__name__,
                        type(exc).__name__,
                        wait_sec,
                        attempt + 1,
                        max_retries,
                    )
                    time.sleep(wait_sec)

            if last_exception:
                raise last_exception

        return wrapper

    return decorator


def with_retry_async(
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    max_delay: float = 30.0,
    jitter: bool = True,
    retryable_exceptions: Sequence[type[Exception]] | None = None,
) -> Callable:
    """Decorator for asynchronous coroutines with exponential backoff retry."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    last_exception = exc
                    is_retryable = is_retryable_exception(exc)
                    if retryable_exceptions:
                        is_retryable = is_retryable or isinstance(exc, tuple(retryable_exceptions))

                    if not is_retryable or attempt >= max_retries:
                        logger.warning(
                            "Async call %s failed definitively on attempt %d/%d: %s",
                            func.__name__,
                            attempt + 1,
                            max_retries + 1,
                            str(exc),
                        )
                        raise

                    wait_sec = compute_backoff_delay(
                        attempt, initial_delay, backoff_factor, max_delay, jitter
                    )
                    logger.info(
                        "Async call %s transient failure (%s). Retrying in %.2fs (attempt %d/%d)",
                        func.__name__,
                        type(exc).__name__,
                        wait_sec,
                        attempt + 1,
                        max_retries,
                    )
                    await asyncio.sleep(wait_sec)

            if last_exception:
                raise last_exception

        return wrapper

    return decorator
