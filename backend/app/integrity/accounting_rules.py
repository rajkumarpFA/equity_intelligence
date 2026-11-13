"""Fundamental accounting identity validation rules."""

from decimal import Decimal

from app.integrity.models import RuleResult, ValidationRuleCode, ValidationSeverity

TOLERANCE_CRORES = Decimal("0.05")  # ₹5 Lakhs rounding tolerance for crore conversions


def validate_balance_sheet_identity(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
    is_banking: bool = False,
) -> RuleResult:
    """Validate Balance Sheet identity: Total Assets == Total Liabilities + Net Worth."""
    total_assets = facts_map.get("TOTAL_ASSETS")
    
    # Equity / Net Worth resolution
    net_worth = (
        facts_map.get("NET_WORTH")
        or facts_map.get("TOTAL_EQUITY")
        or (
            (facts_map.get("SHARE_CAPITAL", Decimal(0)) + facts_map.get("RESERVES_SURPLUS", Decimal(0)))
            if "SHARE_CAPITAL" in facts_map and "RESERVES_SURPLUS" in facts_map
            else None
        )
    )

    if total_assets is None or net_worth is None:
        return RuleResult(
            rule_code=ValidationRuleCode.BALANCE_SHEET_IDENTITY,
            severity=ValidationSeverity.INFO,
            passed=True,
            message="Skipping Balance Sheet identity: Total Assets or Net Worth not reported.",
            entity_type="STATEMENT",
            entity_id=statement_id,
            details={"total_assets": str(total_assets), "net_worth": str(net_worth)},
        )

    if is_banking:
        # Banking Model: Assets = Deposits + Borrowings + Other Liabilities + Net Worth
        deposits = facts_map.get("TOTAL_DEPOSITS", Decimal(0))
        borrowings = facts_map.get("BORROWINGS", Decimal(0))
        other_liab = facts_map.get("OTHER_LIABILITIES", Decimal(0))
        total_liab_equity = deposits + borrowings + other_liab + net_worth
    else:
        # Standard Industrial Model
        total_liab = facts_map.get("TOTAL_LIABILITIES")
        if total_liab is None:
            # Reconstruct from debt and current/non-current liabilities if available
            current_liab = facts_map.get("CURRENT_LIABILITIES", Decimal(0))
            non_current_liab = facts_map.get("NON_CURRENT_LIABILITIES", Decimal(0))
            total_debt = facts_map.get("TOTAL_DEBT", Decimal(0))
            total_liab = current_liab + non_current_liab + (total_debt if non_current_liab == 0 else Decimal(0))

        total_liab_equity = total_liab + net_worth

    discrepancy = abs(total_assets - total_liab_equity)
    passed = discrepancy <= TOLERANCE_CRORES

    if passed:
        msg = f"Balance Sheet balanced perfectly: Assets (₹{total_assets} Cr) == Liabilities + Equity (₹{total_liab_equity} Cr)."
        severity = ValidationSeverity.INFO
    else:
        msg = (
            f"Balance Sheet identity violation: Assets (₹{total_assets} Cr) does not equal "
            f"Liabilities + Equity (₹{total_liab_equity} Cr). Discrepancy of ₹{discrepancy} Cr."
        )
        severity = ValidationSeverity.ERROR

    return RuleResult(
        rule_code=ValidationRuleCode.BALANCE_SHEET_IDENTITY,
        severity=severity,
        passed=passed,
        message=msg,
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={
            "total_assets": str(total_assets),
            "total_liabilities_and_equity": str(total_liab_equity),
            "discrepancy_crores": str(discrepancy),
            "tolerance_crores": str(TOLERANCE_CRORES),
        },
    )


