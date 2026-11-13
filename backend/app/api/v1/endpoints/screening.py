"""FastAPI routes for the equity screening engine."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.screening.models import (
    SavedScreenCreate,
    SavedScreenRead,
    SavedScreenUpdate,
    ScreenRequest,
    ScreenResponse,
)
from app.services.screening_service import ScreeningService

router = APIRouter()


@router.post("/run", response_model=ScreenResponse)
def run_screen(
    request: ScreenRequest,
    db: Session = Depends(get_db),
) -> ScreenResponse:
    """Execute dynamic multi-parameter equity screen with AST filters, sorting, and pagination."""
    service = ScreeningService(db)
    return service.run_screen(request)


@router.post("/export-csv")
def export_screen_csv(
    request: ScreenRequest,
    db: Session = Depends(get_db),
) -> Response:
    """Execute screen and export matching equities to a downloadable CSV file."""
    service = ScreeningService(db)
    csv_content = service.export_screen_csv(request)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=screener_export.csv",
        },
    )


@router.get("/presets", response_model=list[SavedScreenRead])
def get_preset_screens(
    db: Session = Depends(get_db),
) -> list[SavedScreenRead]:
    """Retrieve pre-configured institutional screens (Buffett Moats, Compounders, etc.)."""
    service = ScreeningService(db)
    return service.get_preset_screens()


@router.get("/saved", response_model=list[SavedScreenRead])
def list_saved_screens(
    db: Session = Depends(get_db),
) -> list[SavedScreenRead]:
    """Retrieve all user-saved screens from the database."""
    service = ScreeningService(db)
    return service.list_saved_screens()


@router.post("/saved", response_model=SavedScreenRead, status_code=status.HTTP_201_CREATED)
def create_saved_screen(
    payload: SavedScreenCreate,
    db: Session = Depends(get_db),
) -> SavedScreenRead:
    """Save a new screener configuration."""
    service = ScreeningService(db)
    try:
        return service.create_saved_screen(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/saved/{screen_id}", response_model=SavedScreenRead)
def get_saved_screen(
    screen_id: int,
    db: Session = Depends(get_db),
) -> SavedScreenRead:
    """Retrieve a specific saved screen or preset by ID."""
    service = ScreeningService(db)
    try:
        return service.get_saved_screen(screen_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/saved/{screen_id}", response_model=SavedScreenRead)
def update_saved_screen(
    screen_id: int,
    payload: SavedScreenUpdate,
    db: Session = Depends(get_db),
) -> SavedScreenRead:
    """Update an existing saved screen."""
    service = ScreeningService(db)
    try:
        return service.update_saved_screen(screen_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/saved/{screen_id}")
def delete_saved_screen(
    screen_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a user-saved screen."""
    service = ScreeningService(db)
    try:
        service.delete_saved_screen(screen_id)
        return {"status": "deleted", "screen_id": str(screen_id)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
