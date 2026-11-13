"""Unit and integration tests for Phase 9: Screening Engine."""

import csv
import io

import pytest
from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.screening.compiler import evaluate_condition, evaluate_expression
from app.screening.models import (
    FilterCondition,
    FilterExpression,
    SavedScreenCreate,
    ScreenedCompanyItem,
    ScreenRequest,
)
from app.services.screening_service import ScreeningService


@pytest.fixture
def sample_industrial_item() -> ScreenedCompanyItem:
    return ScreenedCompanyItem(
        company_id=1,
        company_name="Titan Company Limited",
        isin="INE280A01028",
        symbol="TITAN",
        exchange="NSE",
        sector_name="Consumer Discretionary",
        industry_name="Gems & Jewellery",
        is_financial_sector=False,
        current_price=3250.0,
        market_cap_cr=288000.0,
        pe_ratio=38.5,
        pb_ratio=11.2,
        roce_pct=24.5,
        roe_pct=28.2,
        operating_margin_pct=11.5,
        net_profit_margin_pct=7.5,
        debt_to_equity=0.28,
        interest_coverage=12.5,
        current_ratio=1.85,
        quick_ratio=0.72,
        cash_conversion_cycle_days=115.0,
        revenue_cagr_3y=22.5,
        pat_cagr_3y=18.2,
        altman_z_score=5.12,
        altman_zone="SAFE",
        piotroski_f_score=8,
        piotroski_rating="VERY_STRONG",
    )


@pytest.fixture
def sample_banking_item() -> ScreenedCompanyItem:
    return ScreenedCompanyItem(
        company_id=2,
        company_name="HDFC Bank Limited",
        isin="INE040A01034",
        symbol="HDFCBANK",
        exchange="NSE",
        sector_name="Financial Services",
        industry_name="Private Sector Bank",
        is_financial_sector=True,
        current_price=1650.0,
        market_cap_cr=1250000.0,
        pe_ratio=18.5,
        pb_ratio=2.6,
        roce_pct=None,  # Bypassed
        roe_pct=16.8,
        operating_margin_pct=None,
        net_profit_margin_pct=None,
        debt_to_equity=None,  # Bypassed
        interest_coverage=None,  # Bypassed
        current_ratio=None,  # Bypassed
        quick_ratio=None,
        cash_conversion_cycle_days=None,  # Bypassed
        revenue_cagr_3y=14.2,
        pat_cagr_3y=16.5,
        altman_z_score=None,  # Bypassed
        altman_zone="UNAVAILABLE",
        piotroski_f_score=7,
        piotroski_rating="MODERATE",
        net_interest_margin_pct=4.15,
        casa_ratio_pct=42.5,
        gross_npa_pct=1.24,
        capital_adequacy_ratio_pct=18.8,
    )


# -------------------------------------------------------------
# 1. Compiler Unit Tests
# -------------------------------------------------------------


def test_compiler_numeric_comparison(sample_industrial_item: ScreenedCompanyItem):
    """Test numeric operators (>, >=, <, <=, ==)."""
    # ROCE >= 20 -> True
    c1 = FilterCondition(field="roce", operator=">=", value=20.0)
    assert evaluate_condition(sample_industrial_item, c1) is True

    # ROCE > 30 -> False
    c2 = FilterCondition(field="roce", operator=">", value=30.0)
    assert evaluate_condition(sample_industrial_item, c2) is False

    # D/E <= 0.5 -> True
    c3 = FilterCondition(field="debt_to_equity", operator="<=", value=0.5)
    assert evaluate_condition(sample_industrial_item, c3) is True


def test_compiler_between_operator(sample_industrial_item: ScreenedCompanyItem):
    """Test between operator."""
    c1 = FilterCondition(field="pe", operator="between", value=30.0, second_value=40.0)
    assert evaluate_condition(sample_industrial_item, c1) is True

    c2 = FilterCondition(field="pe", operator="between", value=10.0, second_value=25.0)
    assert evaluate_condition(sample_industrial_item, c2) is False


def test_compiler_null_data_integrity(sample_banking_item: ScreenedCompanyItem):
    """Data Integrity Rule: None is never 0 and never satisfies numeric bounds."""
    # Bank has debt_to_equity = None
    c1 = FilterCondition(field="debt_to_equity", operator="<=", value=0.5)
    assert evaluate_condition(sample_banking_item, c1) is False

    # Bank has altman_z_score = None
    c2 = FilterCondition(field="altman_z_score", operator=">=", value=2.9)
    assert evaluate_condition(sample_banking_item, c2) is False


def test_compiler_string_and_categorical(sample_industrial_item: ScreenedCompanyItem):
    """Test sector name matching (contains, in, ==)."""
    c1 = FilterCondition(field="sector", operator="contains", value="Consumer")
    assert evaluate_condition(sample_industrial_item, c1) is True

    c2 = FilterCondition(field="sector", operator="in", value=["Information Technology", "Consumer Discretionary"])
    assert evaluate_condition(sample_industrial_item, c2) is True

    c3 = FilterCondition(field="sector", operator="not_in", value=["Financial Services"])
    assert evaluate_condition(sample_industrial_item, c3) is True


