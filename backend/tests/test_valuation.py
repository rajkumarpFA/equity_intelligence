"""Unit and integration tests for Phase 12: Valuation Workbench."""

import pytest
from fastapi.testclient import TestClient

from app.calculations.valuation import (
    calculate_dcf,
    calculate_dcf_sensitivity_matrix,
    calculate_dividend_discount_model,
    calculate_graham_formula,
    calculate_historical_multiples_valuation,
    calculate_reverse_dcf,
)
from app.db.session import SessionLocal
from app.main import app
from app.models.company import Company, Exchange, Security
from app.models.valuation import SavedValuation

# ─── 1. Mathematical Unit Tests ──────────────────────────────────────────────


def test_calculate_dcf_standard():
    """Verify DCF computation with Gordon Growth Terminal Value."""
    result = calculate_dcf(
        latest_revenue=10000.0,
        latest_ebit=2000.0,
        latest_tax_rate=0.25,
        shares_outstanding=1000.0,
        total_debt=1000.0,
        cash_and_equivalents=500.0,
        current_price=15.0,
        growth_rates=[0.15, 0.14, 0.13, 0.12, 0.10],
        operating_margins=[0.20, 0.20, 0.20, 0.20, 0.20],
        tax_rate=0.25,
        reinvestment_rates=[0.30, 0.30, 0.30, 0.30, 0.30],
        wacc=0.12,
        terminal_growth_rate=0.05,
        use_exit_multiple=False,
    )

    assert result["model"] == "DCF"
    assert result["terminal_value_method"] == "GORDON_GROWTH"
    assert len(result["projections"]) == 5
    assert result["enterprise_value"] > 0
    assert result["intrinsic_value_per_share"] > 0
    assert isinstance(result["margin_of_safety_pct"], float)
    assert result["is_undervalued"] == (result["intrinsic_value_per_share"] > 15.0)


def test_calculate_dcf_exit_multiple():
    """Verify DCF computation with EV/EBITDA Exit Multiple Terminal Value."""
    result = calculate_dcf(
        latest_revenue=5000.0,
        latest_ebit=1000.0,
        latest_tax_rate=0.25,
        shares_outstanding=500.0,
        total_debt=200.0,
        cash_and_equivalents=100.0,
        current_price=20.0,
        growth_rates=[0.10, 0.10, 0.10],
        operating_margins=[0.20, 0.20, 0.20],
        tax_rate=0.25,
        reinvestment_rates=[0.25, 0.25, 0.25],
        wacc=0.11,
        terminal_growth_rate=0.04,
        terminal_exit_multiple=12.0,
        use_exit_multiple=True,
    )

    assert result["terminal_value_method"] == "EXIT_MULTIPLE"
    assert result["intrinsic_value_per_share"] > 0


def test_calculate_dcf_wacc_guard():
    """Verify that WACC <= terminal_growth_rate raises ValueError for Gordon Growth."""
    with pytest.raises(ValueError, match="must be strictly greater than"):
        calculate_dcf(
            latest_revenue=1000.0,
            latest_ebit=200.0,
            latest_tax_rate=0.25,
            shares_outstanding=100.0,
            total_debt=50.0,
            cash_and_equivalents=20.0,
            current_price=10.0,
            growth_rates=[0.10],
            operating_margins=[0.20],
            tax_rate=0.25,
            reinvestment_rates=[0.30],
            wacc=0.05,
            terminal_growth_rate=0.06,
        )


def test_calculate_reverse_dcf():
    """Verify Reverse DCF bisection finds the market-implied growth rate."""
    result = calculate_reverse_dcf(
        current_price=25.0,
        latest_revenue=5000.0,
        latest_ebit=1000.0,
        latest_tax_rate=0.25,
        shares_outstanding=500.0,
        total_debt=200.0,
        cash_and_equivalents=100.0,
        operating_margin=0.20,
        wacc=0.12,
        terminal_growth_rate=0.05,
        projection_years=5,
    )

    assert result["model"] == "REVERSE_DCF"
    assert "implied_revenue_growth_pct" in result
    implied_g = result["implied_revenue_growth_pct"]
    assert -40.0 <= implied_g <= 100.0


def test_calculate_dcf_sensitivity_matrix():
    """Verify 5x5 sensitivity matrix generates 5 rows and 5 columns."""
    result = calculate_dcf_sensitivity_matrix(
        latest_revenue=5000.0,
        latest_ebit=1000.0,
        latest_tax_rate=0.25,
        shares_outstanding=500.0,
        total_debt=200.0,
        cash_and_equivalents=100.0,
        current_price=20.0,
        base_growth_rate=0.12,
        base_operating_margin=0.20,
        base_wacc=0.12,
        base_terminal_growth=0.05,
    )

    assert len(result["matrix"]) == 5
    assert len(result["tg_headers"]) == 5
    for row in result["matrix"]:
        assert len(row["values"]) == 5


