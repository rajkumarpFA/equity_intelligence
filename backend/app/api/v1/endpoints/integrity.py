"""Data Integrity and Fundamental Accounting Verification endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrity.models import IntegrityAuditSummary, RuleResult
from app.services.integrity_service import IntegrityService

router = APIRouter(prefix="/integrity", tags=["Data Integrity & Verification Engine"])


@router.post("/validate/company/{company_id}", response_model=IntegrityAuditSummary)
def validate_company_financials(
    company_id: int,
    db: Session = Depends(get_db),
) -> IntegrityAuditSummary:
    """Execute complete Data Integrity audit across all financial statements and YoY history for a company."""
    service = IntegrityService(db)
    try:
        return service.validate_company_financials(company_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/validate/statement/{statement_id}", response_model=list[RuleResult])
def validate_statement(
    statement_id: int,
    db: Session = Depends(get_db),
) -> list[RuleResult]:
    """Execute accounting identities (Balance Sheet, Cash Flow, P&L) for a single statement."""
    service = IntegrityService(db)
    try:
        return service.validate_statement(statement_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/results/company/{company_id}")
def get_company_validation_results(
    company_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve persistent audit findings, discrepancy logs, and warnings for a company."""
    service = IntegrityService(db)
    records = service.get_company_validation_results(company_id, limit=limit)
    return [
        {
            "id": r.id,
            "rule_code": r.rule_code,
            "severity": r.severity,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "message": r.message,
            "details": r.details,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.post("/corporate-actions/adjust-prices/{security_id}")
def adjust_security_prices_for_corporate_actions(
    security_id: int,
    db: Session = Depends(get_db),
):
    """Calculate cumulative split/bonus factors and adjust historical daily candles for a security."""
    service = IntegrityService(db)
    try:
        updated = service.apply_corporate_actions_to_price_history(security_id)
        return {
            "status": "success",
            "security_id": security_id,
            "updated_candles": updated,
            "message": f"Successfully updated {updated} daily candles with cumulative corporate action adjustments.",
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
