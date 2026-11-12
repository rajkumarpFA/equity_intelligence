"""Tests for application settings and logging redaction."""

import logging

from app.core.config import Settings
from app.core.logging import _CredentialRedactingFilter


def test_cors_origin_parsing():
    """Verify comma-separated origins are trimmed and parsed into a list."""
    s = Settings(cors_origins="http://localhost:3000, http://127.0.0.1:3000 , ")
    assert s.cors_origin_list == ["http://localhost:3000", "http://127.0.0.1:3000"]


def test_upstox_configured_flag():
    """Verify upstox_configured detects token presence without leaking value."""
    s1 = Settings(upstox_access_token=None, upstox_analytics_token=None)
    assert s1.upstox_configured is False

    s2 = Settings(upstox_access_token="secret_token_123")
    assert s2.upstox_configured is True
    assert "secret_token_123" not in repr(s2.upstox_access_token)


def test_logging_credential_redaction():
    """Verify log filter redacts bearer tokens."""
    filter_ = _CredentialRedactingFilter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Authorization: Bearer my_super_secret_jwt_token",
        args=(),
        exc_info=None,
    )
    filter_.filter(record)
    assert "my_super_secret_jwt_token" not in record.msg
    assert "Bearer [REDACTED]" in record.msg