def test_calculate_historical_multiples_valuation():
    """Verify percentile calculation for historical multiples."""
    result = calculate_historical_multiples_valuation(
        latest_eps=25.0,
        latest_bvps=120.0,
        latest_ebitda=1500.0,
        shares_outstanding=100.0,
        total_debt=200.0,
        cash_and_equivalents=100.0,
        current_price=600.0,
        historical_pe_ratios=[18.0, 22.0, 25.0, 28.0, 32.0],
        historical_pb_ratios=[3.0, 4.0, 5.0, 6.0, 7.0],
        historical_ev_ebitda_ratios=[10.0, 12.0, 14.0, 16.0, 18.0],
    )

    assert result["pe"]["bands"]["median"] == 25.0
    assert result["pe"]["implied_target_price"] == 25.0 * 25.0
    assert result["pb"]["bands"]["median"] == 5.0
    assert result["pb"]["implied_target_price"] == 5.0 * 120.0
    assert result["ev_ebitda"]["implied_target_price"] is not None


def test_calculate_ddm_standard():
    """Verify Gordon Growth DDM calculates fair value."""
    result = calculate_dividend_discount_model(
        latest_dps=12.0,
        cost_of_equity=0.13,
        dividend_growth_rate=0.06,
        current_price=160.0,
    )

    assert result["is_applicable"] is True
    # D1 = 12 * 1.06 = 12.72. P = 12.72 / (0.13 - 0.06) = 181.71
    assert pytest.approx(result["intrinsic_value"], 0.1) == 181.71
    assert result["is_undervalued"] is True


def test_calculate_ddm_no_dividends_bypass():
    """Verify non-dividend paying stock is cleanly bypassed."""
    result = calculate_dividend_discount_model(
        latest_dps=0.0,
        cost_of_equity=0.13,
        dividend_growth_rate=0.06,
        current_price=100.0,
    )

    assert result["is_applicable"] is False
    assert result["bypass_reason"] == "NO_DIVIDENDS_PAID"
    assert result["intrinsic_value"] is None


def test_calculate_graham_formula_and_number():
    """Verify Benjamin Graham intrinsic formula and Graham Number."""
    result = calculate_graham_formula(
        latest_eps=40.0,
        latest_bvps=250.0,
        expected_growth_rate=0.12,  # 12%
        current_price=1200.0,
        aaa_bond_yield=7.1,
    )

    assert result["is_applicable"] is True
    assert result["graham_value"] is not None
    # Graham number = sqrt(22.5 * 40 * 250) = sqrt(225000) = 474.34
    assert pytest.approx(result["graham_number"], 0.1) == 474.34


def test_calculate_graham_negative_eps_bypass():
    """Verify negative EPS bypasses Graham model."""
    result = calculate_graham_formula(
        latest_eps=-5.0,
        latest_bvps=50.0,
        expected_growth_rate=0.10,
        current_price=100.0,
    )

    assert result["is_applicable"] is False
    assert result["bypass_reason"] == "NEGATIVE_OR_ZERO_EPS"


# ─── 2. Integration & API Endpoint Tests ─────────────────────────────────────


