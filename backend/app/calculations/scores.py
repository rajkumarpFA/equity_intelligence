"""Deterministic financial quality and bankruptcy health scores (Altman Z-Score & Piotroski F-Score)."""

from decimal import Decimal
from typing import Any


def calculate_altman_z_score(
    working_capital: float | Decimal | None,
    total_assets: float | Decimal | None,
    retained_earnings: float | Decimal | None,
    ebit: float | Decimal | None,
    book_equity: float | Decimal | None,
    total_liabilities: float | Decimal | None,
    sales: float | Decimal | None = None,
    market_cap: float | Decimal | None = None,
    is_manufacturing: bool = False,
) -> dict[str, Any]:
    """Calculate Altman Z-Score for financial distress & bankruptcy risk.

    Emerging Market / Non-Manufacturing Model (Altman Z'-score):
    Z' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
    where:
    X1 = Working Capital / Total Assets
    X2 = Retained Earnings (or Reserves) / Total Assets
    X3 = EBIT / Total Assets
    X4 = Book Value of Equity / Total Liabilities

    Zones:
    - Safe Zone: Z > 2.60
    - Grey Zone: 1.10 <= Z <= 2.60
    - Distress Zone: Z < 1.10
    """
    if (
        total_assets is None
        or total_liabilities is None
        or ebit is None
        or book_equity is None
    ):
        return {
            "score": None,
            "zone": "UNAVAILABLE",
            "interpretation": "Insufficient balance sheet or earnings history to compute Altman Z-Score.",
            "components": {},
        }

    ta = float(total_assets)
    tl = float(total_liabilities)
    eb = float(ebit)
    eq = float(book_equity)
    wc = float(working_capital) if working_capital is not None else (eq - 0.2 * ta)
    re = float(retained_earnings) if retained_earnings is not None else (eq * 0.7)

    if ta <= 0 or tl <= 0:
        return {
            "score": None,
            "zone": "UNAVAILABLE",
            "interpretation": "Zero or negative assets/liabilities; cannot calculate score.",
            "components": {},
        }

    x1 = wc / ta
    x2 = re / ta
    x3 = eb / ta
    x4 = eq / tl

    if is_manufacturing and sales is not None and market_cap is not None:
        # Classical 5-factor manufacturing model
        mc = float(market_cap)
        s = float(sales)
        x4_mkt = mc / tl
        x5 = s / ta
        z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4_mkt + 0.999 * x5

        if z > 2.99:
            zone = "SAFE"
            interpretation = "Pristine financial health; minimal insolvency risk."
        elif z >= 1.81:
            zone = "GREY"
            interpretation = "Moderate stability; potential vulnerability under stress."
        else:
            zone = "DISTRESS"
            interpretation = "Substantial financial distress; elevated probability of insolvency."

        return {
            "score": round(z, 2),
            "zone": zone,
            "model": "MANUFACTURING_5_FACTOR",
            "interpretation": interpretation,
            "components": {
                "x1_working_capital_to_assets": round(x1, 3),
                "x2_retained_earnings_to_assets": round(x2, 3),
                "x3_ebit_to_assets": round(x3, 3),
                "x4_market_cap_to_liabilities": round(x4_mkt, 3),
                "x5_sales_to_assets": round(x5, 3),
            },
        }

    # Non-manufacturing / general 4-factor model
    z_prime = 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4

    if z_prime > 2.60:
        zone = "SAFE"
        interpretation = "Healthy balance sheet; negligible financial distress."
    elif z_prime >= 1.10:
        zone = "GREY"
        interpretation = "Moderate leverage and liquidity buffer; caution warranted."
    else:
        zone = "DISTRESS"
        interpretation = "Severe capital distress; vulnerable to solvency shocks."

    return {
        "score": round(z_prime, 2),
        "zone": zone,
        "model": "NON_MANUFACTURING_4_FACTOR",
        "interpretation": interpretation,
        "components": {
            "x1_working_capital_to_assets": round(x1, 3),
            "x2_retained_earnings_to_assets": round(x2, 3),
            "x3_ebit_to_assets": round(x3, 3),
            "x4_equity_to_liabilities": round(x4, 3),
        },
    }


