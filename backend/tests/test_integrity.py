"""Tests for Data Integrity Engine, Fundamental Accounting Verification, and Corporate Action Adjustments."""

from datetime import date
from decimal import Decimal

from app.integrity.accounting_rules import (
    validate_balance_sheet_identity,
    validate_banking_accounting_identity,
    validate_cash_flow_identity,
    validate_income_statement_articulation,
)
from app.integrity.corporate_action_adjuster import (
    adjust_historical_price,
    adjust_historical_volume,
    adjust_per_share_metric,
    calculate_action_multiplier,
    compute_cumulative_adjustment_factors,
)
from app.integrity.models import ValidationSeverity
from app.integrity.outlier_rules import (
    validate_impossible_margins,
    validate_negative_value_safeguards,
    validate_yoy_anomalies,
)
from app.integrity.restatement_manager import compute_restatement_diff
from app.models.company import Company, Exchange, Security
from app.models.financials import FinancialFact, FinancialMetric, FinancialStatement
from app.models.market_data import CorporateAction, PriceHistory
from app.services.integrity_service import IntegrityService


def test_balance_sheet_identity_balanced_and_imbalanced():
    """Verify Balance Sheet identity: Total Assets == Total Liabilities + Net Worth."""
    # 1. Balanced case
    balanced = {
        "TOTAL_ASSETS": Decimal("1000.00"),
        "TOTAL_LIABILITIES": Decimal("600.00"),
        "NET_WORTH": Decimal("400.00"),
    }
    res = validate_balance_sheet_identity(balanced, statement_id=1, is_banking=False)
    assert res.passed is True
    assert res.severity == ValidationSeverity.INFO

    # 2. Imbalanced case (discrepancy of ₹100 Cr)
    imbalanced = {
        "TOTAL_ASSETS": Decimal("1000.00"),
        "TOTAL_LIABILITIES": Decimal("600.00"),
        "NET_WORTH": Decimal("300.00"),
    }
    res_bad = validate_balance_sheet_identity(imbalanced, statement_id=2, is_banking=False)
    assert res_bad.passed is False
    assert res_bad.severity == ValidationSeverity.ERROR
    assert res_bad.details["discrepancy_crores"] == "100.00"


def test_banking_balance_sheet_and_nii():
    """Verify Banking specific accounting model: Deposits + Borrowings + Liab + Equity, and NII."""
    # Banking Balance Sheet
    banking_bs = {
        "TOTAL_ASSETS": Decimal("1000.00"),
        "TOTAL_DEPOSITS": Decimal("800.00"),
        "BORROWINGS": Decimal("100.00"),
        "OTHER_LIABILITIES": Decimal("40.00"),
        "NET_WORTH": Decimal("60.00"),
    }
    res_bs = validate_balance_sheet_identity(banking_bs, statement_id=3, is_banking=True)
    assert res_bs.passed is True

    # Banking NII
    banking_pnl = {
        "INTEREST_EARNED": Decimal("150.00"),
        "INTEREST_EXPENDED": Decimal("90.00"),
        "NET_INTEREST_INCOME": Decimal("60.00"),
    }
    res_nii = validate_banking_accounting_identity(banking_pnl, statement_id=4)
    assert res_nii.passed is True

    # Banking NII discrepancy
    bad_pnl = {
        "INTEREST_EARNED": Decimal("150.00"),
        "INTEREST_EXPENDED": Decimal("90.00"),
        "NET_INTEREST_INCOME": Decimal("75.00"),  # Expected 60
    }
    res_nii_bad = validate_banking_accounting_identity(bad_pnl, statement_id=5)
    assert res_nii_bad.passed is False
    assert res_nii_bad.severity == ValidationSeverity.ERROR


