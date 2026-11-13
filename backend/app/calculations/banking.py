"""Deterministic banking and financial institution specific metrics."""

from decimal import Decimal


def net_interest_margin(
    nii: float | Decimal | None,
    total_assets: float | Decimal | None,
) -> float | None:
    """Net Interest Margin (NIM %).

    Formula: (Net Interest Income / Average Total Assets) * 100
    """
    if nii is None or total_assets is None:
        return None

    n = float(nii)
    a = float(total_assets)

    if a <= 0:
        return None

    return round((n / a) * 100.0, 2)


def cost_to_income_ratio(
    operating_expenses: float | Decimal | None,
    total_income: float | Decimal | None,
) -> float | None:
    """Cost-to-Income Ratio (%).

    Formula: (Operating Expenses / Total Income) * 100
    """
    if operating_expenses is None or total_income is None:
        return None

    oe = float(operating_expenses)
    ti = float(total_income)

    if ti <= 0:
        return None

    return round((oe / ti) * 100.0, 2)


def casa_ratio(
    casa_metric_val: float | Decimal | None,
) -> float | None:
    """CASA Ratio (%) (Current Account + Savings Account / Total Deposits)."""
    if casa_metric_val is None:
        return None
    val = float(casa_metric_val)
    # If reported as fraction 0.42, convert to percentage 42.0
    if 0 < val <= 1.0:
        val = val * 100.0
    return round(val, 2)


def npa_pct(
    npa_val: float | Decimal | None,
) -> float | None:
    """Gross or Net Non-Performing Assets (NPA %)."""
    if npa_val is None:
        return None
    val = float(npa_val)
    if 0 < val <= 1.0:
        val = val * 100.0
    return round(val, 2)


def capital_adequacy_ratio(
    car_val: float | Decimal | None,
) -> float | None:
    """Capital Adequacy Ratio (CAR / CRAR %)."""
    if car_val is None:
        return None
    val = float(car_val)
    if 0 < val <= 1.0:
        val = val * 100.0
    return round(val, 2)
