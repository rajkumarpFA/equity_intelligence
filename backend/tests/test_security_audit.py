"""Comprehensive Security, Hardening & Data Protection Audit Test Suite.

Validates:
1. Strict CORS origin enforcement and header integrity.
2. Defensive security headers (nosniff, DENY, strict-origin-when-cross-origin).
3. SQL Injection Immunity (static AST audit of repositories/services + dynamic payload tests).
4. File Upload Hardening (extension whitelist, PDF magic bytes validation, max file size bounds, path traversal safety).
5. Secret Masking (database connection string credential redaction, SecretStr protections).
"""

import ast
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. CORS Origin Enforcement & Preflight Tests
# ---------------------------------------------------------------------------

def test_cors_allowed_origin():
    """Verify that requests from authorized frontend origins receive valid CORS headers."""
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_disallowed_origin_rejected():
    """Verify that unauthorized cross-origin requests do not receive an access grant."""
    response = client.get(
        "/api/v1/health",
        headers={"Origin": "http://malicious-attacker-domain.xyz"},
    )
    assert response.status_code == 200
    allow_origin = response.headers.get("access-control-allow-origin")
    # Disallowed origin must not be reflected or granted wildcard
    assert allow_origin != "http://malicious-attacker-domain.xyz"
    assert allow_origin != "*"


