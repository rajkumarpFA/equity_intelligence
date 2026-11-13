"""Service for Investment Thesis Journal (Phase 13)."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.workflow import InvestmentNote
from app.schemas.workflow import (
    InvestmentNoteCreate,
    InvestmentNoteRead,
    InvestmentNoteUpdate,
)

logger = logging.getLogger(__name__)


class JournalService:
    """Manages investment thesis journal notes, catalysts, and reviews."""

    def __init__(self, db: Session):
        self.db = db

    def _enrich_note(self, note: InvestmentNote) -> InvestmentNoteRead:
        company = note.company
        primary_sec = next((s for s in company.securities if s.is_primary), None) if company and company.securities else None
        if not primary_sec and company and company.securities:
            primary_sec = company.securities[0]

        symbol = primary_sec.symbol if primary_sec else (company.name if company else "N/A")

        return InvestmentNoteRead(
            id=note.id,
            company_id=note.company_id,
            symbol=symbol,
            company_name=company.name if company else "Unknown",
            title=note.title,
            category=note.category,
            conviction_score=note.conviction_score,
            content=note.content,
            catalysts=note.catalysts or [],
            key_risks=note.key_risks or [],
            target_price=float(note.target_price) if note.target_price else None,
            review_date=note.review_date,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )

    def list_notes(
        self,
        company_id: int | None = None,
        category: str | None = None,
        min_conviction: int | None = None,
    ) -> list[InvestmentNoteRead]:
        """List investment journal entries with filtering."""
        query = (
            select(InvestmentNote)
            .options(
                selectinload(InvestmentNote.company).selectinload(Company.securities)
            )
            .order_by(InvestmentNote.created_at.desc())
        )

        if company_id is not None:
            query = query.where(InvestmentNote.company_id == company_id)
        if category:
            query = query.where(InvestmentNote.category == category.upper())
        if min_conviction:
            query = query.where(InvestmentNote.conviction_score >= min_conviction)

        notes = self.db.scalars(query).all()
        return [self._enrich_note(n) for n in notes]

    def get_note(self, note_id: int) -> InvestmentNoteRead:
        """Get single note by id."""
        query = (
            select(InvestmentNote)
            .where(InvestmentNote.id == note_id)
            .options(
                selectinload(InvestmentNote.company).selectinload(Company.securities)
            )
        )
        note = self.db.scalars(query).first()
        if not note:
            raise ValueError(f"Investment note #{note_id} not found")
        return self._enrich_note(note)

    def create_note(self, note_in: InvestmentNoteCreate) -> InvestmentNoteRead:
        """Create new thesis journal entry."""
        company = self.db.get(Company, note_in.company_id)
        if not company:
            raise ValueError(f"Company ID #{note_in.company_id} not found")

        note = InvestmentNote(
            company_id=note_in.company_id,
            title=note_in.title,
            category=note_in.category.upper(),
            conviction_score=note_in.conviction_score,
            content=note_in.content,
            catalysts=note_in.catalysts,
            key_risks=note_in.key_risks,
            target_price=note_in.target_price,
            review_date=note_in.review_date,
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return self.get_note(note.id)

    def update_note(self, note_id: int, note_in: InvestmentNoteUpdate) -> InvestmentNoteRead:
        """Update existing journal entry."""
        note = self.db.get(InvestmentNote, note_id)
        if not note:
            raise ValueError(f"Investment note #{note_id} not found")

        if note_in.title is not None:
            note.title = note_in.title
        if note_in.category is not None:
            note.category = note_in.category.upper()
        if note_in.conviction_score is not None:
            note.conviction_score = note_in.conviction_score
        if note_in.content is not None:
            note.content = note_in.content
        if note_in.catalysts is not None:
            note.catalysts = note_in.catalysts
        if note_in.key_risks is not None:
            note.key_risks = note_in.key_risks
        if note_in.target_price is not None:
            note.target_price = note_in.target_price
        if note_in.review_date is not None:
            note.review_date = note_in.review_date

        self.db.commit()
        self.db.refresh(note)
        return self.get_note(note.id)

    def delete_note(self, note_id: int) -> bool:
        """Delete journal entry."""
        note = self.db.get(InvestmentNote, note_id)
        if not note:
            return False
        self.db.delete(note)
        self.db.commit()
        return True