def calculate_piotroski_f_score(
    curr: dict[str, float | Decimal | None],
    prev: dict[str, float | Decimal | None],
) -> dict[str, Any]:
    """Calculate 9-Factor Piotroski F-Score (0 to 9).

    Parameters:
    - curr: dictionary of current period metrics
    - prev: dictionary of prior period metrics

    Keys expected:
    - pat: Profit after tax
    - cfo: Operating cash flow
    - total_assets: Total assets
    - long_term_debt: Long-term debt
    - current_assets: Current assets
    - current_liabilities: Current liabilities
    - equity_capital: Equity share capital (proxy for share count)
    - revenue: Sales / Revenue
    - cost_of_materials: or operating expenses (for gross/operating margin)
    """
    factors: dict[str, dict[str, Any]] = {}
    total_score = 0

    def to_f(v: Any) -> float | None:
        if v is None:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    # Helper values
    pat_t = to_f(curr.get("pat"))
    pat_t1 = to_f(prev.get("pat"))

    cfo_t = to_f(curr.get("cfo"))

    ta_t = to_f(curr.get("total_assets"))
    ta_t1 = to_f(prev.get("total_assets"))

    ltd_t = to_f(curr.get("long_term_debt")) or 0.0
    ltd_t1 = to_f(prev.get("long_term_debt")) or 0.0

    ca_t = to_f(curr.get("current_assets"))
    cl_t = to_f(curr.get("current_liabilities"))
    ca_t1 = to_f(prev.get("current_assets"))
    cl_t1 = to_f(prev.get("current_liabilities"))

    eq_t = to_f(curr.get("equity_capital"))
    eq_t1 = to_f(prev.get("equity_capital"))

    rev_t = to_f(curr.get("revenue"))
    rev_t1 = to_f(prev.get("revenue"))

    # GROUP 1: PROFITABILITY (4 Points)
    # 1. Positive Net Income
    f1 = bool(pat_t is not None and pat_t > 0)
    factors["positive_net_income"] = {
        "score": 1 if f1 else 0,
        "description": "Positive Net Profit (PAT > 0)",
        "value": pat_t,
    }
    if f1:
        total_score += 1

    # 2. Positive Operating Cash Flow
    f2 = bool(cfo_t is not None and cfo_t > 0)
    factors["positive_operating_cash_flow"] = {
        "score": 1 if f2 else 0,
        "description": "Positive Operating Cash Flow (CFO > 0)",
        "value": cfo_t,
    }
    if f2:
        total_score += 1

    # 3. Higher Return on Assets (ROA)
    roa_t = (pat_t / ta_t) if pat_t is not None and ta_t and ta_t > 0 else None
    roa_t1 = (pat_t1 / ta_t1) if pat_t1 is not None and ta_t1 and ta_t1 > 0 else None
    f3 = bool(roa_t is not None and roa_t1 is not None and roa_t > roa_t1)
    factors["higher_roa"] = {
        "score": 1 if f3 else 0,
        "description": "Return on Assets higher than previous year",
        "current_roa": round(roa_t * 100, 2) if roa_t is not None else None,
        "prev_roa": round(roa_t1 * 100, 2) if roa_t1 is not None else None,
    }
    if f3:
        total_score += 1

    # 4. Cash Flow Quality (Accrual check: CFO > PAT)
    f4 = bool(cfo_t is not None and pat_t is not None and cfo_t > pat_t)
    factors["quality_of_earnings"] = {
        "score": 1 if f4 else 0,
        "description": "Operating Cash Flow exceeds Net Income (high earnings quality)",
        "cfo": cfo_t,
        "pat": pat_t,
    }
    if f4:
        total_score += 1

    # GROUP 2: LEVERAGE, LIQUIDITY & SOURCE OF FUNDS (3 Points)
    # 5. Lower Long-Term Debt / Assets
    gearing_t = (ltd_t / ta_t) if ta_t and ta_t > 0 else 0.0
    gearing_t1 = (ltd_t1 / ta_t1) if ta_t1 and ta_t1 > 0 else 0.0
    f5 = gearing_t <= gearing_t1
    factors["lower_gearing"] = {
        "score": 1 if f5 else 0,
        "description": "Lower or stable long-term debt ratio vs total assets",
        "current_gearing": round(gearing_t, 3),
        "prev_gearing": round(gearing_t1, 3),
    }
    if f5:
        total_score += 1

    # 6. Higher Current Ratio
    cr_t = (ca_t / cl_t) if ca_t is not None and cl_t and cl_t > 0 else None
    cr_t1 = (ca_t1 / cl_t1) if ca_t1 is not None and cl_t1 and cl_t1 > 0 else None
    f6 = bool(cr_t is not None and cr_t1 is not None and cr_t >= cr_t1)
    factors["higher_current_ratio"] = {
        "score": 1 if f6 else 0,
        "description": "Current ratio improved or held steady",
        "current_cr": round(cr_t, 2) if cr_t is not None else None,
        "prev_cr": round(cr_t1, 2) if cr_t1 is not None else None,
    }
    if f6:
        total_score += 1

    # 7. No Share Dilution
    f7 = bool(eq_t is not None and eq_t1 is not None and eq_t <= eq_t1 * 1.01)
    factors["no_dilution"] = {
        "score": 1 if f7 else 0,
        "description": "No equity dilution (shares outstanding stable or decreased)",
        "current_equity": eq_t,
        "prev_equity": eq_t1,
    }
    if f7:
        total_score += 1

    # GROUP 3: OPERATING EFFICIENCY (2 Points)
    # 8. Higher Gross / Net Margin
    margin_t = (pat_t / rev_t) if pat_t is not None and rev_t and rev_t > 0 else None
    margin_t1 = (pat_t1 / rev_t1) if pat_t1 is not None and rev_t1 and rev_t1 > 0 else None
    f8 = bool(margin_t is not None and margin_t1 is not None and margin_t > margin_t1)
    factors["higher_margin"] = {
        "score": 1 if f8 else 0,
        "description": "Net margin improved over prior year",
        "current_margin": round(margin_t * 100, 2) if margin_t is not None else None,
        "prev_margin": round(margin_t1 * 100, 2) if margin_t1 is not None else None,
    }
    if f8:
        total_score += 1

    # 9. Higher Asset Turnover
    turn_t = (rev_t / ta_t) if rev_t is not None and ta_t and ta_t > 0 else None
    turn_t1 = (rev_t1 / ta_t1) if rev_t1 is not None and ta_t1 and ta_t1 > 0 else None
    f9 = bool(turn_t is not None and turn_t1 is not None and turn_t > turn_t1)
    factors["higher_asset_turnover"] = {
        "score": 1 if f9 else 0,
        "description": "Asset turnover ratio improved (efficient asset utilization)",
        "current_turnover": round(turn_t, 3) if turn_t is not None else None,
        "prev_turnover": round(turn_t1, 3) if turn_t1 is not None else None,
    }
    if f9:
        total_score += 1

    # Interpretation
    if total_score >= 8:
        rating = "VERY_STRONG"
        summary = "Exceptional financial health and operating trajectory across profitability, leverage, and efficiency."
    elif total_score >= 5:
        rating = "MODERATE"
        summary = "Average financial condition with stable fundamentals."
    else:
        rating = "WEAK"
        summary = "Substantial fundamental deterioration across margins, cash flows, or financial leverage."

    return {
        "score": total_score,
        "max_score": 9,
        "rating": rating,
        "summary": summary,
        "profitability_score": sum(factors[k]["score"] for k in ["positive_net_income", "positive_operating_cash_flow", "higher_roa", "quality_of_earnings"]),
        "leverage_score": sum(factors[k]["score"] for k in ["lower_gearing", "higher_current_ratio", "no_dilution"]),
        "efficiency_score": sum(factors[k]["score"] for k in ["higher_margin", "higher_asset_turnover"]),
        "factors": factors,
    }
