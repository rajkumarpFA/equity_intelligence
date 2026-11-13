"""Consistency, unit/currency, and missing value safety rules."""

from decimal import Decimal
from typing import Any

from app.integrity.models import RuleResult, ValidationRuleCode, ValidationSeverity


def validate_missing_value_safety(
    raw_payload: dict[str, Any],
    statement_id: int | None = None,
) -> RuleResult:
    """Safeguard: Ensure missing/blank fields were not coerced into false '0' values."""
    coerced_zero_keys: list[str] = []

    for key, val in raw_payload.items():
        # Check if the original raw value was empty, NA, '-', or None, but stored as 0
        if isinstance(val, dict):
            raw_text = str(val.get("raw_value", "")).strip().lower()
            normalized_num = val.get("value")
            if raw_text in {"", "-", "na", "n/a", "nil", "null", "none"} and normalized_num == Decimal(0):
                coerced_zero_keys.append(key)

    passed = len(coerced_zero_keys) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.MISSING_VALUE_PRESERVATION,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.WARNING,
        passed=passed,
        message=(
            "Missing values safely preserved as NULL/None."
            if passed
            else f"Detected potential false-zero coercions on keys: {', '.join(coerced_zero_keys)}"
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"coerced_zero_keys": coerced_zero_keys},
    )


def validate_unit_currency_consistency(
    facts_with_units: list[dict[str, Any]],
    statement_id: int | None = None,
) -> RuleResult:
    """Verify all aggregate facts use INR and appropriate units (CRORES or PER_SHARE)."""
    mismatched: list[dict[str, str]] = []

    for f in facts_with_units:
        code = f.get("metric_code", "")
        unit = f.get("unit", "").upper()
        currency = f.get("currency", "INR").upper()

        if currency != "INR":
            mismatched.append({"metric": code, "issue": f"Unexpected currency '{currency}' (expected INR)"})

        # Per share metrics must be PER_SHARE
        if any(term in code for term in ["EPS", "DPS", "BOOK_VALUE_PER_SHARE"]):
            if unit not in {"PER_SHARE", "INR"}:
                mismatched.append({"metric": code, "issue": f"Per-share metric has unit '{unit}'"})
        elif unit not in {"CRORES", "PERCENTAGE", "RATIO", "COUNT"}:
            mismatched.append({"metric": code, "issue": f"Aggregate financial fact has unexpected unit '{unit}'"})

    passed = len(mismatched) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.UNIT_CURRENCY_CONSISTENCY,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.WARNING,
        passed=passed,
        message=(
            "All statement facts consistently use standardized INR and Crores/Per-Share units."
            if passed
            else f"Found {len(mismatched)} unit/currency inconsistencies."
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"mismatches": mismatched},
    )


def validate_reporting_basis_isolation(
    declared_basis: str,
    target_basis: str,
    statement_id: int | None = None,
) -> RuleResult:
    """Enforce strict isolation between STANDALONE and CONSOLIDATED statements."""
    passed = declared_basis.upper() == target_basis.upper()
    return RuleResult(
        rule_code=ValidationRuleCode.REPORTING_BASIS_ISOLATION,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.ERROR,
        passed=passed,
        message=(
            f"Reporting basis '{declared_basis}' is strictly isolated."
            if passed
            else f"Reporting basis cross-contamination: declared '{declared_basis}' but processed as '{target_basis}'."
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"declared_basis": declared_basis, "target_basis": target_basis},
    )
