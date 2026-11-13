"""Data Integrity Service coordinating accounting rules, anomaly checks, and restatement audits."""

import logging
from decimal import Decimal

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.integrity.accounting_rules import (
    validate_balance_sheet_identity,
    validate_banking_accounting_identity,
    validate_cash_flow_identity,
    validate_income_statement_articulation,
)
from app.integrity.corporate_action_adjuster import (
    adjust_historical_price,
    compute_cumulative_adjustment_factors,
)
from app.integrity.models import (
    IntegrityAuditSummary,
    RuleResult,
    ValidationSeverity,
)
from app.integrity.outlier_rules import (
    validate_impossible_margins,
    validate_negative_value_safeguards,
    validate_yoy_anomalies,
)
from app.integrity.restatement_manager import compute_restatement_diff
from app.models.company import Company, Security
from app.models.financials import FinancialFact, FinancialStatement
from app.models.ingestion import ValidationResult
from app.models.market_data import CorporateAction, PriceHistory

logger = logging.getLogger("app.services.integrity")


class IntegrityService:
    def __init__(self, db: Session):
        self.db = db

    def validate_statement(self, statement_id: int, job_id: int | None = None) -> list[RuleResult]:
        """Execute all relevant accounting rules, margin checks, and safeguards for a statement."""
        stmt = (
            select(FinancialStatement)
            .where(FinancialStatement.id == statement_id)
            .options(
                joinedload(FinancialStatement.facts).joinedload(FinancialFact.metric),
                joinedload(FinancialStatement.company),
            )
        )
        statement = self.db.execute(stmt).unique().scalar_one_or_none()
        if not statement:
            raise ValueError(f"Statement #{statement_id} not found.")

        facts_map: dict[str, Decimal] = {}
        for f in statement.facts:
            if f.metric and f.value is not None:
                facts_map[f.metric.code.upper()] = f.value

        is_banking = statement.company.is_financial_sector if statement.company else False
        results: list[RuleResult] = []

        # 1. Statement Type-Specific Accounting Identities
        if statement.statement_type == "BALANCE_SHEET":
            results.append(
                validate_balance_sheet_identity(
                    facts_map=facts_map,
                    statement_id=statement.id,
                    is_banking=is_banking,
                )
            )
        elif statement.statement_type == "CASH_FLOW":
            results.append(
                validate_cash_flow_identity(
                    facts_map=facts_map,
                    statement_id=statement.id,
                )
            )
        elif statement.statement_type in {"INCOME_STATEMENT", "PROFIT_LOSS"}:
            if is_banking:
                results.append(
                    validate_banking_accounting_identity(
                        facts_map=facts_map,
                        statement_id=statement.id,
                    )
                )
            else:
                results.append(
                    validate_income_statement_articulation(
                        facts_map=facts_map,
                        statement_id=statement.id,
                    )
                )

        # 2. General Safeguards & Impossible Margins
        results.append(
            validate_impossible_margins(facts_map=facts_map, statement_id=statement.id)
        )
        results.append(
            validate_negative_value_safeguards(facts_map=facts_map, statement_id=statement.id)
        )

        # 3. Persist findings to database
        self._persist_validation_results(results, job_id=job_id)
        return results

    def validate_company_financials(
        self, company_id: int, job_id: int | None = None
    ) -> IntegrityAuditSummary:
        """Run comprehensive integrity audit across all financial statements and YoY history."""
        company = self.db.get(Company, company_id)
        if not company:
            raise ValueError(f"Company #{company_id} not found.")

        # Query all statements ordered by fiscal period
        stmt = (
            select(FinancialStatement)
            .where(FinancialStatement.company_id == company_id)
            .order_by(FinancialStatement.period_end.asc())
            .options(joinedload(FinancialStatement.facts).joinedload(FinancialFact.metric))
        )
        statements = self.db.execute(stmt).unique().scalars().all()

        all_results: list[RuleResult] = []

        # Validate each statement individually
        by_type_basis: dict[tuple[str, str], list[FinancialStatement]] = {}
        for s in statements:
            s_results = self.validate_statement(s.id, job_id=job_id)
            all_results.extend(s_results)
            key = (s.statement_type, s.reporting_basis)
            by_type_basis.setdefault(key, []).append(s)

        # Run YoY anomaly detection between consecutive annual statements
        for stmts in by_type_basis.values():
            annual_stmts = [s for s in stmts if s.period_type == "ANNUAL"]
            for i in range(1, len(annual_stmts)):
                prev = annual_stmts[i - 1]
                curr = annual_stmts[i]

                prev_map = {f.metric.code.upper(): f.value for f in prev.facts if f.metric and f.value is not None}
                curr_map = {f.metric.code.upper(): f.value for f in curr.facts if f.metric and f.value is not None}

                yoy_res = validate_yoy_anomalies(curr_map, prev_map, statement_id=curr.id)
                all_results.append(yoy_res)
                self._persist_validation_results([yoy_res], job_id=job_id)

        # Compute summary metrics
        total = len(all_results)
        passed = sum(1 for r in all_results if r.passed)
        warnings = sum(1 for r in all_results if not r.passed and r.severity == ValidationSeverity.WARNING)
        errors = sum(1 for r in all_results if not r.passed and r.severity in {ValidationSeverity.ERROR, ValidationSeverity.CRITICAL})
        is_healthy = errors == 0

        return IntegrityAuditSummary(
            company_id=company.id,
            company_name=company.name,
            total_checks=total,
            passed_checks=passed,
            warning_checks=warnings,
            error_checks=errors,
            is_healthy=is_healthy,
            results=all_results,
        )

    def record_restatement_audit(
        self,
        superseded_statement_id: int,
        new_statement_id: int,
        job_id: int | None = None,
    ) -> RuleResult:
        """Compare superseded statement against new restated statement and log audit trail."""
        orig = self.db.get(FinancialStatement, superseded_statement_id)
        rev = self.db.get(FinancialStatement, new_statement_id)

        if not orig or not rev:
            raise ValueError("Could not find statements to compare for restatement audit.")

        orig_map = {f.metric.code.upper(): f.value for f in orig.facts if f.metric and f.value is not None}
        rev_map = {f.metric.code.upper(): f.value for f in rev.facts if f.metric and f.value is not None}

        res = compute_restatement_diff(
            original_facts=orig_map,
            restated_facts=rev_map,
            statement_id=rev.id,
            superseded_id=orig.id,
        )
        self._persist_validation_results([res], job_id=job_id)
        return res

    def apply_corporate_actions_to_price_history(self, security_id: int) -> int:
        """Calculate cumulative split/bonus factors and adjust historical daily candles."""
        security = self.db.get(Security, security_id)
        if not security:
            raise ValueError(f"Security #{security_id} not found.")

        # Query all corporate actions for company/security
        ca_stmt = (
            select(CorporateAction)
            .where(
                CorporateAction.company_id == security.company_id,
                CorporateAction.action_type.in_(["SPLIT", "BONUS", "RIGHTS"]),
            )
            .order_by(CorporateAction.ex_date.asc())
        )
        actions = self.db.scalars(ca_stmt).all()
        if not actions:
            logger.info("No corporate actions found for Security #%s", security_id)
            return 0

        # Query daily price history for security
        p_stmt = (
            select(PriceHistory)
            .where(PriceHistory.security_id == security_id)
            .order_by(PriceHistory.trade_date.asc())
        )
        candles = self.db.scalars(p_stmt).all()
        if not candles:
            return 0

        action_dicts = [
            {
                "action_type": a.action_type,
                "ex_date": a.ex_date,
                "ratio_numerator": a.ratio_numerator,
                "ratio_denominator": a.ratio_denominator,
            }
            for a in actions
            if a.ex_date and a.ratio_numerator and a.ratio_denominator
        ]

        dates = [c.trade_date for c in candles]
        factors = compute_cumulative_adjustment_factors(action_dicts, dates)

        updated_count = 0
        for candle in candles:
            factor = factors.get(candle.trade_date, Decimal("1.0"))
            new_adj_close = adjust_historical_price(candle.close, factor)
            if candle.adj_close != new_adj_close:
                candle.adj_close = new_adj_close
                updated_count += 1

        self.db.commit()
        logger.info("Adjusted %s candles for Security #%s across %s corporate actions.", updated_count, security_id, len(actions))
        return updated_count

    def get_company_validation_results(self, company_id: int, limit: int = 50) -> list[ValidationResult]:
        """Fetch persistent audit logs and validation warnings for a company."""
        # Find statements belonging to company
        s_stmt = select(FinancialStatement.id).where(FinancialStatement.company_id == company_id)
        statement_ids = self.db.scalars(s_stmt).all()

        query = (
            select(ValidationResult)
            .where(
                (ValidationResult.entity_type == "COMPANY") & (ValidationResult.entity_id == company_id)
                | (ValidationResult.entity_type == "STATEMENT") & (ValidationResult.entity_id.in_(statement_ids))
            )
            .order_by(desc(ValidationResult.created_at))
            .limit(limit)
        )
        return list(self.db.scalars(query).all())

    def _persist_validation_results(self, results: list[RuleResult], job_id: int | None = None) -> None:
        """Persist non-INFO or failed rule results into validation_results table."""
        for r in results:
            # We record all errors, warnings, or explicitly failed rules
            if not r.passed or r.severity in {ValidationSeverity.WARNING, ValidationSeverity.ERROR, ValidationSeverity.CRITICAL}:
                db_record = ValidationResult(
                    ingestion_job_id=job_id,
                    rule_code=r.rule_code.value,
                    severity=r.severity.value,
                    entity_type=r.entity_type,
                    entity_id=r.entity_id,
                    message=r.message,
                    details=r.details,
                )
                self.db.add(db_record)
        self.db.commit()
