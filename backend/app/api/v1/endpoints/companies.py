"""Company discovery and master data API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analysis import (
    CompanyRatiosResponse,
    QualityScoresResponse,
)
from app.schemas.company import (
    CompanyCreate,
    CompanyRead,
    CompanySearchResponse,
    SectorRead,
)
from app.schemas.comparison import (
    CompanyComparisonRequest,
    CompanyComparisonResponse,
    CompanyPeersResponse,
)
from app.schemas.financial_statements import (
    AvailablePeriodsResponse,
    CorporateActionDetail,
    FinancialStatementMatrixResponse,
    ShareholdingPatternDetail,
)
from app.schemas.technicals import CompanyTechnicalsResponse
from app.services.analysis_service import AnalysisService
from app.services.company_service import CompanyService
from app.services.comparison_service import ComparisonService
from app.services.financial_statement_service import FinancialStatementService
from app.services.technicals_service import TechnicalsService

router = APIRouter(prefix="/companies", tags=["Companies & Stock Discovery"])


@router.get("", response_model=CompanySearchResponse)
def search_companies(
    q: str | None = Query(None, description="Search by company name, trading symbol, or ISIN"),
    sector_id: int | None = Query(None, description="Filter by sector ID"),
    industry_id: int | None = Query(None, description="Filter by industry ID"),
    exchange: str | None = Query(None, description="Filter by exchange code (e.g. NSE or BSE)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    refresh: bool = Query(False, description="Force bypass price cache and fetch fresh quotes"),
    db: Session = Depends(get_db),
) -> CompanySearchResponse:
    """Search and browse canonical companies across NSE and BSE listings."""
    service = CompanyService(db)
    return service.search_companies(
        query=q,
        sector_id=sector_id,
        industry_id=industry_id,
        exchange_code=exchange,
        page=page,
        page_size=page_size,
        refresh=refresh,
    )


@router.get("/taxonomy/sectors", response_model=list[SectorRead])
def list_sectors(db: Session = Depends(get_db)) -> list[SectorRead]:
    """Retrieve all sector taxonomy classifications."""
    service = CompanyService(db)
    return service.list_sectors()


@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_benchmark_companies(db: Session = Depends(get_db)):
    """Seed initial benchmark universe (Reliance, TCS, HDFC Bank, Suzlon, Tata Motors, etc.) if empty."""
    service = CompanyService(db)
    count = service.seed_initial_universe_if_empty()
    return {
        "status": "success",
        "seeded_companies_count": count,
        "message": f"Successfully seeded {count} benchmark companies."
        if count > 0
        else "Database already populated.",
    }


@router.get("/isin/{isin}", response_model=CompanyRead)
def get_company_by_isin(isin: str, db: Session = Depends(get_db)) -> CompanyRead:
    """Retrieve canonical company profile by 12-character ISIN."""
    service = CompanyService(db)
    company = service.get_company_by_isin(isin)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ISIN '{isin}' not found",
        )
    return company


@router.post(
    "/compare",
    response_model=CompanyComparisonResponse,
    summary="Compare multiple companies side-by-side across fundamental and valuation metrics",
)
def compare_companies_post(
    request: CompanyComparisonRequest,
    db: Session = Depends(get_db),
) -> CompanyComparisonResponse:
    """Generate a multi-metric comparative matrix for selected companies."""
    service = ComparisonService(db)
    try:
        return service.compare_companies(
            company_ids=request.company_ids,
            reporting_basis=request.reporting_basis,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/compare",
    response_model=CompanyComparisonResponse,
    summary="Compare multiple companies via comma-separated query parameters",
)
def compare_companies_get(
    ids: str = Query(..., description="Comma-separated company IDs (e.g. 1,2,3)"),
    reporting_basis: str = Query("CONSOLIDATED", description="STANDALONE or CONSOLIDATED"),
    db: Session = Depends(get_db),
) -> CompanyComparisonResponse:
    """GET shortcut to generate a multi-company comparative matrix."""
    try:
        company_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'ids' must be a comma-separated list of integers.",
        ) from exc

    service = ComparisonService(db)
    try:
        return service.compare_companies(company_ids=company_ids, reporting_basis=reporting_basis)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/compare/export-csv",
    summary="Export company comparison matrix as RFC 4180 CSV",
)
def export_comparison_csv(
    request: CompanyComparisonRequest,
    db: Session = Depends(get_db),
) -> Response:
    """Download clean, formatted CSV matrix of all compared metrics across selected companies."""
    service = ComparisonService(db)
    try:
        csv_content = service.export_comparison_csv(
            company_ids=request.company_ids,
            reporting_basis=request.reporting_basis,
        )
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="competitor_comparison.csv"'},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{company_id}", response_model=CompanyRead)
def get_company_by_id(
    company_id: int,
    refresh: bool = Query(False, description="Force bypass price cache and fetch fresh quotes"),
    db: Session = Depends(get_db),
) -> CompanyRead:
    """Retrieve detailed canonical company record with exchange listings and sector info."""
    service = CompanyService(db)
    company = service.get_company_by_id(company_id, refresh=refresh)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found",
        )
    return company


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def upsert_company(data: CompanyCreate, db: Session = Depends(get_db)) -> CompanyRead:
    """Upsert canonical company record and associate its exchange securities."""
    service = CompanyService(db)
    return service.upsert_company(data)


@router.post("/lookup-and-add", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def lookup_and_add_company(
    symbol: str = Query(..., description="Trading symbol to search and import (e.g. INFY, ITC, SBIN)"),
    exchange: str = Query("NSE", description="Exchange code (NSE or BSE)"),
    db: Session = Depends(get_db),
) -> CompanyRead:
    """On-demand lookup and addition of any NSE/BSE listed stock into local PostgreSQL."""
    service = CompanyService(db)
    try:
        return service.import_company_by_symbol(symbol=symbol, exchange=exchange)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{company_id}/statements",
    response_model=FinancialStatementMatrixResponse,
    summary="Get multi-period financial statement matrix with source provenance",
)
def get_company_statements(
    company_id: int,
    statement_type: str = Query("INCOME_STATEMENT", description="INCOME_STATEMENT, BALANCE_SHEET, or CASH_FLOW"),
    reporting_basis: str = Query("CONSOLIDATED", description="CONSOLIDATED or STANDALONE"),
    period_type: str = Query("ANNUAL", description="ANNUAL or QUARTERLY"),
    db: Session = Depends(get_db),
) -> FinancialStatementMatrixResponse:
    """Retrieve normalized multi-period financial statement matrix with provenance links and zero fabricated values."""
    service = FinancialStatementService(db)
    try:
        return service.get_statement_matrix(
            company_id=company_id,
            statement_type=statement_type,
            reporting_basis=reporting_basis,
            period_type=period_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{company_id}/available-statement-periods",
    response_model=AvailablePeriodsResponse,
    summary="Inspect available reporting bases and period types for a company",
)
def get_available_statement_periods(
    company_id: int,
    db: Session = Depends(get_db),
) -> AvailablePeriodsResponse:
    """Inspect which financial statements and periods exist for a company to configure UI controls."""
    service = FinancialStatementService(db)
    return service.get_available_periods(company_id=company_id)


@router.get(
    "/{company_id}/corporate-actions",
    response_model=list[CorporateActionDetail],
    summary="Get historical corporate actions (dividends, splits, bonuses, rights)",
)
def get_company_corporate_actions(
    company_id: int,
    db: Session = Depends(get_db),
) -> list[CorporateActionDetail]:
    """Retrieve chronologically ordered corporate actions and share multipliers for a company."""
    service = FinancialStatementService(db)
    return service.get_corporate_actions(company_id=company_id)


@router.get(
    "/{company_id}/shareholding",
    response_model=list[ShareholdingPatternDetail],
    summary="Get quarterly shareholding pattern and ownership breakdown",
)
def get_company_shareholding(
    company_id: int,
    db: Session = Depends(get_db),
) -> list[ShareholdingPatternDetail]:
    """Retrieve quarterly shareholding patterns (promoter, pledged, FII, DII, public)."""
    service = FinancialStatementService(db)
    return service.get_shareholding_history(company_id=company_id)


@router.post(
    "/{company_id}/seed-financials",
    summary="Seed multi-period audited financials, corporate actions, and shareholding for benchmarking",
)
def seed_company_financials(
    company_id: int,
    db: Session = Depends(get_db),
):
    """Seed multi-year audited financial statements, corporate actions, and ownership patterns for a company."""
    service = FinancialStatementService(db)
    try:
        return service.seed_sample_financials(company_id=company_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{company_id}/ratios",
    response_model=CompanyRatiosResponse,
    summary="Get comprehensive financial ratios (Growth, Profitability, Solvency, Efficiency, DuPont, Banking)",
)
def get_company_ratios(
    company_id: int,
    reporting_basis: str = Query("CONSOLIDATED", description="STANDALONE or CONSOLIDATED"),
    db: Session = Depends(get_db),
) -> CompanyRatiosResponse:
    """Calculate and return full suite of deterministic financial ratios for a company."""
    service = AnalysisService(db)
    try:
        return service.get_company_ratios(company_id=company_id, reporting_basis=reporting_basis)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/{company_id}/quality-scores",
    response_model=QualityScoresResponse,
    summary="Get financial quality and distress scores (Altman Z-Score & 9-Factor Piotroski F-Score)",
)
def get_company_quality_scores(
    company_id: int,
    reporting_basis: str = Query("CONSOLIDATED", description="STANDALONE or CONSOLIDATED"),
    db: Session = Depends(get_db),
) -> QualityScoresResponse:
    """Calculate and return Altman Z-Score and Piotroski F-Score with detailed factor attribution."""
    service = AnalysisService(db)
    try:
        return service.get_company_quality_scores(company_id=company_id, reporting_basis=reporting_basis)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/{company_id}/technicals",
    response_model=CompanyTechnicalsResponse,
    summary="Get comprehensive EOD candles, moving averages, RSI, MACD, Bollinger Bands, and technical summary",
)
def get_company_technicals(
    company_id: int,
    security_id: int | None = Query(None, description="Optional specific security ID"),
    timeframe: str = Query("1Y", description="1M, 6M, 1Y, 3Y, 5Y, ALL"),
    db: Session = Depends(get_db),
) -> CompanyTechnicalsResponse:
    """Calculate and return full technical indicators suite, historical returns, drawdowns, and pivot points."""
    service = TechnicalsService(db)
    try:
        return service.get_company_technicals(
            company_id=company_id,
            security_id=security_id,
            timeframe=timeframe,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/{company_id}/peers",
    response_model=CompanyPeersResponse,
    summary="Discover industry and sector peer companies for competitive benchmarking",
)
def get_company_peers(
    company_id: int,
    db: Session = Depends(get_db),
) -> CompanyPeersResponse:
    """Discover companies within the same sector or industry for side-by-side comparison."""
    service = ComparisonService(db)
    try:
        return service.get_company_peers(company_id=company_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc



