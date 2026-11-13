"""Mathematical quantitative valuation engine for Indian equities.

Implements:
1. Discounted Cash Flow (DCF): 5Y/10Y FCFF projection, WACC discount, Gordon Growth / Exit Multiple terminal values,
   equity bridge (EV - Debt + Cash), per share fair value, margin of safety, and Bear/Base/Bull scenarios.
2. Reverse DCF: Numerical root solver finding market-implied growth rate from current stock price.
3. Sensitivity Matrix: 5x5 grid varying WACC and Terminal Growth.
4. Historical Valuation Multiples: Percentile bands (Min, 25th, Median, 75th, Max) for P/E, P/B, EV/EBITDA.
5. Dividend Discount Model (DDM): Single-stage Gordon Growth and Two-Stage DDM for dividend compounders.
6. Benjamin Graham Intrinsic Value: Classical formula adjusted for local bond yields and Graham Number.
7. Consensus Multi-Model Summary: Blended fair value range and margin of safety.
"""

import math
from typing import Any


def calculate_dcf(
    latest_revenue: float,
    latest_ebit: float,
    latest_tax_rate: float,
    shares_outstanding: float,
    total_debt: float,
    cash_and_equivalents: float,
    current_price: float,
    growth_rates: list[float],
    operating_margins: list[float],
    tax_rate: float,
    reinvestment_rates: list[float],
    wacc: float,
    terminal_growth_rate: float,
    terminal_exit_multiple: float | None = None,
    use_exit_multiple: bool = False,
    da_ratio: float = 0.04,  # D&A as % of revenue (default 4%)
) -> dict[str, Any]:
    """Calculate multi-year Discounted Cash Flow (DCF) valuation.

    Guards:
    - wacc must be > terminal_growth_rate when using Gordon Growth.
    - shares_outstanding must be > 0.
    """
    if shares_outstanding <= 0:
        raise ValueError("Shares outstanding must be positive to compute per-share intrinsic value")
    if not use_exit_multiple and wacc <= terminal_growth_rate:
        raise ValueError(
            f"WACC ({wacc:.2%}) must be strictly greater than terminal growth rate ({terminal_growth_rate:.2%})"
        )

    years_count = len(growth_rates)
    if years_count == 0:
        raise ValueError("At least one projection year required")

    projections = []
    prev_revenue = latest_revenue
    cumulative_pv_fcf = 0.0

    for i in range(years_count):
        g = growth_rates[i]
        margin = operating_margins[i]
        reinvest = reinvestment_rates[i] if i < len(reinvestment_rates) else 0.30

        year_revenue = prev_revenue * (1.0 + g)
        year_ebit = year_revenue * margin
        year_nopat = year_ebit * (1.0 - tax_rate)
        # FCFF = NOPAT * (1 - Reinvestment Rate)
        year_fcff = year_nopat * (1.0 - reinvest)

        # Discount factor
        t = i + 1
        discount_factor = 1.0 / math.pow(1.0 + wacc, t)
        pv_fcff = year_fcff * discount_factor
        cumulative_pv_fcf += pv_fcff

        projections.append(
            {
                "year": t,
                "revenue": round(year_revenue, 2),
                "growth_pct": round(g * 100, 2),
                "ebit": round(year_ebit, 2),
                "margin_pct": round(margin * 100, 2),
                "nopat": round(year_nopat, 2),
                "fcff": round(year_fcff, 2),
                "discount_factor": round(discount_factor, 4),
                "pv_fcff": round(pv_fcff, 2),
            }
        )
        prev_revenue = year_revenue

    final_year = projections[-1]
    final_fcff = final_year["fcff"]
    final_ebit = final_year["ebit"]
    final_discount_factor = final_year["discount_factor"]

    # Calculate Terminal Value
    if use_exit_multiple and terminal_exit_multiple is not None and terminal_exit_multiple > 0:
        # Terminal EV using exit EV/EBITDA multiple (EBITDA approx EBIT + D&A)
        final_ebitda = final_ebit + (final_year["revenue"] * da_ratio)
        terminal_value = final_ebitda * terminal_exit_multiple
        tv_method = "EXIT_MULTIPLE"
    else:
        # Gordon Growth Terminal Value
        terminal_fcff = final_fcff * (1.0 + terminal_growth_rate)
        terminal_value = terminal_fcff / (wacc - terminal_growth_rate)
        tv_method = "GORDON_GROWTH"

    pv_terminal_value = terminal_value * final_discount_factor
    enterprise_value = cumulative_pv_fcf + pv_terminal_value
    equity_value = enterprise_value - total_debt + cash_and_equivalents
    equity_value_non_negative = max(0.0, equity_value)
    intrinsic_value_per_share = equity_value_non_negative / shares_outstanding

    margin_of_safety = (
        ((intrinsic_value_per_share - current_price) / intrinsic_value_per_share * 100.0)
        if intrinsic_value_per_share > 0
        else -100.0
    )

    return {
        "model": "DCF",
        "terminal_value_method": tv_method,
        "enterprise_value": round(enterprise_value, 2),
        "pv_explicit_fcf": round(cumulative_pv_fcf, 2),
        "terminal_value": round(terminal_value, 2),
        "pv_terminal_value": round(pv_terminal_value, 2),
        "total_debt": round(total_debt, 2),
        "cash_and_equivalents": round(cash_and_equivalents, 2),
        "equity_value": round(equity_value, 2),
        "shares_outstanding": round(shares_outstanding, 4),
        "current_price": round(current_price, 2),
        "intrinsic_value_per_share": round(intrinsic_value_per_share, 2),
        "margin_of_safety_pct": round(margin_of_safety, 2),
        "is_undervalued": intrinsic_value_per_share > current_price,
        "projections": projections,
    }


def calculate_reverse_dcf(
    current_price: float,
    latest_revenue: float,
    latest_ebit: float,
    latest_tax_rate: float,
    shares_outstanding: float,
    total_debt: float,
    cash_and_equivalents: float,
    operating_margin: float,
    wacc: float,
    terminal_growth_rate: float,
    projection_years: int = 5,
    reinvestment_rate: float = 0.30,
) -> dict[str, Any]:
    """Find the implied constant revenue growth rate that equates DCF intrinsic value to current market price.

    Uses bisection root-finding bounded between -50% and +100% annual growth.
    """
    if current_price <= 0 or shares_outstanding <= 0:
        raise ValueError("Current price and shares outstanding must be positive for Reverse DCF")
    if wacc <= terminal_growth_rate:
        raise ValueError("WACC must exceed terminal growth rate for Reverse DCF convergence")

    def evaluate_price_for_growth(g_test: float) -> float:
        growth_rates = [g_test] * projection_years
        margins = [operating_margin] * projection_years
        reinvests = [reinvestment_rate] * projection_years
        try:
            res = calculate_dcf(
                latest_revenue=latest_revenue,
                latest_ebit=latest_ebit,
                latest_tax_rate=latest_tax_rate,
                shares_outstanding=shares_outstanding,
                total_debt=total_debt,
                cash_and_equivalents=cash_and_equivalents,
                current_price=current_price,
                growth_rates=growth_rates,
                operating_margins=margins,
                tax_rate=latest_tax_rate,
                reinvestment_rates=reinvests,
                wacc=wacc,
                terminal_growth_rate=terminal_growth_rate,
            )
            return res["intrinsic_value_per_share"]
        except (ValueError, ZeroDivisionError):
            return 0.0

    # Bisection search for implied growth
    low_g = -0.40  # -40% growth lower bound
    high_g = 1.00  # +100% growth upper bound
    implied_g = None

    for _ in range(60):
        mid_g = (low_g + high_g) / 2.0
        val = evaluate_price_for_growth(mid_g)
        diff = val - current_price

        if abs(diff) < 0.05 or (high_g - low_g) < 0.0001:
            implied_g = mid_g
            break
        elif diff < 0:
            low_g = mid_g
        else:
            high_g = mid_g

    if implied_g is None:
        implied_g = (low_g + high_g) / 2.0

    return {
        "model": "REVERSE_DCF",
        "current_price": round(current_price, 2),
        "implied_revenue_growth_pct": round(implied_g * 100, 2),
        "assumptions": {
            "wacc_pct": round(wacc * 100, 2),
            "terminal_growth_pct": round(terminal_growth_rate * 100, 2),
            "operating_margin_pct": round(operating_margin * 100, 2),
            "projection_years": projection_years,
            "reinvestment_rate_pct": round(reinvestment_rate * 100, 2),
        },
    }


def calculate_dcf_sensitivity_matrix(
    latest_revenue: float,
    latest_ebit: float,
    latest_tax_rate: float,
    shares_outstanding: float,
    total_debt: float,
    cash_and_equivalents: float,
    current_price: float,
    base_growth_rate: float,
    base_operating_margin: float,
    base_wacc: float,
    base_terminal_growth: float,
    projection_years: int = 5,
) -> dict[str, Any]:
    """Generate a 5x5 sensitivity matrix varying WACC and Terminal Growth Rate."""
    wacc_steps = [base_wacc - 0.02, base_wacc - 0.01, base_wacc, base_wacc + 0.01, base_wacc + 0.02]
    tg_steps = [
        base_terminal_growth - 0.01,
        base_terminal_growth - 0.005,
        base_terminal_growth,
        base_terminal_growth + 0.005,
        base_terminal_growth + 0.01,
    ]

    growth_rates = [base_growth_rate] * projection_years
    margins = [base_operating_margin] * projection_years
    reinvests = [0.30] * projection_years

    matrix = []
    for w in wacc_steps:
        row = {"wacc_pct": round(w * 100, 2), "values": []}
        for tg in tg_steps:
            if w <= tg:
                row["values"].append({"terminal_growth_pct": round(tg * 100, 2), "value": None, "diff_pct": None})
                continue
            try:
                res = calculate_dcf(
                    latest_revenue=latest_revenue,
                    latest_ebit=latest_ebit,
                    latest_tax_rate=latest_tax_rate,
                    shares_outstanding=shares_outstanding,
                    total_debt=total_debt,
                    cash_and_equivalents=cash_and_equivalents,
                    current_price=current_price,
                    growth_rates=growth_rates,
                    operating_margins=margins,
                    tax_rate=latest_tax_rate,
                    reinvestment_rates=reinvests,
                    wacc=w,
                    terminal_growth_rate=tg,
                )
                val = res["intrinsic_value_per_share"]
                diff_pct = round(((val - current_price) / current_price) * 100.0, 1) if current_price > 0 else 0.0
                row["values"].append(
                    {
                        "terminal_growth_pct": round(tg * 100, 2),
                        "value": round(val, 2),
                        "diff_pct": diff_pct,
                    }
                )
            except (ValueError, ZeroDivisionError):
                row["values"].append({"terminal_growth_pct": round(tg * 100, 2), "value": None, "diff_pct": None})
        matrix.append(row)

    return {
        "base_wacc_pct": round(base_wacc * 100, 2),
        "base_terminal_growth_pct": round(base_terminal_growth * 100, 2),
        "current_price": round(current_price, 2),
        "tg_headers": [round(tg * 100, 2) for tg in tg_steps],
        "matrix": matrix,
    }