def test_cash_flow_and_pnl_identities():
    """Verify Cash Flow reconciliation and Income Statement articulation."""
    # Cash Flow: Net == CFO + CFI + CFF
    cf_data = {
        "CFO": Decimal("150.00"),
        "CFI": Decimal("-80.00"),
        "CFF": Decimal("-50.00"),
        "NET_CASH_FLOW": Decimal("20.00"),
    }
    res_cf = validate_cash_flow_identity(cf_data, statement_id=6)
    assert res_cf.passed is True

    # PnL: Total Revenue == Ops + Other, PAT == PBT - Tax
    pnl_data = {
        "REVENUE_FROM_OPERATIONS": Decimal("950.00"),
        "OTHER_INCOME": Decimal("50.00"),
        "TOTAL_REVENUE": Decimal("1000.00"),
        "PBT": Decimal("200.00"),
        "TAX_EXPENSE": Decimal("50.00"),
        "PAT": Decimal("150.00"),
    }
    res_pnl = validate_income_statement_articulation(pnl_data, statement_id=7)
    assert res_pnl.passed is True


def test_outlier_yoy_anomalies():
    """Detect extreme YoY growth spikes (>150%) and collapses."""
    prev = {"REVENUE": Decimal("100.00"), "TOTAL_DEBT": Decimal("50.00"), "PAT": Decimal("20.00")}
    curr_spike = {"REVENUE": Decimal("300.00"), "TOTAL_DEBT": Decimal("160.00"), "PAT": Decimal("90.00")}

    res = validate_yoy_anomalies(curr_spike, prev, statement_id=8)
    assert res.passed is False
    assert res.severity == ValidationSeverity.WARNING
    assert len(res.details["anomalies"]) >= 2


def test_impossible_margins_and_negatives():
    """Ensure impossible margins (>100%) and negative assets/capital are flagged."""
    bad_margins = {
        "REVENUE_FROM_OPERATIONS": Decimal("100.00"),
        "PAT": Decimal("130.00"),  # 130% net margin!
    }
    res_margin = validate_impossible_margins(bad_margins, statement_id=9)
    assert res_margin.passed is False
    assert res_margin.severity == ValidationSeverity.ERROR

    bad_assets = {
        "TOTAL_ASSETS": Decimal("-50.00"),
        "SHARE_CAPITAL": Decimal("10.00"),
    }
    res_neg = validate_negative_value_safeguards(bad_assets, statement_id=10)
    assert res_neg.passed is False
    assert res_neg.severity == ValidationSeverity.ERROR


def test_restatement_diff_computation():
    """Verify line-by-line restatement diff and percentage calculation."""
    original = {"REVENUE": Decimal("1000.00"), "PAT": Decimal("150.00")}
    restated = {"REVENUE": Decimal("1050.00"), "PAT": Decimal("140.00"), "EBITDA": Decimal("250.00")}

    res = compute_restatement_diff(original, restated, statement_id=12, superseded_id=11)
    assert res.passed is False  # Restatement detected
    assert res.details["modified_facts_count"] == 3
    assert any(d["metric_code"] == "EBITDA" and d["pct_change"] == "NEW_METRIC" for d in res.details["differences"])


def test_corporate_action_adjuster_math():
    """Verify split, bonus, and cumulative multi-action adjustment calculations."""
    # 1. Split 10:1 (10 shares for 1)
    split_mult = calculate_action_multiplier("SPLIT", Decimal(10), Decimal(1))
    assert split_mult == Decimal("10.0")

    # Adjusted price: ₹2,500 / 10 = ₹250
    assert adjust_historical_price(Decimal("2500.00"), split_mult) == Decimal("250.00")
    # Adjusted volume: 10,000 * 10 = 100,000
    assert adjust_historical_volume(10000, split_mult) == 100000
    # Adjusted EPS: ₹50 / 10 = ₹5
    assert adjust_per_share_metric(Decimal("50.00"), split_mult) == Decimal("5.00")

    # 2. Bonus 1:1 (1 bonus for 1 existing -> 2 total)
    bonus_mult = calculate_action_multiplier("BONUS", Decimal(1), Decimal(1))
    assert bonus_mult == Decimal("2.0")
    assert adjust_historical_price(Decimal("1000.00"), bonus_mult) == Decimal("500.00")

    # 3. Cumulative Chaining: Split 5:1 on 2021-06-01 and Bonus 1:1 on 2023-09-01
    actions = [
        {"action_type": "SPLIT", "ex_date": date(2021, 6, 1), "ratio_numerator": Decimal(5), "ratio_denominator": Decimal(1)},
        {"action_type": "BONUS", "ex_date": date(2023, 9, 1), "ratio_numerator": Decimal(1), "ratio_denominator": Decimal(1)},
    ]

    dates = [date(2020, 1, 1), date(2022, 1, 1), date(2024, 1, 1)]
    factors = compute_cumulative_adjustment_factors(actions, dates)

    # In 2020 (before both actions): factor = 5 * 2 = 10
    assert factors[date(2020, 1, 1)] == Decimal("10.0")
    # In 2022 (after split, before bonus): factor = 2
    assert factors[date(2022, 1, 1)] == Decimal("2.0")
    # In 2024 (after both actions): factor = 1
    assert factors[date(2024, 1, 1)] == Decimal("1.0")


