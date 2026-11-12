"""Structured logging setup that avoids leaking sensitive credentials."""

import logging
import sys


class _CredentialRedactingFilter(logging.Filter):
    """Redact common bearer/token patterns from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str) and "Bearer " in record.msg:
            record.msg = record.msg.split("Bearer ")[0] + "Bearer [REDACTED]"
        return True


def configure_logging(level: str = "INFO") -> None:
    """Configure root and application logging handlers."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(_CredentialRedactingFilter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(numeric_level)
