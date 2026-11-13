"""Deterministic growth calculations for financial statements (CAGR & YoY)."""

from decimal import Decimal


def calculate_cagr(
    start_val: float | Decimal | None,
    end_val: float | Decimal | None,
    years: int,
) -> float | None:
    """Calculate Compound Annual Growth Rate (CAGR).

    Formula: (End Value / Start Value) ** (1 / years) - 1

    Edge-case guards:
    - If start_val <= 0 or end_val <= 0, CAGR is mathematically undefined/meaningless; returns None.
    - If years <= 0, returns None.
    - If either value is None, returns None.
    """
    if start_val is None or end_val is None or years <= 0:
        return None

    s = float(start_val)
    e = float(end_val)

    if s <= 0 or e <= 0:
        return None

    try:
        cagr = (e / s) ** (1.0 / years) - 1.0
        return round(cagr * 100.0, 2)  # Return as percentage, e.g. 15.42%
    except (ZeroDivisionError, ValueError, OverflowError):
        return None


def calculate_yoy_growth(
    current_val: float | Decimal | None,
    previous_val: float | Decimal | None,
) -> float | None:
    """Calculate Year-over-Year (YoY) percentage change.

    Formula: ((Current - Previous) / abs(Previous)) * 100
    """
    if current_val is None or previous_val is None:
        return None

    c = float(current_val)
    p = float(previous_val)

    if p == 0:
        return None

    try:
        growth = ((c - p) / abs(p)) * 100.0
        return round(growth, 2)
    except (ZeroDivisionError, ValueError, OverflowError):
        return None
