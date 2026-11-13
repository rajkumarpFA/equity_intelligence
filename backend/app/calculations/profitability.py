"""Deterministic profitability ratios and DuPont decomposition."""

from decimal import Decimal


def operating_margin(
    ebit: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """Operating Profit Margin (EBIT Margin).

    Formula: (EBIT / Revenue) * 100
    """
    if ebit is None or revenue is None:
        return None
    r = float(revenue)
    if r <= 0:
        return None
    return round((float(ebit) / r) * 100.0, 2)


def ebitda_margin(
    ebitda: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """EBITDA Margin.

    Formula: (EBITDA / Revenue) * 100
    """
    if ebitda is None or revenue is None:
        return None
    r = float(revenue)
    if r <= 0:
        return None
    return round((float(ebitda) / r) * 100.0, 2)


def net_profit_margin(
    pat: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """Net Profit Margin (PAT Margin).

    Formula: (PAT / Revenue) * 100
    """
    if pat is None or revenue is None:
        return None
    r = float(revenue)
    if r <= 0:
        return None
    return round((float(pat) / r) * 100.0, 2)


def return_on_equity(
    pat: float | Decimal | None,
    equity: float | Decimal | None,
    prev_equity: float | Decimal | None = None,
) -> float | None:
    """Return on Equity (ROE).

    Formula: (PAT / Average Shareholder Equity) * 100
    If prev_equity is None, uses ending equity.
    Edge guard: If average equity <= 0, returns None (ROE is meaningless for negative equity / wiped-out net worth).
    """
    if pat is None or equity is None:
        return None

    e_curr = float(equity)
    avg_eq = (e_curr + float(prev_equity)) / 2.0 if prev_equity is not None else e_curr

    if avg_eq <= 0:
        return None

    return round((float(pat) / avg_eq) * 100.0, 2)


def return_on_capital_employed(
    ebit: float | Decimal | None,
    total_assets: float | Decimal | None = None,
    current_liabilities: float | Decimal | None = None,
    total_debt: float | Decimal | None = None,
    total_equity: float | Decimal | None = None,
) -> float | None:
    """Return on Capital Employed (ROCE).

    Formula: (EBIT / Capital Employed) * 100
    Capital Employed = (Total Assets - Current Liabilities) OR (Total Debt + Total Equity)
    Edge guard: If capital employed <= 0, returns None.
    """
    if ebit is None:
        return None

    cap_employed: float | None = None
    if total_debt is not None and total_equity is not None:
        cap_employed = float(total_debt) + float(total_equity)
    elif total_assets is not None and current_liabilities is not None:
        diff = float(total_assets) - float(current_liabilities)
        if diff > 0:
            cap_employed = diff

    if cap_employed is None or cap_employed <= 0:
        return None

    return round((float(ebit) / cap_employed) * 100.0, 2)


def return_on_assets(
    pat: float | Decimal | None,
    total_assets: float | Decimal | None,
    prev_assets: float | Decimal | None = None,
) -> float | None:
    """Return on Assets (ROA).

    Formula: (PAT / Average Total Assets) * 100
    """
    if pat is None or total_assets is None:
        return None

    a_curr = float(total_assets)
    avg_assets = (a_curr + float(prev_assets)) / 2.0 if prev_assets is not None else a_curr

    if avg_assets <= 0:
        return None

    return round((float(pat) / avg_assets) * 100.0, 2)


def dupont_analysis(
    pat: float | Decimal | None,
    revenue: float | Decimal | None,
    assets: float | Decimal | None,
    equity: float | Decimal | None,
) -> dict[str, float | None]:
    """3-Stage DuPont Decomposition of Return on Equity (ROE).

    Decomposition:
    ROE = Net Profit Margin × Asset Turnover × Financial Leverage (Equity Multiplier)

    Components:
    1. Net Profit Margin = PAT / Revenue (Operating & pricing efficiency)
    2. Asset Turnover = Revenue / Assets (Asset utilization efficiency)
    3. Equity Multiplier = Assets / Equity (Financial leverage)

    Mathematical Identity:
    (PAT / Revenue) * (Revenue / Assets) * (Assets / Equity) == PAT / Equity == ROE
    """
    if pat is None or revenue is None or assets is None or equity is None:
        return {
            "net_profit_margin_pct": None,
            "asset_turnover": None,
            "financial_leverage": None,
            "calculated_roe_pct": None,
        }

    p = float(pat)
    r = float(revenue)
    a = float(assets)
    e = float(equity)

    if r <= 0 or a <= 0 or e <= 0:
        return {
            "net_profit_margin_pct": None,
            "asset_turnover": None,
            "financial_leverage": None,
            "calculated_roe_pct": None,
        }

    npm = (p / r) * 100.0  # as percentage
    turnover = r / a
    leverage = a / e
    calculated_roe = (npm / 100.0) * turnover * leverage * 100.0

    return {
        "net_profit_margin_pct": round(npm, 2),
        "asset_turnover": round(turnover, 3),
        "financial_leverage": round(leverage, 3),
        "calculated_roe_pct": round(calculated_roe, 2),
    }
