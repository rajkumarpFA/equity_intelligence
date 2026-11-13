"""Tests for Phase 8: Financial Analysis Engine, DuPont decomposition, and Quality Scores."""

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.calculations.growth import calculate_cagr, calculate_yoy_growth
from app.calculations.profitability import (
    dupont_analysis,
    ebitda_margin,
    net_profit_margin,
    operating_margin,
    return_on_assets,
    return_on_capital_employed,
    return_on_equity,
)
from app.calculations.solvency import (
    current_ratio,
    debt_to_assets,
    debt_to_equity,
    interest_coverage,
    quick_ratio,
)
from app.calculations.efficiency import (
    asset_turnover,
    cash_conversion_cycle,
    creditor_days,
    debtor_days,
    inventory_days,
    working_capital_days,
)
from app.calculations.scores import (
    calculate_altman_z_score,
    calculate_piotroski_f_score,
)
from app.calculations.banking import (
    capital_adequacy_ratio,
    casa_ratio,
    cost_to_income_ratio,
    net_interest_margin,
    npa_pct,
)
from app.models.company import Company, Exchange, Security
from app.models.financials import FinancialMetric, FinancialStatement, FinancialFact
from app.services.analysis_service import AnalysisService
from app.services.financial_statement_service import FinancialStatementService


# -------------------------------------------------------------
# 1. Mathematical Unit Tests (Deterministic Calculation Engine)
# -------------------------------------------------------------

def test_cagr_calculation_accuracy():
    """Verify CAGR mathematical formula: (End / Start)**(1/n) - 1."""
    # Doubling in 3 years: 2 ** (1/3) - 1 = 25.99%
    cagr = calculate_cagr(100.0, 200.0, 3)
    assert cagr == 25.99

    # 100 to 161.05 in 5 years: 10.0%
    cagr_5y = calculate_cagr(100.0, 161.051, 5)
    assert cagr_5y == 10.0


def test_cagr_edge_case_guards():
    """Verify CAGR edge cases: zero denominator, negative base, negative end."""
    assert calculate_cagr(0, 100, 3) is None
    assert calculate_cagr(-50, 100, 3) is None
    assert calculate_cagr(100, -20, 3) is None
    assert calculate_cagr(100, 200, 0) is None
    assert calculate_cagr(None, 200, 3) is None
    assert calculate_cagr(100, None, 3) is None


def test_yoy_growth_calculation():
    """Verify YoY growth formula: ((Curr - Prev) / abs(Prev)) * 100."""
    assert calculate_yoy_growth(120.0, 100.0) == 20.0
    assert calculate_yoy_growth(80.0, 100.0) == -20.0
    # From negative to positive
    assert calculate_yoy_growth(50.0, -100.0) == 150.0
    assert calculate_yoy_growth(100.0, 0) is None


def test_profitability_margins():
    """Verify operating margin, ebitda margin, and net profit margin."""
    revenue = 1000.0
    ebit = 200.0
    ebitda = 250.0
    pat = 140.0

    assert operating_margin(ebit, revenue) == 20.0
    assert ebitda_margin(ebitda, revenue) == 25.0
    assert net_profit_margin(pat, revenue) == 14.0

    # Zero revenue guard
    assert operating_margin(ebit, 0) is None
    assert net_profit_margin(pat, 0) is None


def test_return_on_capital_metrics():
    """Verify ROE, ROCE, and ROA calculations."""
    pat = 150.0
    equity = 1000.0
    prev_equity = 900.0  # avg = 950.0
    # ROE = 150 / 950 = 15.79%
    assert return_on_equity(pat, equity, prev_equity) == 15.79

    # ROCE = EBIT / Capital Employed
    ebit = 220.0
    total_debt = 400.0
    total_equity = 1000.0
    # Capital Employed = 1400.0 -> 220 / 1400 = 15.71%
    assert return_on_capital_employed(ebit, total_debt=total_debt, total_equity=total_equity) == 15.71

    # Negative equity guard (wiped-out net worth)
    assert return_on_equity(pat, -500.0) is None


def test_dupont_3_stage_identity_verification():
    """Mathematically verify 3-stage DuPont decomposition: ROE = Margin * Turnover * Leverage."""
    pat = 180.0
    revenue = 1200.0
    assets = 2000.0
    equity = 800.0

    dupont = dupont_analysis(pat=pat, revenue=revenue, assets=assets, equity=equity)

    # Net Margin = 180 / 1200 = 15.0%
    assert dupont["net_profit_margin_pct"] == 15.0
    # Asset Turnover = 1200 / 2000 = 0.60x
    assert dupont["asset_turnover"] == 0.60
    # Financial Leverage = 2000 / 800 = 2.50x
    assert dupont["financial_leverage"] == 2.50

    # Calculated ROE = 15% * 0.60 * 2.50 = 22.50%
    assert dupont["calculated_roe_pct"] == 22.50
    # Direct ROE: 180 / 800 = 22.50%
    assert round((pat / equity) * 100, 2) == dupont["calculated_roe_pct"]


