"""Corporate actions adjustment engine for price history and per-share financial facts."""

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class CorporateActionAdjustment(BaseModel):
    action_type: str  # SPLIT, BONUS, RIGHTS
    ex_date: date
    ratio_numerator: Decimal
    ratio_denominator: Decimal
    multiplier: Decimal  # Multiplier for share count; divisor for price & EPS


def calculate_action_multiplier(action_type: str, numerator: Decimal, denominator: Decimal) -> Decimal:
    """Calculate the share-count multiplier for a given corporate action."""
    action = action_type.strip().upper()
    if denominator <= Decimal(0):
        return Decimal("1.0")

    if action == "SPLIT":
        # E.g., 10:1 split -> 1 share becomes 10 shares
        return numerator / denominator
    elif action == "BONUS":
        # E.g., 1:1 bonus -> 1 existing share + 1 bonus share = 2 shares total
        return (denominator + numerator) / denominator
    elif action == "RIGHTS":
        # Conservative rights ratio expansion
        return (denominator + numerator) / denominator
    return Decimal("1.0")


def compute_cumulative_adjustment_factors(
    actions: list[dict[str, Any]],
    target_dates: list[date],
) -> dict[date, Decimal]:
    """Calculate cumulative adjustment factor for each historical trade date.
    
    For a historical date, the cumulative factor is the product of all multipliers
    from corporate actions with ex_date strictly greater than that historical date.
    """
    sorted_actions = sorted(actions, key=lambda a: a["ex_date"])

    factors: dict[date, Decimal] = {}

    for d in target_dates:
        cum_factor = Decimal("1.0")
        for act in sorted_actions:
            if act["ex_date"] > d:
                mult = calculate_action_multiplier(
                    act["action_type"],
                    Decimal(str(act["ratio_numerator"])),
                    Decimal(str(act["ratio_denominator"])),
                )
                cum_factor *= mult
        factors[d] = cum_factor

    return factors


def adjust_historical_price(
    raw_close: Decimal,
    cumulative_factor: Decimal,
) -> Decimal:
    """Adjust historical close price given cumulative split/bonus factor."""
    if cumulative_factor <= Decimal(0):
        return raw_close
    return round(raw_close / cumulative_factor, 4)


def adjust_historical_volume(
    raw_volume: int,
    cumulative_factor: Decimal,
) -> int:
    """Adjust historical trade volume to match post-action share count."""
    return int(Decimal(raw_volume) * cumulative_factor)


def adjust_per_share_metric(
    raw_metric: Decimal,
    cumulative_factor: Decimal,
) -> Decimal:
    """Adjust historical EPS or DPS for splits and bonus issues."""
    if cumulative_factor <= Decimal(0):
        return raw_metric
    return round(raw_metric / cumulative_factor, 4)
