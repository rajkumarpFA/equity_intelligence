"""API Endpoints for Valuation Workbench (DCF, Reverse DCF, Multiples, DDM, Graham)."""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.valuation import (
    DCFResult,
    DCFRunRequest,
    DDMRequest,
    DDMResponse,
    GrahamRequest,
    GrahamResponse,
    HistoricalMultiplesResponse,
    ReverseDCFRequest,
    ReverseDCFResponse,
    SavedValuationCreate,
    SavedValuationRead,
    SensitivityMatrixRequest,
    SensitivityMatrixResponse,
    ValuationSummaryResponse,
)
from app.services.valuation_service import ValuationService

router = APIRouter(prefix="/valuation", tags=["Valuation"])


@router.post("/dcf", response_model=DCFResult)
def run_dcf_valuation(
    payload: DCFRunRequest,
    db: Session = Depends(get_db),
) -> DCFResult:
    """Run a Discounted Cash Flow (DCF) model."""
    service = ValuationService(db)
    try:
        return service.run_dcf(
            company_id=payload.company_id,
            assumptions=payload.assumptions,
            override_price=payload.current_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/reverse-dcf", response_model=ReverseDCFResponse)
def run_reverse_dcf_valuation(
    payload: ReverseDCFRequest,
    db: Session = Depends(get_db),
) -> ReverseDCFResponse:
    """Run a Reverse DCF model to find market-implied growth rate."""
    service = ValuationService(db)
    try:
        return service.run_reverse_dcf(
            company_id=payload.company_id,
            override_price=payload.current_price,
            wacc=payload.wacc,
            terminal_growth_rate=payload.terminal_growth_rate,
            operating_margin=payload.operating_margin,
            reinvestment_rate=payload.reinvestment_rate,
            projection_years=payload.projection_years,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sensitivity", response_model=SensitivityMatrixResponse)
def run_sensitivity_matrix(
    payload: SensitivityMatrixRequest,
    db: Session = Depends(get_db),
) -> SensitivityMatrixResponse:
    """Generate 5x5 WACC vs Terminal Growth Rate sensitivity matrix."""
    service = ValuationService(db)
    try:
        return service.run_sensitivity_matrix(
            company_id=payload.company_id,
            base_growth_rate=payload.base_growth_rate,
            base_operating_margin=payload.base_operating_margin,
            base_wacc=payload.base_wacc,
            base_terminal_growth=payload.base_terminal_growth,
            projection_years=payload.projection_years,
            override_price=payload.current_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{company_id}/historical-multiples", response_model=HistoricalMultiplesResponse)
def get_historical_multiples_valuation(
    company_id: int,
    current_price: float | None = Query(None, description="Optional override price"),
    db: Session = Depends(get_db),
) -> HistoricalMultiplesResponse:
    """Compute percentile bands and implied prices from historical P/E, P/B, and EV/EBITDA."""
    service = ValuationService(db)
    try:
        return service.run_historical_multiples(company_id=company_id, override_price=current_price)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/ddm", response_model=DDMResponse)
def run_ddm_valuation(
    payload: DDMRequest,
    db: Session = Depends(get_db),
) -> DDMResponse:
    """Run Dividend Discount Model (DDM)."""
    service = ValuationService(db)
    try:
        return service.run_ddm(
            company_id=payload.company_id,
            cost_of_equity=payload.cost_of_equity,
            dividend_growth_rate=payload.dividend_growth_rate,
            high_growth_period_years=payload.high_growth_period_years,
            high_growth_rate=payload.high_growth_rate,
            override_price=payload.current_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/graham", response_model=GrahamResponse)
def run_graham_valuation(
    payload: GrahamRequest,
    db: Session = Depends(get_db),
) -> GrahamResponse:
    """Run Benjamin Graham Intrinsic Value formula and Graham Number."""
    service = ValuationService(db)
    try:
        return service.run_graham(
            company_id=payload.company_id,
            expected_growth_rate=payload.expected_growth_rate,
            benchmark_yield_pct=payload.benchmark_yield_pct,
            override_price=payload.current_price,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{company_id}/summary", response_model=ValuationSummaryResponse)
def get_valuation_summary(
    company_id: int,
    db: Session = Depends(get_db),
) -> ValuationSummaryResponse:
    """Get multi-model valuation summary and consensus fair value."""
    service = ValuationService(db)
    try:
        return service.get_valuation_summary(company_id=company_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ─── Saved Scenarios ─────────────────────────────────────────────────────────


@router.post("/saved", response_model=SavedValuationRead, status_code=status.HTTP_201_CREATED)
def save_valuation_scenario(
    payload: SavedValuationCreate,
    db: Session = Depends(get_db),
) -> SavedValuationRead:
    """Save a custom valuation scenario for future retrieval."""
    service = ValuationService(db)
    return service.save_valuation(payload)


@router.get("/saved", response_model=list[SavedValuationRead])
def list_saved_valuations(
    company_id: int | None = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db),
) -> list[SavedValuationRead]:
    """List saved valuation scenarios."""
    service = ValuationService(db)
    return service.list_saved_valuations(company_id=company_id)


@router.delete("/saved/{valuation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_valuation(
    valuation_id: int,
    db: Session = Depends(get_db),
):
    """Delete a saved valuation scenario."""
    service = ValuationService(db)
    deleted = service.delete_saved_valuation(valuation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved valuation not found")