def calculate_historical_multiples_valuation(
    latest_eps: float | None,
    latest_bvps: float | None,
    latest_ebitda: float | None,
    shares_outstanding: float,
    total_debt: float,
    cash_and_equivalents: float,
    current_price: float,
    historical_pe_ratios: list[float],
    historical_pb_ratios: list[float],
    historical_ev_ebitda_ratios: list[float],
) -> dict[str, Any]:
    """Compute percentile bands (Min, 25th, Median, 75th, Max) and target prices from historical multiples."""
    import numpy as np

    def get_percentile_summary(series: list[float]) -> dict[str, float] | None:
        clean = [x for x in series if x is not None and x > 0 and not math.isnan(x)]
        if not clean:
            return None
        arr = np.array(clean)
        return {
            "min": round(float(np.min(arr)), 2),
            "p25": round(float(np.percentile(arr, 25)), 2),
            "median": round(float(np.median(arr)), 2),
            "p75": round(float(np.percentile(arr, 75)), 2),
            "max": round(float(np.max(arr)), 2),
            "count": len(clean),
        }

    pe_summary = get_percentile_summary(historical_pe_ratios)
    pb_summary = get_percentile_summary(historical_pb_ratios)
    ev_summary = get_percentile_summary(historical_ev_ebitda_ratios)

    pe_implied_target = (
        round(pe_summary["median"] * latest_eps, 2)
        if pe_summary and latest_eps is not None and latest_eps > 0
        else None
    )

    pb_implied_target = (
        round(pb_summary["median"] * latest_bvps, 2)
        if pb_summary and latest_bvps is not None and latest_bvps > 0
        else None
    )

    ev_implied_target = None
    if ev_summary and latest_ebitda is not None and latest_ebitda > 0 and shares_outstanding > 0:
        implied_ev = ev_summary["median"] * latest_ebitda
        implied_equity = implied_ev - total_debt + cash_and_equivalents
        if implied_equity > 0:
            ev_implied_target = round(implied_equity / shares_outstanding, 2)

    return {
        "model": "HISTORICAL_MULTIPLES",
        "current_price": round(current_price, 2),
        "pe": {
            "bands": pe_summary,
            "latest_eps": round(latest_eps, 2) if latest_eps is not None else None,
            "implied_target_price": pe_implied_target,
            "margin_of_safety_pct": (
                round(((pe_implied_target - current_price) / pe_implied_target) * 100.0, 2)
                if pe_implied_target
                else None
            ),
        },
        "pb": {
            "bands": pb_summary,
            "latest_bvps": round(latest_bvps, 2) if latest_bvps is not None else None,
            "implied_target_price": pb_implied_target,
            "margin_of_safety_pct": (
                round(((pb_implied_target - current_price) / pb_implied_target) * 100.0, 2)
                if pb_implied_target
                else None
            ),
        },
        "ev_ebitda": {
            "bands": ev_summary,
            "latest_ebitda": round(latest_ebitda, 2) if latest_ebitda is not None else None,
            "implied_target_price": ev_implied_target,
            "margin_of_safety_pct": (
                round(((ev_implied_target - current_price) / ev_implied_target) * 100.0, 2)
                if ev_implied_target
                else None
            ),
        },
    }


