"""Restatement versioning, detection, and fact-level audit trail manager."""

from decimal import Decimal
from typing import Any

from app.integrity.models import RuleResult, ValidationRuleCode, ValidationSeverity


def compute_restatement_diff(
    original_facts: dict[str, Decimal],
    restated_facts: dict[str, Decimal],
    statement_id: int | None = None,
    superseded_id: int | None = None,
) -> RuleResult:
    """Compute line-by-line restatement differences between original and revised statement facts."""
    differences: list[dict[str, Any]] = []

    all_keys = set(original_facts.keys()).union(set(restated_facts.keys()))

    for key in sorted(all_keys):
        orig_val = original_facts.get(key)
        new_val = restated_facts.get(key)

        if orig_val is not None and new_val is not None:
            if orig_val != new_val:
                diff = new_val - orig_val
                pct_change = round((diff / orig_val) * Decimal(100), 2) if orig_val != Decimal(0) else None
                differences.append({
                    "metric_code": key,
                    "original_value": str(orig_val),
                    "restated_value": str(new_val),
                    "difference": str(diff),
                    "pct_change": f"{pct_change}%" if pct_change is not None else "N/A",
                })
        elif orig_val is None and new_val is not None:
            differences.append({
                "metric_code": key,
                "original_value": None,
                "restated_value": str(new_val),
                "difference": str(new_val),
                "pct_change": "NEW_METRIC",
            })
        elif orig_val is not None and new_val is None:
            differences.append({
                "metric_code": key,
                "original_value": str(orig_val),
                "restated_value": None,
                "difference": str(-orig_val),
                "pct_change": "REMOVED_METRIC",
            })

    is_restated = len(differences) > 0
    return RuleResult(
        rule_code=ValidationRuleCode.RESTATEMENT_DETECTED,
        severity=ValidationSeverity.WARNING if is_restated else ValidationSeverity.INFO,
        passed=not is_restated,
        message=(
            f"Restatement detected with {len(differences)} modified fact lines. Supersedes statement #{superseded_id}."
            if is_restated
            else "No restatement discrepancies detected; reported facts are identical."
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={
            "superseded_statement_id": superseded_id,
            "modified_facts_count": len(differences),
            "differences": differences,
        },
    )
