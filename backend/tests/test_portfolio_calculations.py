"""Unit tests for Phase 14 Portfolio Quantitative Calculations."""

from datetime import date
from decimal import Decimal

from app.calculations.portfolio import (
    calculate_asset_allocation,
    calculate_fifo_lots,
    calculate_portfolio_beta_alpha,
    calculate_xirr,
)


def test_fifo_lot_matching_basic_buy_and_sell():
    txns = [
        {"id": 1, "transaction_type": "BUY", "trade_date": date(2025, 1, 10), "quantity": 100, "price_per_share": 1000},
        {"id": 2, "transaction_type": "BUY", "trade_date": date(2025, 2, 10), "quantity": 100, "price_per_share": 1200},
        {"id": 3, "transaction_type": "SELL", "trade_date": date(2025, 3, 10), "quantity": 150, "price_per_share": 1500},
    ]
    res = calculate_fifo_lots(txns)
    # Sold 150: 100 from Lot 1 (gain: 1500 - 1000 = 500 * 100 = 50,000)
    # + 50 from Lot 2 (gain: 1500 - 1200 = 300 * 50 = 15,000) -> total realized PnL = 65,000
    assert res["realized_pnl"] == Decimal("65000.0000")
    assert res["total_shares"] == Decimal("50.0000")
    # Remaining 50 shares belong to Lot 2 at cost 1200
    assert res["average_buy_price"] == Decimal("1200.0000")
    assert res["invested_amount"] == Decimal("60000.0000")


def test_fifo_indian_income_tax_section_55_bonus_treatment():
    """Verify Section 55(2)(aa) of IT Act: Bonus shares have cost of 0 and do not modify prior lot costs."""
    txns = [
        {"id": 1, "transaction_type": "BUY", "trade_date": date(2024, 1, 1), "quantity": 100, "price_per_share": 500},
        # 1:1 Bonus issue
        {"id": 2, "transaction_type": "BONUS", "trade_date": date(2024, 6, 1), "quantity": 100, "price_per_share": 0},
        # Sell 150 shares: 100 from original lot (cost 500), 50 from bonus lot (cost 0)
        {"id": 3, "transaction_type": "SELL", "trade_date": date(2024, 12, 1), "quantity": 150, "price_per_share": 800},
    ]
    res = calculate_fifo_lots(txns)
    # Lot 1: 100 shares @ cost 500 sold @ 800 -> gain = (800 - 500) * 100 = 30,000
    # Lot 2: 50 bonus shares @ cost 0 sold @ 800 -> gain = (800 - 0) * 50 = 40,000
    # Total realized PnL = 70,000
    assert res["realized_pnl"] == Decimal("70000.0000")
    assert res["total_shares"] == Decimal("50.0000")
    # Remaining 50 shares are bonus shares with 0 cost
    assert res["average_buy_price"] == Decimal("0.0000")
    assert res["invested_amount"] == Decimal("0.0000")


def test_fifo_stock_split_treatment():
    """Verify Stock Split: existing lots have quantity multiplied and cost per share divided."""
    txns = [
        {"id": 1, "transaction_type": "BUY", "trade_date": date(2024, 1, 1), "quantity": 100, "price_per_share": 1000},
        # 1:5 Split (ratio 5)
        {"id": 2, "transaction_type": "SPLIT", "trade_date": date(2024, 5, 1), "quantity": 5, "price_per_share": 5},
    ]
    res = calculate_fifo_lots(txns)
    assert res["total_shares"] == Decimal("500.0000")
    assert res["average_buy_price"] == Decimal("200.0000")
    assert res["invested_amount"] == Decimal("100000.0000")


def test_xirr_cagr_two_flows():
    # Invest 1,00,000 on Jan 1, 2024; value is 1,20,000 on Jan 1, 2025 (366 days, approx 20%)
    flows = [
        (date(2024, 1, 1), -100000.0),
        (date(2025, 1, 1), 120000.0),
    ]
    rate = calculate_xirr(flows)
    assert rate is not None
    assert 0.198 <= rate <= 0.202


def test_xirr_multiple_cash_flows_convergence():
    # Buy at different times, sell at terminal date
    flows = [
        (date(2024, 1, 1), -50000.0),
        (date(2024, 7, 1), -50000.0),
        (date(2024, 10, 1), 5000.0),  # Dividend
    ]
    # Terminal value of 1,20,000 on 2025-01-01
    rate = calculate_xirr(flows, terminal_value=120000.0, as_of_date=date(2025, 1, 1))
    assert rate is not None
    assert rate > 0.20  # Strong positive annual return


def test_xirr_edge_cases():
    # Empty
    assert calculate_xirr([]) is None
    # All negative
    assert calculate_xirr([(date(2024, 1, 1), -1000.0), (date(2024, 2, 1), -500.0)]) is None
    # All positive
    assert calculate_xirr([(date(2024, 1, 1), 1000.0), (date(2024, 2, 1), 500.0)]) is None


def test_portfolio_beta_alpha():
    # Perfectly correlated identical returns
    p_returns = [0.01, -0.005, 0.02, -0.01, 0.015, 0.005, -0.02, 0.012, 0.008, -0.003, 0.015, -0.005]
    m_returns = list(p_returns)
    beta, alpha = calculate_portfolio_beta_alpha(p_returns, m_returns, risk_free_rate=0.07)
    assert beta is not None
    assert abs(beta - 1.0) < 1e-3


def test_asset_allocation():
    holdings = [
        {"sector_name": "Financials", "market_cap_category": "LARGE_CAP", "current_value": 60000.0},
        {"sector_name": "IT Services", "market_cap_category": "LARGE_CAP", "current_value": 30000.0},
        {"sector_name": "Energy", "market_cap_category": "MID_CAP", "current_value": 10000.0},
    ]
    res = calculate_asset_allocation(holdings)
    assert res["total_market_value"] == 100000.0
    assert res["sectors"][0]["name"] == "Financials"
    assert res["sectors"][0]["weight_pct"] == 60.0
    assert res["market_caps"][0]["tier"] == "LARGE_CAP"
    assert res["market_caps"][0]["weight_pct"] == 90.0