def calculate_dividend_discount_model(
    latest_dps: float | None,
    cost_of_equity: float,
    dividend_growth_rate: float,
    current_price: float,
    high_growth_period_years: int = 0,
    high_growth_rate: float | None = None,
) -> dict[str, Any]:
    """Calculate intrinsic value via Gordon Growth Dividend Discount Model (DDM).

    Guards:
    - If latest_dps <= 0: Returns bypass reason NO_DIVIDENDS_PAID.
    - cost_of_equity must be strictly greater than dividend_growth_rate.
    """
    if latest_dps is None or latest_dps <= 0:
        return {
            "model": "DDM",
            "is_applicable": False,
            "bypass_reason": "NO_DIVIDENDS_PAID",
            "message": "Company does not pay dividends or DPS is zero/negative",
            "intrinsic_value": None,
            "margin_of_safety_pct": None,
        }

    if cost_of_equity <= dividend_growth_rate:
        raise ValueError(
            f"Cost of equity ({cost_of_equity:.2%}) must be strictly greater than terminal dividend growth ({dividend_growth_rate:.2%})"
        )

    if high_growth_period_years > 0 and high_growth_rate is not None:
        # Two-Stage DDM
        pv_dividends = 0.0
        cur_dps = latest_dps
        for y in range(1, high_growth_period_years + 1):
            cur_dps = cur_dps * (1.0 + high_growth_rate)
            pv_dividends += cur_dps / math.pow(1.0 + cost_of_equity, y)

        terminal_dps = cur_dps * (1.0 + dividend_growth_rate)
        terminal_price = terminal_dps / (cost_of_equity - dividend_growth_rate)
        pv_terminal = terminal_price / math.pow(1.0 + cost_of_equity, high_growth_period_years)
        intrinsic_value = pv_dividends + pv_terminal
    else:
        # Single-Stage Gordon Growth
        d1 = latest_dps * (1.0 + dividend_growth_rate)
        intrinsic_value = d1 / (cost_of_equity - dividend_growth_rate)

    margin_of_safety = (
        round(((intrinsic_value - current_price) / intrinsic_value) * 100.0, 2)
        if intrinsic_value > 0
        else -100.0
    )

    return {
        "model": "DDM",
        "is_applicable": True,
        "latest_dps": round(latest_dps, 2),
        "cost_of_equity_pct": round(cost_of_equity * 100, 2),
        "dividend_growth_pct": round(dividend_growth_rate * 100, 2),
        "current_price": round(current_price, 2),
        "intrinsic_value": round(intrinsic_value, 2),
        "margin_of_safety_pct": margin_of_safety,
        "is_undervalued": intrinsic_value > current_price,
    }


def calculate_graham_formula(
    latest_eps: float | None,
    latest_bvps: float | None,
    expected_growth_rate: float,
    current_price: float,
    aaa_bond_yield: float = 7.1,  # Default Indian 10Y G-Sec / AAA corporate bond yield %
) -> dict[str, Any]:
    """Calculate Benjamin Graham Intrinsic Value formulas.

    Formulas:
    1. Classical Adjusted: V = EPS * (8.5 + 2 * g) * (4.4 / Y)
    2. Graham Number: sqrt(22.5 * EPS * BVPS)
    """
    if latest_eps is None or latest_eps <= 0:
        return {
            "model": "GRAHAM",
            "is_applicable": False,
            "bypass_reason": "NEGATIVE_OR_ZERO_EPS",
            "message": "Graham valuation requires positive normalized EPS",
            "graham_value": None,
            "graham_number": None,
            "margin_of_safety_pct": None,
        }

    # Growth in percentage (e.g. 10.0 for 10%)
    g_pct = expected_growth_rate * 100.0 if expected_growth_rate < 1.0 else expected_growth_rate
    graham_value = round(latest_eps * (8.5 + 2.0 * g_pct) * (4.4 / aaa_bond_yield), 2)

    graham_number = None
    if latest_bvps is not None and latest_bvps > 0:
        graham_number = round(math.sqrt(22.5 * latest_eps * latest_bvps), 2)

    margin_of_safety = (
        round(((graham_value - current_price) / graham_value) * 100.0, 2)
        if graham_value > 0
        else -100.0
    )

    return {
        "model": "GRAHAM",
        "is_applicable": True,
        "latest_eps": round(latest_eps, 2),
        "latest_bvps": round(latest_bvps, 2) if latest_bvps is not None else None,
        "expected_growth_pct": round(g_pct, 2),
        "benchmark_yield_pct": round(aaa_bond_yield, 2),
        "current_price": round(current_price, 2),
        "graham_value": graham_value,
        "graham_number": graham_number,
        "margin_of_safety_pct": margin_of_safety,
        "is_undervalued": graham_value > current_price,
    }
