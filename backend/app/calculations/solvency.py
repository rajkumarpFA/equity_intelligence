"""Deterministic solvency and capital structure calculations."""

from decimal import Decimal


def debt_to_equity(
    total_debt: float | Decimal | None,
    shareholder_equity: float | Decimal | None,
) -> float | None:
    """Debt to Equity Ratio (D/E).

    Formula: Total Debt / Shareholder Equity
    Edge guard: If equity <= 0, returns None (negative net worth makes D/E misleading).
    """
    if total_debt is None or shareholder_equity is None:
        return None

    d = float(total_debt)
    e = float(shareholder_equity)

    if e <= 0:
        return None

    return round(d / e, 2)


def interest_coverage(
    ebit: float | Decimal | None,
    finance_costs: float | Decimal | None,
) -> float | None:
    """Interest Coverage Ratio.

    Formula: EBIT / Finance Costs (Interest Expense)
    Edge guard:
    - If finance_costs is 0 or None, return None (or effectively infinite/debt-free).
    """
    if ebit is None or finance_costs is None:
        return None

    eb = float(ebit)
    fc = float(finance_costs)

    if fc <= 0:
        return None

    return round(eb / fc, 2)


def current_ratio(
    current_assets: float | Decimal | None,
    current_liabilities: float | Decimal | None,
) -> float | None:
    """Current Ratio.

    Formula: Current Assets / Current Liabilities
    """
    if current_assets is None or current_liabilities is None:
        return None

    ca = float(current_assets)
    cl = float(current_liabilities)

    if cl <= 0:
        return None

    return round(ca / cl, 2)


def quick_ratio(
    current_assets: float | Decimal | None,
    inventories: float | Decimal | None,
    current_liabilities: float | Decimal | None,
) -> float | None:
    """Quick Ratio (Acid-Test Ratio).

    Formula: (Current Assets - Inventories) / Current Liabilities
    """
    if current_assets is None or current_liabilities is None:
        return None

    ca = float(current_assets)
    inv = float(inventories) if inventories is not None else 0.0
    cl = float(current_liabilities)

    if cl <= 0:
        return None

    return round((ca - inv) / cl, 2)


def debt_to_assets(
    total_debt: float | Decimal | None,
    total_assets: float | Decimal | None,
) -> float | None:
    """Debt to Assets Ratio.

    Formula: Total Debt / Total Assets
    """
    if total_debt is None or total_assets is None:
        return None

    d = float(total_debt)
    a = float(total_assets)

    if a <= 0:
        return None

    return round(d / a, 2)