def test_cors_options_preflight():
    """Verify OPTIONS preflight behavior for allowed origin."""
    response = client.options(
        "/api/v1/companies",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


# ---------------------------------------------------------------------------
# 2. Defensive Security Headers
# ---------------------------------------------------------------------------

def test_defensive_security_headers_present():
    """Verify that essential defensive security headers are appended to all responses."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


# ---------------------------------------------------------------------------
# 3. SQL Injection Parameterization Audit (Static & Dynamic)
# ---------------------------------------------------------------------------

def test_static_ast_sql_injection_audit():
    """Static AST audit scanning all repository & service files.

    Ensures zero instances of raw string interpolation (f-string, %-formatting,
    .format()) inside calls to session.execute() or text().
    """
    repo_dirs = [
        Path("app/repositories"),
        Path("app/services"),
        Path("app/calculations"),
    ]
    violations = []

    for base_dir in repo_dirs:
        for py_path in base_dir.rglob("*.py"):
            try:
                tree = ast.parse(py_path.read_text(encoding="utf-8"), filename=str(py_path))
            except Exception as e:
                pytest.fail(f"Could not parse {py_path}: {e}")

            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    # Check text(f"...") or execute(f"...")
                    func_name = ""
                    if isinstance(node.func, ast.Name):
                        func_name = node.func.id
                    elif isinstance(node.func, ast.Attribute):
                        func_name = node.func.attr

                    if func_name in ("text", "execute") and node.args:
                        first_arg = node.args[0]
                        if isinstance(first_arg, ast.JoinedStr):
                            violations.append(f"{py_path}:{node.lineno} -> {func_name}(f\"...\") interpolation")
                        elif isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, ast.Mod):
                            violations.append(f"{py_path}:{node.lineno} -> {func_name}(\"...\" % ...)")
                        elif isinstance(first_arg, ast.Call) and isinstance(first_arg.func, ast.Attribute) and first_arg.func.attr == "format":
                            violations.append(f"{py_path}:{node.lineno} -> {func_name}(\"...\".format(...))")

    assert not violations, f"SQL injection vulnerability detected:\n" + "\n".join(violations)


def test_dynamic_sql_injection_payload_handling(db_session: Session):
    """Dynamic test verifying SQL injection payloads are treated as literal strings and do not crash or corrupt the DB."""
    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE companies; --",
        "UNION SELECT NULL, NULL, NULL --",
        "1' OR SLEEP(5) --",
    ]

    for payload in payloads:
        # 1. Company search endpoint
        resp = client.get("/api/v1/companies", params={"search": payload})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data.get("items"), list)

        # 2. Screener filter endpoint with payload
        resp_scr = client.post(
            "/api/v1/screening/run",
            json={
                "page": 1,
                "page_size": 10,
                "sort_by": payload,  # Attempt injection via sort field
                "sort_order": "asc",
            },
        )
        # Should gracefully return 200 with sanitized sorting or 422, never 500
        assert resp_scr.status_code in (200, 400, 422)

    # Verify database table still exists and is healthy
    result = db_session.execute(text("SELECT count(*) FROM companies")).scalar()
    assert result is not None


# ---------------------------------------------------------------------------
# 4. File Upload Hardening Tests
# ---------------------------------------------------------------------------

def test_file_upload_disallowed_extension_rejected():
    """Verify that uploading files with dangerous executable extensions is rejected with 400."""
    dangerous_files = [
        ("malicious.exe", b"\x4d\x5a\x90\x00", "application/octet-stream"),
        ("exploit.sh", b"#!/bin/bash\nrm -rf /", "text/x-shellscript"),
        ("webshell.php", b"<?php system($_GET['cmd']); ?>", "application/x-php"),
        ("vector.svg", b"<svg onload=alert(1)></svg>", "image/svg+xml"),
    ]

    for filename, content, mime in dangerous_files:
        resp = client.post(
            "/api/v1/ingestion/upload/report",
            files={"file": (filename, content, mime)},
            data={"document_type": "ANNUAL_REPORT"},
        )
        assert resp.status_code == 400, f"Expected 400 for {filename}, got {resp.status_code}"
        assert "unsupported file" in resp.json()["detail"].lower()


def test_file_upload_pdf_magic_bytes_validation():
    """Verify that uploading a fake PDF (wrong magic bytes) is detected and rejected."""
    fake_pdf = b"NOT_A_PDF_HEADER_JUST_RANDOM_TEXT"
    resp = client.post(
        "/api/v1/ingestion/upload/report",
        files={"file": ("fake_annual_report.pdf", fake_pdf, "application/pdf")},
        data={"document_type": "ANNUAL_REPORT"},
    )
    assert resp.status_code == 400
    assert "pdf" in resp.json()["detail"].lower()


def test_file_upload_valid_pdf_accepted():
    """Verify that a valid PDF with correct magic header is processed cleanly."""
    valid_pdf = b"%PDF-1.4\n%EOF\nDummy Valid Test PDF Content"
    resp = client.post(
        "/api/v1/ingestion/upload/report",
        files={"file": ("valid_annual_report.pdf", valid_pdf, "application/pdf")},
        data={"document_type": "ANNUAL_REPORT"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["file_name"] == "valid_annual_report.pdf"
    assert data["mime_type"] == "application/pdf"


def test_portfolio_csv_import_disallowed_extension():
    """Verify that the broker tradebook import endpoint strictly rejects non-CSV files."""
    resp = client.post(
        "/api/v1/portfolios/1/import-csv",
        files={"file": ("trades.xlsx", b"PK\x03\x04ExcelContent", "application/vnd.ms-excel")},
    )
    assert resp.status_code == 400
    assert "broker tradebook must be a .csv file" in resp.json()["detail"].lower()


def test_portfolio_csv_import_size_limit():
    """Verify that the broker tradebook import endpoint enforces the 15MB size ceiling."""
    oversized_csv = b"trade_date,symbol,type,quantity,price\n" + (b"2026-01-01,TCS,BUY,1,3500\n" * 700_000)
    # Ensure byte length exceeds 15MB
    assert len(oversized_csv) > 15 * 1024 * 1024

    resp = client.post(
        "/api/v1/portfolios/1/import-csv",
        files={"file": ("huge_tradebook.csv", oversized_csv, "text/csv")},
    )
    assert resp.status_code == 413
    assert "15 mb" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 5. Secret Masking & Redaction Tests
# ---------------------------------------------------------------------------

def test_database_url_credential_masking():
    """Verify that sanitized_database_url completely redacts database passwords."""
    settings = get_settings()
    sanitized = settings.sanitized_database_url
    assert "equity_local_password" not in sanitized
    assert ":***@" in sanitized
    assert sanitized.startswith("postgresql+psycopg://equity_user:***@")


def test_config_secret_str_masking():
    """Verify that sensitive API tokens are protected by SecretStr and not exposed in repr()."""
    from pydantic import SecretStr
    from app.core.config import Settings

    custom_settings = Settings(
        upstox_access_token=SecretStr("sensitive_upstox_token_12345"),
        upstox_analytics_token=SecretStr("sensitive_analytics_token_67890"),
    )
    settings_repr = repr(custom_settings)
    assert "sensitive_upstox_token_12345" not in settings_repr
    assert "sensitive_analytics_token_67890" not in settings_repr
    assert "**********" in settings_repr