def test_compiler_ast_conjunction(
    sample_industrial_item: ScreenedCompanyItem, sample_banking_item: ScreenedCompanyItem
):
    """Test AND / OR conjunctions."""
    expr_and = FilterExpression(
        conjunction="AND",
        conditions=[
            FilterCondition(field="roce", operator=">=", value=20.0),
            FilterCondition(field="debt_to_equity", operator="<=", value=0.5),
        ],
    )
    assert evaluate_expression(sample_industrial_item, expr_and) is True
    assert evaluate_expression(sample_banking_item, expr_and) is False

    expr_or = FilterExpression(
        conjunction="OR",
        conditions=[
            FilterCondition(field="roce", operator=">=", value=20.0),
            FilterCondition(field="is_financial_sector", operator="==", value=True),
        ],
    )
    assert evaluate_expression(sample_industrial_item, expr_or) is True
    assert evaluate_expression(sample_banking_item, expr_or) is True


# -------------------------------------------------------------
# 2. Screening Service Tests
# -------------------------------------------------------------


def test_screening_service_universe_and_run():
    """Verify ScreeningService extracts active universe and filters correctly."""
    with SessionLocal() as db:
        svc = ScreeningService(db)
        universe = svc.get_screening_universe()
        assert len(universe) >= 7

        # Run screen for all stocks
        req_all = ScreenRequest()
        res_all = svc.run_screen(req_all)
        assert res_all.total_count == len(universe)

        # Run screen for ROCE >= 15
        req_roce = ScreenRequest(
            filter_expression=FilterExpression(
                conjunction="AND",
                conditions=[FilterCondition(field="roce", operator=">=", value=15.0)],
            )
        )
        res_roce = svc.run_screen(req_roce)
        assert res_roce.total_count >= 1
        for item in res_roce.items:
            assert item.roce_pct is not None
            assert item.roce_pct >= 15.0


def test_screening_service_banking_isolation():
    """Verify include_financials=False cleanly removes banks."""
    with SessionLocal() as db:
        svc = ScreeningService(db)
        req_no_fin = ScreenRequest(include_financials=False)
        res_no_fin = svc.run_screen(req_no_fin)

        for item in res_no_fin.items:
            assert item.is_financial_sector is False


def test_screening_service_export_csv():
    """Verify CSV export formatting and headers."""
    with SessionLocal() as db:
        svc = ScreeningService(db)
        req = ScreenRequest()
        csv_str = svc.export_screen_csv(req)

        reader = csv.reader(io.StringIO(csv_str))
        rows = list(reader)
        assert len(rows) >= 8  # Header + at least 7 benchmark companies
        header = rows[0]
        assert "Company Name" in header
        assert "Symbol" in header
        assert "P/E" in header
        assert "ROCE %" in header
        assert "Altman Z-Score" in header


def test_screening_service_presets():
    """Verify built-in institutional presets."""
    with SessionLocal() as db:
        svc = ScreeningService(db)
        presets = svc.get_preset_screens()
        assert len(presets) == 5
        names = [p.name for p in presets]
        assert "Buffett Moats" in names
        assert "High Growth Compounders" in names
        assert "Low Debt Cannibals" in names
        assert "Value Dividend Kings" in names
        assert "Institutional Financial Titans" in names


def test_screening_service_saved_screen_crud():
    """Test create, read, update, delete on SavedScreen."""
    with SessionLocal() as db:
        svc = ScreeningService(db)
        name = "Test Quality Compounders"

        # Cleanup if exists
        screens = svc.list_saved_screens()
        for s in screens:
            if s.name == name:
                svc.delete_saved_screen(s.id)

        # 1. Create
        payload = SavedScreenCreate(
            name=name,
            description="Testing screen creation",
            filter_expression=FilterExpression(
                conjunction="AND",
                conditions=[FilterCondition(field="roce", operator=">=", value=20.0)],
            ),
            sort_by="roce",
            sort_direction="desc",
        )
        saved = svc.create_saved_screen(payload)
        assert saved.id is not None
        assert saved.name == name

        # 2. Get
        fetched = svc.get_saved_screen(saved.id)
        assert fetched.name == name

        # 3. Delete
        del_res = svc.delete_saved_screen(saved.id)
        assert del_res is True


# -------------------------------------------------------------
# 3. API Integration Tests (TestClient)
# -------------------------------------------------------------


def test_api_screener_run():
    client = TestClient(app)
    payload = {
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "market_cap", "operator": ">=", "value": 1000.0}
            ],
        },
        "sort_by": "market_cap",
        "sort_direction": "desc",
        "page": 1,
        "page_size": 10,
    }
    resp = client.post("/api/v1/screening/run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_count" in data
    assert "items" in data
    assert data["page"] == 1
    assert len(data["items"]) >= 1


def test_api_screener_export_csv():
    client = TestClient(app)
    payload = {
        "filter_expression": {"conjunction": "AND", "conditions": []},
        "sort_by": "market_cap",
        "sort_direction": "desc",
    }
    resp = client.post("/api/v1/screening/export-csv", json=payload)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment; filename=screener_export.csv" in resp.headers.get("content-disposition", "")
    assert "Company Name,Symbol,Exchange" in resp.text


def test_api_screener_presets():
    client = TestClient(app)
    resp = client.get("/api/v1/screening/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert len(presets) == 5
    assert presets[0]["is_preset"] is True
