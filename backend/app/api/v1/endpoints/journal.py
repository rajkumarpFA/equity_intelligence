"""API Endpoints for Investment Thesis Journal (Phase 13)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.workflow import (
    InvestmentNoteCreate,
    InvestmentNoteRead,
    InvestmentNoteUpdate,
)
from app.services.journal_service import JournalService

router = APIRouter(prefix="/journal", tags=["Investment Journal"])


@router.get("", response_model=list[InvestmentNoteRead])
def list_journal_notes(
    company_id: int | None = Query(None, description="Filter by company ID"),
    category: str | None = Query(None, description="Filter by category (THESIS, EARNINGS, RISK, VALUATION, POST_MORTEM)"),
    min_conviction: int | None = Query(None, ge=1, le=5, description="Filter by minimum conviction score"),
    db: Session = Depends(get_db),
) -> list[InvestmentNoteRead]:
    """List investment thesis notes with optional company, category, and conviction filters."""
    service = JournalService(db)
    return service.list_notes(
        company_id=company_id,
        category=category,
        min_conviction=min_conviction,
    )


@router.post("", response_model=InvestmentNoteRead, status_code=status.HTTP_201_CREATED)
def create_journal_note(
    payload: InvestmentNoteCreate,
    db: Session = Depends(get_db),
) -> InvestmentNoteRead:
    """Create a new investment thesis or review entry."""
    service = JournalService(db)
    try:
        return service.create_note(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{note_id}", response_model=InvestmentNoteRead)
def get_journal_note(
    note_id: int,
    db: Session = Depends(get_db),
) -> InvestmentNoteRead:
    """Get single investment thesis note by ID."""
    service = JournalService(db)
    try:
        return service.get_note(note_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{note_id}", response_model=InvestmentNoteRead)
def update_journal_note(
    note_id: int,
    payload: InvestmentNoteUpdate,
    db: Session = Depends(get_db),
) -> InvestmentNoteRead:
    """Update an investment note."""
    service = JournalService(db)
    try:
        return service.update_note(note_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal_note(
    note_id: int,
    db: Session = Depends(get_db),
):
    """Delete an investment note."""
    service = JournalService(db)
    deleted = service.delete_note(note_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investment note not found")
