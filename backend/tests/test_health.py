"""Tests for health check endpoints."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ping_endpoint():
    """Verify lightweight ping liveness probe."""
    response = client.get("/api/v1/health/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_health_healthy_when_database_connected():
    """Verify health endpoint returns 200 when database probe succeeds."""
    mock_db = {
        "connected": True,
        "latency_ms": 1.25,
        "error": None,
    }
    with patch("app.api.v1.endpoints.health.check_db_connectivity", return_value=mock_db):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"]["connected"] is True
        assert data["database"]["latency_ms"] == 1.25
        assert data["app_name"] == "Equity Intelligence"


def test_health_503_degraded_when_database_fails():
    """Verify health endpoint returns 503 degraded status when database is disconnected."""
    mock_db = {
        "connected": False,
        "latency_ms": 50.0,
        "error": "ConnectionRefusedError: Connection refused",
    }
    with patch("app.api.v1.endpoints.health.check_db_connectivity", return_value=mock_db):
        response = client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"]["connected"] is False
        assert "ConnectionRefusedError" in data["database"]["error"]