@pytest.fixture
def valuation_test_company():
    """Create or fetch a test company for valuation tests."""
    with SessionLocal() as db:
        company = db.query(Company).filter(Company.cin == "L99999MH2020PLC999999").first()
        if not company:
            company = Company(
                name="Valuation Engine Test Ltd",
                legal_name="Valuation Engine Test Limited",
                isin="INE999V01019",
                cin="L99999MH2020PLC999999",
                is_financial_sector=False,
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        exchange = db.query(Exchange).first()
        if not exchange:
            exchange = Exchange(code="NSE", name="National Stock Exchange", country="India")
            db.add(exchange)
            db.commit()
            db.refresh(exchange)

        sec = db.query(Security).filter(Security.company_id == company.id, Security.symbol == "VALTEST").first()
        if not sec:
            sec = Security(
                company_id=company.id,
                exchange_id=exchange.id,
                symbol="VALTEST",
                series="EQ",
                is_primary=True,
            )
            db.add(sec)
            db.commit()

        yield company


@pytest.fixture
def banking_test_company():
    """Create or fetch a test bank for financial sector bypass tests."""
    with SessionLocal() as db:
        bank = db.query(Company).filter(Company.cin == "L65191TN2020PLC888888").first()
        if not bank:
            bank = Company(
                name="Apex Commercial Bank Ltd",
                legal_name="Apex Commercial Bank Limited",
                isin="INE888B01018",
                cin="L65191TN2020PLC888888",
                is_financial_sector=True,
            )
            db.add(bank)
            db.commit()
            db.refresh(bank)

        exchange = db.query(Exchange).first()
        sec = db.query(Security).filter(Security.company_id == bank.id, Security.symbol == "APEXBANK").first()
        if not sec:
            sec = Security(
                company_id=bank.id,
                exchange_id=exchange.id,
                symbol="APEXBANK",
                series="EQ",
                is_primary=True,
            )
            db.add(sec)
            db.commit()

        yield bank


def test_api_dcf_endpoint(valuation_test_company):
    client = TestClient(app)
    payload = {
        "company_id": valuation_test_company.id,
        "assumptions": {
            "forecast_years": 5,
            "revenue_growth_rates": [0.15, 0.14, 0.13, 0.12, 0.10],
            "operating_margins": [0.20, 0.20, 0.20, 0.20, 0.20],
            "tax_rate": 0.25,
            "reinvestment_rates": [0.30, 0.30, 0.30, 0.30, 0.30],
            "wacc": 0.12,
            "terminal_growth_rate": 0.05,
            "terminal_method": "GORDON_GROWTH",
        },
        "current_price": 250.0,
    }

    res = client.post("/api/v1/valuation/dcf", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "DCF"
    assert data["status"] == "SUCCESS"
    assert data["intrinsic_value_per_share"] > 0
    assert len(data["projections"]) == 5


def test_api_reverse_dcf_endpoint(valuation_test_company):
    client = TestClient(app)
    payload = {
        "company_id": valuation_test_company.id,
        "current_price": 250.0,
        "wacc": 0.12,
        "terminal_growth_rate": 0.05,
        "projection_years": 5,
    }

    res = client.post("/api/v1/valuation/reverse-dcf", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "REVERSE_DCF"
    assert "implied_revenue_growth_pct" in data


def test_api_sensitivity_endpoint(valuation_test_company):
    client = TestClient(app)
    payload = {
        "company_id": valuation_test_company.id,
        "base_growth_rate": 0.12,
        "base_operating_margin": 0.20,
        "base_wacc": 0.12,
        "base_terminal_growth": 0.05,
        "current_price": 250.0,
    }

    res = client.post("/api/v1/valuation/sensitivity", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["matrix"]) == 5
    assert len(data["tg_headers"]) == 5


def test_api_valuation_summary_endpoint(valuation_test_company):
    client = TestClient(app)
    res = client.get(f"/api/v1/valuation/{valuation_test_company.id}/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == valuation_test_company.id
    assert data["symbol"] == "VALTEST"
    assert "dcf" in data
    assert "historical_multiples" in data
    assert "graham" in data


def test_financial_sector_dcf_bypass(banking_test_company):
    """Verify that a banking company triggers the financial sector guard for DCF."""
    client = TestClient(app)
    payload = {
        "company_id": banking_test_company.id,
        "assumptions": {
            "forecast_years": 5,
            "revenue_growth_rates": [0.12, 0.12, 0.12, 0.12, 0.12],
            "operating_margins": [0.20, 0.20, 0.20, 0.20, 0.20],
            "tax_rate": 0.25,
            "reinvestment_rates": [0.30, 0.30, 0.30, 0.30, 0.30],
            "wacc": 0.12,
            "terminal_growth_rate": 0.05,
        },
    }

    res = client.post("/api/v1/valuation/dcf", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "BYPASSED"
    assert "Commercial banks and lending institutions cannot use FCFF" in data["reason"]


def test_api_saved_valuation_crud(valuation_test_company):
    client = TestClient(app)

    # 1. Create saved valuation
    save_payload = {
        "company_id": valuation_test_company.id,
        "model_type": "DCF",
        "scenario_name": "BULL_CASE_2027",
        "intrinsic_value": 450.0,
        "current_price_at_run": 250.0,
        "margin_of_safety_pct": 44.44,
        "assumptions": {"wacc": 0.11, "terminal_growth": 0.06},
        "projections": [{"year": 1, "revenue": 1000}],
        "notes": "Testing high growth assumptions",
    }
    create_res = client.post("/api/v1/valuation/saved", json=save_payload)
    assert create_res.status_code == 201
    created_val = create_res.json()
    val_id = created_val["id"]
    assert created_val["scenario_name"] == "BULL_CASE_2027"

    # 2. List saved valuations
    list_res = client.get(f"/api/v1/valuation/saved?company_id={valuation_test_company.id}")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(item["id"] == val_id for item in items)

    # 3. Delete saved valuation
    del_res = client.delete(f"/api/v1/valuation/saved/{val_id}")
    assert del_res.status_code == 204

    # Verify deleted
    with SessionLocal() as db:
        assert db.get(SavedValuation, val_id) is None
