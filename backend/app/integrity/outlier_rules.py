"""Outlier, YoY anomaly, and impossible value validation rules."""

from decimal import Decimal
from typing import Any

from app.integrity.models import RuleResult, ValidationRuleCode, ValidationSeverity


def validate_yoy_anomalies(
    current_facts: dict[str, Decimal],
    prior_facts: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Detect extreme YoY growth spikes or plunges that suggest restatements, corporate spin-offs, or unit errors."""
    anomalies: list[dict[str, Any]] = []

    metrics_to_check = [
        ("REVENUE", ["REVENUE", "REVENUE_FROM_OPERATIONS", "TOTAL_REVENUE"], Decimal("1.5"), Decimal("-0.75")),
        ("TOTAL_DEBT", ["TOTAL_DEBT"], Decimal("2.0"), Decimal("-0.80")),
        ("PAT", ["PAT", "NET_PROFIT"], Decimal("3.0"), Decimal("-1.5")),
    ]

    for label, aliases, max_growth, min_growth in metrics_to_check:
        curr_val = next((current_facts[k] for k in aliases if k in current_facts), None)
        prev_val = next((prior_facts[k] for k in aliases if k in prior_facts), None)

        if curr_val is not None and prev_val is not None and prev_val > Decimal(0):
            growth = (curr_val - prev_val) / prev_val
            growth_pct = round(growth * Decimal(100), 2)

            if growth > max_growth:
                anomalies.append({
                    "metric": label,
                    "previous_value": str(prev_val),
                    "current_value": str(curr_val),
                    "growth_pct": f"+{growth_pct}%",
                    "reason": f"Extreme YoY increase (+{growth_pct}%) exceeds threshold (+{max_growth * 100}%).",
                })
            elif growth < min_growth:
                anomalies.append({
                    "metric": label,
                    "previous_value": str(prev_val),
                    "current_value": str(curr_val),
                    "growth_pct": f"{growth_pct}%",
                    "reason": f"Severe YoY collapse ({growth_pct}%) exceeds threshold ({min_growth * 100}%).",
                })

    passed = len(anomalies) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.YOY_ANOMALY,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.WARNING,
        passed=passed,
        message=(
            "YoY growth metrics are within normal operating ranges."
            if passed
            else f"Detected {len(anomalies)} YoY metric anomalies requiring review."
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"anomalies": anomalies},
    )


def validate_impossible_margins(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Detect impossible margins (e.g. Net Margin > 100% or < -300%)."""
    rev = facts_map.get("REVENUE_FROM_OPERATIONS") or facts_map.get("TOTAL_REVENUE") or facts_map.get("REVENUE")
    pat = facts_map.get("PAT") or facts_map.get("NET_PROFIT")
    ebitda = facts_map.get("EBITDA") or facts_map.get("OPERATING_PROFIT")

    violations: list[str] = []

    if rev is not None and rev > Decimal(0):
        if pat is not None:
            net_margin = pat / rev
            if net_margin > Decimal("1.0"):
                violations.append(f"Net Profit Margin {round(net_margin * 100, 2)}% exceeds 100%")
            elif net_margin < Decimal("-3.0"):
                violations.append(f"Net Profit Margin {round(net_margin * 100, 2)}% is below -300%")

        if ebitda is not None:
            op_margin = ebitda / rev
            if op_margin > Decimal("1.0"):
                violations.append(f"Operating Margin {round(op_margin * 100, 2)}% exceeds 100%")
            elif op_margin < Decimal("-3.0"):
                violations.append(f"Operating Margin {round(op_margin * 100, 2)}% is below -300%")

    passed = len(violations) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.IMPOSSIBLE_MARGIN,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.ERROR,
        passed=passed,
        message="Profit margins are mathematically reasonable." if passed else "; ".join(violations),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"violations": violations},
    )


def validate_negative_value_safeguards(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Flag impossible negative values on strictly non-negative items (Assets, Revenue, Share Capital)."""
    violations: list[str] = []

    strictly_positive = [
        ("TOTAL_ASSETS", "Total Assets"),
        ("SHARE_CAPITAL", "Share Capital"),
        ("REVENUE_FROM_OPERATIONS", "Revenue from Operations"),
    ]

    for key, label in strictly_positive:
        val = facts_map.get(key)
        if val is not None and val < Decimal(0):
            violations.append(f"{label} has negative value: ₹{val} Cr")

    passed = len(violations) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.NEGATIVE_VALUE_ANOMALY,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.ERROR,
        passed=passed,
        message="All strictly non-negative accounts verified." if passed else "; ".join(violations),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"violations": violations},
    )