def test_solvency_and_liquidity_ratios():
    """Verify D/E, Interest Coverage, Current Ratio, and Quick Ratio."""
    debt = 450.0
    equity = 900.0
    assert debt_to_equity(debt, equity) == 0.50

    # Interest coverage
    ebit = 300.0
    interest = 60.0
    assert interest_coverage(ebit, interest) == 5.0
    assert interest_coverage(ebit, 0) is None  # Zero debt / zero interest

    # Current & Quick ratios
    ca = 400.0
    cl = 200.0
    inv = 80.0
    assert current_ratio(ca, cl) == 2.0
    assert quick_ratio(ca, inv, cl) == 1.60  # (400 - 80) / 200 = 1.6


def test_operating_efficiency_and_cash_conversion_cycle():
    """Verify DSO, DIO, DPO, and Cash Conversion Cycle (CCC)."""
    revenue = 1200.0
    receivables = 150.0
    inventory = 180.0
    payables = 90.0
    opex = 900.0

    dso = debtor_days(receivables, revenue)  # (150 / 1200) * 365 = 45.6 days
    dio = inventory_days(inventory, revenue)  # (180 / 1200) * 365 = 54.8 days
    dpo = creditor_days(payables, opex)  # (90 / 900) * 365 = 36.5 days

    assert dso == 45.6
    assert dio == 54.8
    assert dpo == 36.5

    # CCC = DIO + DSO - DPO = 54.8 + 45.6 - 36.5 = 63.9 days
    ccc = cash_conversion_cycle(dio, dso, dpo)
    assert ccc == 63.9


def test_altman_z_score_calculation():
    """Verify Altman Z-Score non-manufacturing and manufacturing models."""
    # Healthy company
    res = calculate_altman_z_score(
        working_capital=300.0,
        total_assets=1000.0,
        retained_earnings=400.0,
        ebit=200.0,
        book_equity=600.0,
        total_liabilities=400.0,
    )
    assert res["zone"] == "SAFE"
    assert res["score"] is not None and res["score"] > 2.60

    # Distressed company (negative working capital, negative EBIT)
    distressed = calculate_altman_z_score(
        working_capital=-200.0,
        total_assets=1000.0,
        retained_earnings=-300.0,
        ebit=-100.0,
        book_equity=50.0,
        total_liabilities=950.0,
    )
    assert distressed["zone"] == "DISTRESS"
    assert distressed["score"] is not None and distressed["score"] < 1.10


def test_piotroski_f_score_evaluation():
    """Verify 9-Factor Piotroski F-Score evaluation across current and prior period."""
    curr = {
        "pat": 150.0,
        "cfo": 180.0,  # CFO > PAT (+1)
        "total_assets": 1200.0,
        "long_term_debt": 200.0,
        "current_assets": 500.0,
        "current_liabilities": 250.0,  # CR = 2.0
        "equity_capital": 100.0,  # Stable equity
        "revenue": 1400.0,
    }
    prev = {
        "pat": 120.0,
        "cfo": 140.0,
        "total_assets": 1100.0,
        "long_term_debt": 250.0,  # Debt reduced
        "current_assets": 400.0,
        "current_liabilities": 220.0,  # CR = 1.81
        "equity_capital": 100.0,
        "revenue": 1200.0,
    }

    res = calculate_piotroski_f_score(curr, prev)
    assert res["score"] >= 8
    assert res["rating"] == "VERY_STRONG"
    assert res["profitability_score"] == 4  # All 4 profit points achieved


def test_banking_metrics_calculation():
    """Verify banking-specific Net Interest Margin, CASA %, Cost-to-Income %, and NPA %."""
    nii = 450.0
    assets = 15000.0
    assert net_interest_margin(nii, assets) == 3.0  # (450 / 15000) * 100 = 3.0%

    assert casa_ratio(0.425) == 42.5
    assert casa_ratio(42.5) == 42.5

    assert cost_to_income_ratio(200.0, 500.0) == 40.0
    assert npa_pct(0.0125) == 1.25  # 1.25% Net NPA
    assert capital_adequacy_ratio(0.185) == 18.5  # 18.5% CAR


# -------------------------------------------------------------
# 2. Service & Sector Isolation Integration Tests
# -------------------------------------------------------------

