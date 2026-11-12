"""Company discovery and master data API endpoints."""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.company import (
    CompanyCreate,
    CompanyRead,
    CompanySearchResponse,
    SectorRead,
)
from app.services.company_service import CompanyService

router = APIRouter(prefix="/companies", tags=["Companies & Stock Discovery"])


@router.get("", response_model=CompanySearchResponse)
def search_companies(
    q: str | None = Query(None, description="Search by company name, trading symbol, or ISIN"),
    sector_id: int | None = Query(None, description="Filter by sector ID"),
    industry_id: int | None = Query(None, description="Filter by industry ID"),
    exchange: str | None = Query(None, description="Filter by exchange code (e.g. NSE or BSE)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
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
        "message": f"Successfully seeded {count} benchmark companies." if count > 0 else "Database already populated.",
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


@router.get("/{company_id}", response_model=CompanyRead)
def get_company_by_id(company_id: int, db: Session = Depends(get_db)) -> CompanyRead:
    """Retrieve detailed canonical company record with exchange listings and sector info."""
    service = CompanyService(db)
    company = service.get_company_by_id(company_id)
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
