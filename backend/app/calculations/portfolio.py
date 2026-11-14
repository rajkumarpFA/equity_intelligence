"""Quantitative portfolio calculations: Tax-compliant FIFO lot matching, ACT/365 XIRR, and Benchmark Beta/Alpha."""

from datetime import date
from decimal import Decimal
import math
from typing import Any


def calculate_fifo_lots(
    transactions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate remaining open lots, cost basis, and realized P&L using FIFO matching.

    Complies with Section 55(2)(aa) of the Indian Income Tax Act:
    - BUY: creates a new open lot with its acquisition price and date.
    - SPLIT: proportionally adjusts quantity (Q * R) and per-share cost (P / R) of prior open lots.
    - BONUS: leaves prior lots unmodified. Creates a new lot with cost = 0.0 and acquisition date = allotment date.
    - SELL: liquidates open lots in chronological order (oldest first).
    """
    open_lots: list[dict[str, Any]] = []
    realized_pnl = Decimal("0.0000")
    total_shares_sold = Decimal("0.0000")

    # Sort transactions chronologically
    sorted_txns = sorted(
        transactions,
        key=lambda x: (x.get("trade_date") or date.min, x.get("order_sequence", 0), x.get("id", 0)),
    )

    for txn in sorted_txns:
        ttype = str(txn.get("transaction_type", "")).upper()
        trade_date = txn.get("trade_date")
        qty = Decimal(str(txn.get("quantity") or 0))
        price = Decimal(str(txn.get("price_per_share") or 0))
        charges = Decimal(str(txn.get("brokerage_charges") or 0)) + Decimal(str(txn.get("taxes") or 0))

        if ttype == "BUY":
            if qty > 0:
                open_lots.append(
                    {
                        "txn_id": txn.get("id"),
                        "shares": qty,
                        "initial_shares": qty,
                        "cost_per_share": price,
                        "charges": charges,
                        "buy_date": trade_date,
                    }
                )

        elif ttype == "SPLIT":
            # Ratio R e.g. 5 for 1:5 split (price comes as new_shares / old_shares or explicit ratio in notes)
            ratio = price if price > 0 else (qty if qty > 0 else Decimal("1"))
            if ratio > 0 and ratio != Decimal("1"):
                for lot in open_lots:
                    lot["shares"] = lot["shares"] * ratio
                    lot["cost_per_share"] = lot["cost_per_share"] / ratio

        elif ttype == "BONUS":
            # Section 55(2)(aa): Bonus shares have Nil (0) cost of acquisition.
            # Ratio e.g. 1:1 or explicit bonus share quantity received.
            bonus_qty = qty
            if bonus_qty <= 0 and price > 0:
                current_total = sum(l["shares"] for l in open_lots)
                bonus_qty = current_total * price

            if bonus_qty > 0:
                open_lots.append(
                    {
                        "txn_id": txn.get("id"),
                        "shares": bonus_qty,
                        "initial_shares": bonus_qty,
                        "cost_per_share": Decimal("0.0000"),
                        "charges": charges,
                        "buy_date": trade_date,
                    }
                )

        elif ttype == "SELL":
            remaining_sell_qty = qty
            total_shares_sold += qty

            while remaining_sell_qty > 0 and open_lots:
                oldest_lot = open_lots[0]
                matched_shares = min(remaining_sell_qty, oldest_lot["shares"])
                
                # Realized gain on matched portion
                gain_per_share = price - oldest_lot["cost_per_share"]
                pnl = gain_per_share * matched_shares
                realized_pnl += pnl

                oldest_lot["shares"] -= matched_shares
                remaining_sell_qty -= matched_shares

                if oldest_lot["shares"] <= Decimal("0.00001"):
                    open_lots.pop(0)

            # Deduct sell fees from realized P&L
            realized_pnl -= charges

    # Aggregate open lots
    total_open_shares = sum(lot["shares"] for lot in open_lots)
    total_cost = sum(lot["shares"] * lot["cost_per_share"] for lot in open_lots)
    avg_cost = (total_cost / total_open_shares) if total_open_shares > 0 else Decimal("0.0000")

    return {
        "open_lots": open_lots,
        "total_shares": total_open_shares,
        "invested_amount": total_cost,
        "average_buy_price": avg_cost,
        "realized_pnl": realized_pnl,
        "total_shares_sold": total_shares_sold,
    }


def calculate_xirr(
    cash_flows: list[tuple[date, float]],
    terminal_value: float = 0.0,
    as_of_date: date | None = None,
) -> float | None:
    """Calculate annualized Internal Rate of Return (XIRR) using standard ACT/365 day count.

    - cash_flows: list of (date, amount) tuples. Cash outflows (deposits/buys) are negative; inflows (sales/dividends) are positive.
    - terminal_value: current market value on as_of_date (positive inflow).
    """
    flows = list(cash_flows)
    if terminal_value > 0 and as_of_date:
        flows.append((as_of_date, terminal_value))

    # Clean and sort flows by date
    valid_flows = sorted([(d, float(amt)) for d, amt in flows if d and abs(amt) > 1e-6], key=lambda x: x[0])
    if len(valid_flows) < 2:
        return None

    # Must contain both positive and negative cash flows
    has_positive = any(amt > 0 for _, amt in valid_flows)
    has_negative = any(amt < 0 for _, amt in valid_flows)
    if not (has_positive and has_negative):
        return None

    d0 = valid_flows[0][0]

    # Two-flow special case: direct CAGR
    if len(valid_flows) == 2:
        d1, c1 = valid_flows[0]
        d2, c2 = valid_flows[1]
        days = (d2 - d1).days
        if days > 0 and c1 < 0 and c2 > 0:
            return round((abs(c2) / abs(c1)) ** (365.0 / days) - 1.0, 6)

    def f(rate: float) -> float:
        total = 0.0
        for d, amt in valid_flows:
            dt = (d - d0).days / 365.0
            total += amt / ((1.0 + rate) ** dt)
        return total

    def f_prime(rate: float) -> float:
        total = 0.0
        for d, amt in valid_flows:
            dt = (d - d0).days / 365.0
            total -= dt * amt / ((1.0 + rate) ** (dt + 1.0))
        return total

    # 1. Try Newton-Raphson with step damping and bounds
    rate = 0.10  # Initial guess 10%
    for _ in range(100):
        try:
            val = f(rate)
            if abs(val) < 1e-7:
                return round(rate, 6)
            deriv = f_prime(rate)
            if abs(deriv) < 1e-9:
                break
            step = val / deriv
            rate -= step
            # Clamp rate to avoid negative base singularity in (1+r)^t
            if rate <= -0.999:
                rate = -0.90
            elif rate > 50.0:
                rate = 10.0
        except (OverflowError, ZeroDivisionError, ValueError):
            break

    # 2. Bracket search & robust bisection fallback
    grid = [-0.95, -0.80, -0.50, -0.20, 0.0, 0.05, 0.10, 0.20, 0.50, 1.0, 2.0, 5.0, 10.0]
    bracket = None
    prev_r = grid[0]
    try:
        prev_f = f(prev_r)
        for r in grid[1:]:
            curr_f = f(r)
            if prev_f * curr_f <= 0:
                bracket = (prev_r, r)
                break
            prev_r, prev_f = r, curr_f
    except Exception:
        bracket = None

    if bracket:
        low, high = bracket
        for _ in range(100):
            mid = (low + high) / 2.0
            val_mid = f(mid)
            if abs(val_mid) < 1e-6 or (high - low) < 1e-6:
                return round(mid, 6)
            if f(low) * val_mid <= 0:
                high = mid
            else:
                low = mid
        return round((low + high) / 2.0, 6)

    # 3. Fallback: simple total annualized return on initial outlay vs current value
    initial_outlay = sum(abs(amt) for _, amt in valid_flows if amt < 0)
    total_inflows = sum(amt for _, amt in valid_flows if amt > 0)
    total_days = (valid_flows[-1][0] - valid_flows[0][0]).days
    if initial_outlay > 0 and total_inflows > 0 and total_days > 0:
        return round((total_inflows / initial_outlay) ** (365.0 / total_days) - 1.0, 6)

    return None


def calculate_portfolio_beta_alpha(
    portfolio_daily_returns: list[float],
    benchmark_daily_returns: list[float],
    risk_free_rate: float = 0.07,
) -> tuple[float | None, float | None]:
    """Calculate Beta and Jensen's Alpha against a benchmark index."""
    n = min(len(portfolio_daily_returns), len(benchmark_daily_returns))
    if n < 10:
        return None, None

    rp = portfolio_daily_returns[:n]
    rm = benchmark_daily_returns[:n]

    mean_p = sum(rp) / n
    mean_m = sum(rm) / n

    cov = sum((rp[i] - mean_p) * (rm[i] - mean_m) for i in range(n)) / (n - 1)
    var_m = sum((rm[i] - mean_m) ** 2 for i in range(n)) / (n - 1)

    if var_m <= 1e-12:
        return None, None

    beta = cov / var_m
    # Annualized Alpha (252 trading days)
    ann_p = mean_p * 252
    ann_m = mean_m * 252
    alpha = ann_p - (risk_free_rate + beta * (ann_m - risk_free_rate))

    return round(beta, 4), round(alpha, 4)


def calculate_asset_allocation(
    holdings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate percentage allocation by Sector and Market Capitalization tier."""
    total_market_value = sum(float(h.get("current_value") or 0.0) for h in holdings)
    if total_market_value <= 0:
        return {"sectors": [], "market_caps": [], "total_market_value": 0.0}

    sector_map: dict[str, float] = {}
    cap_map: dict[str, float] = {}

    for h in holdings:
        val = float(h.get("current_value") or 0.0)
        sec = h.get("sector_name") or "Unclassified"
        cap = h.get("market_cap_category") or "OTHER"

        sector_map[sec] = sector_map.get(sec, 0.0) + val
        cap_map[cap] = cap_map.get(cap, 0.0) + val

    sectors = [
        {"name": k, "value": round(v, 2), "weight_pct": round((v / total_market_value) * 100, 2)}
        for k, v in sorted(sector_map.items(), key=lambda x: x[1], reverse=True)
    ]
    market_caps = [
        {"tier": k, "value": round(v, 2), "weight_pct": round((v / total_market_value) * 100, 2)}
        for k, v in sorted(cap_map.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "sectors": sectors,
        "market_caps": market_caps,
        "total_market_value": round(total_market_value, 2),
    }