def test_integrity_service_and_endpoint_integration(db_session, client):
    """Test full database integration with IntegrityService and FastAPI endpoints."""
    # Create test company and exchange
    ex = Exchange(code="NSE", name="National Stock Exchange")
    db_session.add(ex)
    db_session.flush()

    comp = Company(
        name="Integrity Test Equities Ltd",
        isin="INE999A01099",
        is_financial_sector=False,
    )
    db_session.add(comp)
    db_session.flush()

    sec = Security(
        company_id=comp.id,
        exchange_id=ex.id,
        symbol="INTEGRITY",
        is_primary=True,
    )
    db_session.add(sec)
    db_session.flush()

    # Create Metric
    m_assets = FinancialMetric(code="TOTAL_ASSETS", name="Total Assets", category="BALANCE_SHEET")
    m_liab = FinancialMetric(code="TOTAL_LIABILITIES", name="Total Liabilities", category="BALANCE_SHEET")
    m_equity = FinancialMetric(code="NET_WORTH", name="Net Worth", category="BALANCE_SHEET")
    db_session.add_all([m_assets, m_liab, m_equity])
    db_session.flush()

    # Create Balanced Statement
    stmt = FinancialStatement(
        company_id=comp.id,
        statement_type="BALANCE_SHEET",
        reporting_basis="CONSOLIDATED",
        period_type="ANNUAL",
        period_end=date(2024, 3, 31),
        fiscal_year=2024,
    )
    db_session.add(stmt)
    db_session.flush()

    f1 = FinancialFact(statement_id=stmt.id, metric_id=m_assets.id, value=Decimal("1500.00"), unit="CRORES")
    f2 = FinancialFact(statement_id=stmt.id, metric_id=m_liab.id, value=Decimal("900.00"), unit="CRORES")
    f3 = FinancialFact(statement_id=stmt.id, metric_id=m_equity.id, value=Decimal("600.00"), unit="CRORES")
    db_session.add_all([f1, f2, f3])
    db_session.commit()

    # 1. Run validation via service
    svc = IntegrityService(db_session)
    summary = svc.validate_company_financials(comp.id)

    assert summary.company_id == comp.id
    assert summary.is_healthy is True
    assert summary.error_checks == 0
    assert summary.total_checks >= 1

    # 2. Add corporate action and test price adjustment
    ca = CorporateAction(
        company_id=comp.id,
        security_id=sec.id,
        action_type="SPLIT",
        ex_date=date(2024, 1, 1),
        ratio_numerator=Decimal(2),
        ratio_denominator=Decimal(1),
    )
    db_session.add(ca)

    candle = PriceHistory(
        security_id=sec.id,
        trade_date=date(2023, 12, 15),  # Prior to split
        open=Decimal("1000.00"),
        high=Decimal("1050.00"),
        low=Decimal("980.00"),
        close=Decimal("1000.00"),
        volume=50000,
        adj_close=Decimal("1000.00"),
    )
    db_session.add(candle)
    db_session.commit()

    updated = svc.apply_corporate_actions_to_price_history(sec.id)
    assert updated == 1
    db_session.refresh(candle)
    assert candle.adj_close == Decimal("500.00")  # 1000 / 2 = 500

    # 3. Test API endpoint with TestClient
    resp = client.post(f"/api/v1/integrity/validate/company/{comp.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_id"] == comp.id
    assert data["is_healthy"] is True
