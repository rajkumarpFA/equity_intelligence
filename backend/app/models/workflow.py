"""SQLAlchemy models for Watchlists, Watchlist Items, and Investment Journal."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import backref, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


class Watchlist(Base):
    """User-curated collection of securities/companies."""

    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=False, default="#00d992")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    items = relationship(
        "WatchlistItem",
        back_populates="watchlist",
        cascade="all, delete-orphan",
        order_by="WatchlistItem.added_at.desc()",
    )


class WatchlistItem(Base):
    """An individual company entry within a watchlist with user targets and conviction."""

    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(
        Integer,
        ForeignKey("watchlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_entry_price = Column(Numeric(14, 2), nullable=True)
    target_exit_price = Column(Numeric(14, 2), nullable=True)
    conviction = Column(Integer, nullable=False, default=3)  # 1 to 5 scale
    thesis_summary = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    added_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    watchlist = relationship("Watchlist", back_populates="items")
    company = relationship("Company", backref=backref("watchlist_entries", cascade="all, delete-orphan"))

    __table_args__ = (
        UniqueConstraint("watchlist_id", "company_id", name="uq_watchlist_company"),
    )


class InvestmentNote(Base):
    """Investment thesis journal entry recording rationale, catalysts, risks, and post-mortems."""

    __tablename__ = "investment_notes"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, default="THESIS", index=True)  # THESIS, EARNINGS, RISK, VALUATION, POST_MORTEM
    conviction_score = Column(Integer, nullable=False, default=3)  # 1 to 5
    content = Column(Text, nullable=False)  # Markdown text
    catalysts = Column(JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False)
    key_risks = Column(JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False)
    target_price = Column(Numeric(14, 2), nullable=True)
    review_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    company = relationship("Company", backref=backref("investment_notes", cascade="all, delete-orphan"))
