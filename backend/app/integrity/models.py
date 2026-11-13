"""Data structures and enums for Data Integrity Engine."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ValidationSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ValidationRuleCode(str, Enum):
    # Accounting Identities
    BALANCE_SHEET_IDENTITY = "BALANCE_SHEET_IDENTITY"
    CASH_FLOW_IDENTITY = "CASH_FLOW_IDENTITY"
    INCOME_STATEMENT_ARTICULATION = "INCOME_STATEMENT_ARTICULATION"
    BANKING_ACCOUNTING_IDENTITY = "BANKING_ACCOUNTING_IDENTITY"

    # Consistency Safeguards
    MISSING_VALUE_PRESERVATION = "MISSING_VALUE_PRESERVATION"
    UNIT_CURRENCY_CONSISTENCY = "UNIT_CURRENCY_CONSISTENCY"
    REPORTING_BASIS_ISOLATION = "REPORTING_BASIS_ISOLATION"

    # Outliers & Anomalies
    YOY_ANOMALY = "YOY_ANOMALY"
    IMPOSSIBLE_MARGIN = "IMPOSSIBLE_MARGIN"
    NEGATIVE_VALUE_ANOMALY = "NEGATIVE_VALUE_ANOMALY"

    # Restatements & Corporate Actions
    RESTATEMENT_DETECTED = "RESTATEMENT_DETECTED"
    CORPORATE_ACTION_ADJUSTMENT = "CORPORATE_ACTION_ADJUSTMENT"


class RuleResult(BaseModel):
    rule_code: ValidationRuleCode
    severity: ValidationSeverity
    passed: bool
    message: str
    entity_type: str  # COMPANY, STATEMENT, SECURITY, FACT
    entity_id: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class IntegrityAuditSummary(BaseModel):
    company_id: int
    company_name: str
    total_checks: int
    passed_checks: int
    warning_checks: int
    error_checks: int
    is_healthy: bool
    results: list[RuleResult] = Field(default_factory=list)