def validate_cash_flow_identity(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Validate Cash Flow identity: Net Cash Flow == CFO + CFI + CFF."""
    cfo = facts_map.get("CFO")
    cfi = facts_map.get("CFI")
    cff = facts_map.get("CFF")
    net_cf = facts_map.get("NET_CASH_FLOW")

    if cfo is None or cfi is None or cff is None:
        return RuleResult(
            rule_code=ValidationRuleCode.CASH_FLOW_IDENTITY,
            severity=ValidationSeverity.INFO,
            passed=True,
            message="Skipping Cash Flow identity: CFO, CFI, or CFF not fully available.",
            entity_type="STATEMENT",
            entity_id=statement_id,
            details={"cfo": str(cfo), "cfi": str(cfi), "cff": str(cff)},
        )

    computed_net = cfo + cfi + cff

    if net_cf is not None:
        discrepancy = abs(net_cf - computed_net)
        passed = discrepancy <= TOLERANCE_CRORES
        if passed:
            msg = f"Cash Flow reconciled: Net Cash (₹{net_cf} Cr) matches CFO + CFI + CFF."
            sev = ValidationSeverity.INFO
        else:
            msg = (
                f"Cash Flow discrepancy: Reported Net Cash (₹{net_cf} Cr) does not match "
                f"sum of activities (₹{computed_net} Cr). Discrepancy of ₹{discrepancy} Cr."
            )
            sev = ValidationSeverity.WARNING
    else:
        passed = True
        msg = f"Cash Flow computed net sum verified: ₹{computed_net} Cr (CFO+CFI+CFF)."
        sev = ValidationSeverity.INFO
        discrepancy = Decimal(0)

    return RuleResult(
        rule_code=ValidationRuleCode.CASH_FLOW_IDENTITY,
        severity=sev,
        passed=passed,
        message=msg,
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={
            "cfo": str(cfo),
            "cfi": str(cfi),
            "cff": str(cff),
            "computed_net": str(computed_net),
            "reported_net": str(net_cf) if net_cf is not None else None,
            "discrepancy_crores": str(discrepancy),
        },
    )


def validate_income_statement_articulation(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Validate Income Statement articulation: Total Revenue & Profit after Tax."""
    rev_ops = facts_map.get("REVENUE_FROM_OPERATIONS")
    other_inc = facts_map.get("OTHER_INCOME", Decimal(0))
    total_rev = facts_map.get("TOTAL_REVENUE")

    pbt = facts_map.get("PBT")
    tax = facts_map.get("TAX_EXPENSE", Decimal(0))
    pat = facts_map.get("PAT")

    discrepancies: list[str] = []

    # Check Total Revenue articulation
    if rev_ops is not None and total_rev is not None:
        computed_rev = rev_ops + other_inc
        if abs(total_rev - computed_rev) > TOLERANCE_CRORES:
            discrepancies.append(
                f"Total Revenue (₹{total_rev} Cr) != Revenue from Ops (₹{rev_ops} Cr) + Other Income (₹{other_inc} Cr)"
            )

    # Check PAT articulation
    if pbt is not None and pat is not None:
        computed_pat = pbt - tax
        if abs(pat - computed_pat) > TOLERANCE_CRORES:
            discrepancies.append(
                f"PAT (₹{pat} Cr) != PBT (₹{pbt} Cr) - Tax (₹{tax} Cr)"
            )

    passed = len(discrepancies) == 0
    return RuleResult(
        rule_code=ValidationRuleCode.INCOME_STATEMENT_ARTICULATION,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.WARNING,
        passed=passed,
        message="Income Statement articulated cleanly." if passed else "; ".join(discrepancies),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={"discrepancies": discrepancies},
    )


def validate_banking_accounting_identity(
    facts_map: dict[str, Decimal],
    statement_id: int | None = None,
) -> RuleResult:
    """Validate Banking specific identities: NII == Interest Earned - Interest Expended."""
    int_earned = facts_map.get("INTEREST_EARNED")
    int_expended = facts_map.get("INTEREST_EXPENDED")
    nii = facts_map.get("NET_INTEREST_INCOME")

    if int_earned is None or int_expended is None or nii is None:
        return RuleResult(
            rule_code=ValidationRuleCode.BANKING_ACCOUNTING_IDENTITY,
            severity=ValidationSeverity.INFO,
            passed=True,
            message="Skipping Banking identity: NII, Interest Earned or Expended not present.",
            entity_type="STATEMENT",
            entity_id=statement_id,
            details={},
        )

    computed_nii = int_earned - int_expended
    discrepancy = abs(nii - computed_nii)
    passed = discrepancy <= TOLERANCE_CRORES

    return RuleResult(
        rule_code=ValidationRuleCode.BANKING_ACCOUNTING_IDENTITY,
        severity=ValidationSeverity.INFO if passed else ValidationSeverity.ERROR,
        passed=passed,
        message=(
            f"Banking NII verified: ₹{nii} Cr matches Interest Earned (₹{int_earned} Cr) - Expended (₹{int_expended} Cr)."
            if passed
            else f"Banking NII discrepancy: Reported ₹{nii} Cr vs computed ₹{computed_nii} Cr (diff ₹{discrepancy} Cr)."
        ),
        entity_type="STATEMENT",
        entity_id=statement_id,
        details={
            "interest_earned": str(int_earned),
            "interest_expended": str(int_expended),
            "reported_nii": str(nii),
            "computed_nii": str(computed_nii),
        },
    )
