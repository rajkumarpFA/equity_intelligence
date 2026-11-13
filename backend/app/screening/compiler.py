"""Dynamic AST compiler and condition evaluator for the equity screener."""

from typing import Any
from app.screening.models import FilterCondition, FilterExpression, ScreenedCompanyItem

FIELD_ALIASES: dict[str, str] = {
    "pe": "pe_ratio",
    "pb": "pb_ratio",
    "price": "current_price",
    "market_cap": "market_cap_cr",
    "roe": "roe_pct",
    "roce": "roce_pct",
    "roa": "roa_pct",
    "opm": "operating_margin_pct",
    "npm": "net_profit_margin_pct",
    "operating_margin": "operating_margin_pct",
    "net_margin": "net_profit_margin_pct",
    "de": "debt_to_equity",
    "icr": "interest_coverage",
    "ccc": "cash_conversion_cycle_days",
    "piotroski": "piotroski_f_score",
    "altman": "altman_z_score",
    "nim": "net_interest_margin_pct",
    "casa": "casa_ratio_pct",
    "npa": "gross_npa_pct",
    "car": "capital_adequacy_ratio_pct",
    "sector": "sector_name",
    "industry": "industry_name",
}


def resolve_field_name(field_raw: str) -> str:
    """Normalize input field name through canonical aliases."""
    clean = field_raw.lower().strip()
    return FIELD_ALIASES.get(clean, clean)


def evaluate_condition(item: ScreenedCompanyItem, condition: FilterCondition) -> bool:
    """Evaluate a single screening condition against a company record.
    
    Data Integrity Rule: If the company's metric value is None, numeric comparisons
    strictly evaluate to False. None is never coerced to 0 or any default number.
    """
    field_name = resolve_field_name(condition.field)
    if not hasattr(item, field_name):
        return False

    val = getattr(item, field_name)

    # If the attribute is None, only explicit equality/inequality to None is true
    if val is None:
        if condition.operator == "==" and condition.value is None:
            return True
        if condition.operator == "!=" and condition.value is not None:
            return True
        return False

    op = condition.operator
    target_val = condition.value

    # String operations (case-insensitive)
    if isinstance(val, str):
        val_str = val.lower().strip()
        if op == "==":
            return val_str == str(target_val).lower().strip()
        if op == "!=":
            return val_str != str(target_val).lower().strip()
        if op == "contains":
            return str(target_val).lower().strip() in val_str
        if op == "in":
            if isinstance(target_val, list):
                target_list = [str(x).lower().strip() for x in target_val]
                return val_str in target_list
            return val_str == str(target_val).lower().strip()
        if op == "not_in":
            if isinstance(target_val, list):
                target_list = [str(x).lower().strip() for x in target_val]
                return val_str not in target_list
            return val_str != str(target_val).lower().strip()
        return False

    # Boolean operations
    if isinstance(val, bool):
        target_bool = bool(target_val)
        if op in ("==", "="):
            return val is target_bool
        if op == "!=":
            return val is not target_bool
        return False

    # Numeric operations (float / int)
    try:
        num_val = float(val)
        num_target = float(target_val)
    except (TypeError, ValueError):
        return False

    if op == ">":
        return num_val > num_target
    if op == ">=":
        return num_val >= num_target
    if op == "<":
        return num_val < num_target
    if op == "<=":
        return num_val <= num_target
    if op in ("==", "="):
        return abs(num_val - num_target) < 1e-4
    if op == "!=":
        return abs(num_val - num_target) >= 1e-4
    if op == "between":
        if condition.second_value is None:
            return False
        try:
            num_second = float(condition.second_value)
            low = min(num_target, num_second)
            high = max(num_target, num_second)
            return low <= num_val <= high
        except (TypeError, ValueError):
            return False

    return False


def evaluate_expression(item: ScreenedCompanyItem, expr: FilterExpression) -> bool:
    """Evaluate a complete AST FilterExpression with AND / OR conjunction logic."""
    if not expr.conditions:
        return True

    conjunction = expr.conjunction.upper().strip()

    if conjunction == "AND":
        for cond in expr.conditions:
            if not evaluate_condition(item, cond):
                return False
        return True

    if conjunction == "OR":
        for cond in expr.conditions:
            if evaluate_condition(item, cond):
                return True
        return False

    return True