def test_banking_sector_isolation_in_service(db_session):
    """Verify strict isolation: Bank/NBFC bypasses D/E, Current Ratio, CCC, and Altman Z."""
    # Create a financial institution
    bank = Company(
        name="Test Bank Limited",
        legal_name="Test Bank Limited",
        isin="INE999B01019",
        is_financial_sector=True,  # Financial institution
        accounting_standard="IND-AS",
        status="ACTIVE",
    )
    db_session.add(bank)
    db_session.commit()
    db_session.refresh(bank)

    # Seed sample financials
    fs_service = FinancialStatementService(db_session)
    fs_service.seed_sample_financials(bank.id)

    analysis_service = AnalysisService(db_session)
    ratios = analysis_service.get_company_ratios(bank.id)

    # Solvency & Efficiency must be bypassed with explicit reason
    assert ratios.is_financial_sector is True
    assert ratios.solvency.is_applicable is False
    assert ratios.solvency.bypass_reason is not None
    assert ratios.solvency.debt_to_equity is None

    assert ratios.efficiency.is_applicable is False
    assert ratios.efficiency.bypass_reason is not None

    # Banking metrics must be active
    assert ratios.banking.is_applicable is True
    assert ratios.banking.net_interest_margin_pct is not None
    assert ratios.banking.casa_ratio_pct is not None

    # Quality scores: Altman Z must be bypassed for Bank
    q_scores = analysis_service.get_company_quality_scores(bank.id)
    assert q_scores.altman_z.is_applicable is False
    assert q_scores.altman_z.zone == "UNAVAILABLE"
    assert q_scores.altman_z.bypass_reason is not None


def test_industrial_company_analysis_in_service(db_session):
    """Verify industrial company gets full D/E, DuPont, Operating Efficiency, and Altman Z."""
    ind = Company(
        name="Industrial Manufacturing Ltd",
        legal_name="Industrial Manufacturing Ltd",
        isin="INE888M01018",
        is_financial_sector=False,
        accounting_standard="IND-AS",
        status="ACTIVE",
    )
    db_session.add(ind)
    db_session.commit()
    db_session.refresh(ind)

    # Seed sample financials
    fs_service = FinancialStatementService(db_session)
    fs_service.seed_sample_financials(ind.id)

    analysis_service = AnalysisService(db_session)
    ratios = analysis_service.get_company_ratios(ind.id)

    assert ratios.is_financial_sector is False
    assert ratios.solvency.is_applicable is True
    assert ratios.solvency.debt_to_equity is not None
    assert ratios.solvency.interest_coverage_ratio is not None

    assert ratios.profitability.operating_margin_pct is not None
    assert ratios.profitability.return_on_equity_pct is not None
    assert ratios.profitability.dupont.calculated_roe_pct is not None

    assert ratios.efficiency.is_applicable is True
    assert ratios.efficiency.asset_turnover is not None

    # Quality scores
    q_scores = analysis_service.get_company_quality_scores(ind.id)
    assert q_scores.altman_z.is_applicable is True
    assert q_scores.altman_z.score is not None
    assert q_scores.piotroski_f.score is not None
    assert q_scores.piotroski_f.max_score == 9


# -------------------------------------------------------------
# 3. FastAPI REST Endpoint Tests
# -------------------------------------------------------------

def test_api_company_ratios_endpoint(client: TestClient, db_session):
    """Verify GET /api/v1/companies/{id}/ratios."""
    company = Company(
        name="Apex Industrial Ltd",
        isin="INE777A01017",
        is_financial_sector=False,
        status="ACTIVE",
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    fs_service = FinancialStatementService(db_session)
    fs_service.seed_sample_financials(company.id)

    resp = client.get(f"/api/v1/companies/{company.id}/ratios")
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_id"] == company.id
    assert "growth" in data
    assert "profitability" in data
    assert "solvency" in data
    assert "efficiency" in data
    assert "banking" in data


def test_api_company_quality_scores_endpoint(client: TestClient, db_session):
    """Verify GET /api/v1/companies/{id}/quality-scores."""
    company = Company(
        name="Apex Quality Ltd",
        isin="INE777B01018",
        is_financial_sector=False,
        status="ACTIVE",
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    fs_service = FinancialStatementService(db_session)
    fs_service.seed_sample_financials(company.id)

    resp = client.get(f"/api/v1/companies/{company.id}/quality-scores")
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_id"] == company.id
    assert "altman_z" in data
    assert "piotroski_f" in data
    assert data["piotroski_f"]["score"] is not None


def test_api_analysis_404_on_missing_company(client: TestClient):
    """Verify 404 is returned when company ID does not exist."""
    resp = client.get("/api/v1/companies/99999/ratios")
    assert resp.status_code == 404
    resp_scores = client.get("/api/v1/companies/99999/quality-scores")
    assert resp_scores.status_code == 404
