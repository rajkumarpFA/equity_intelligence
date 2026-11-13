"""SQLAlchemy models for persistent valuation runs and custom scenario models."""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import backref, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


class SavedValuation(Base):
    """Stores user valuation models, parameters, scenario assumptions, and fair values."""

    __tablename__ = "valuations"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_type = Column(String(32), nullable=False, default="DCF", index=True)
    scenario_name = Column(String(64), nullable=False, default="BASE")
    intrinsic_value = Column(Numeric(14, 2), nullable=True)
    current_price_at_run = Column(Numeric(14, 2), nullable=True)
    margin_of_safety_pct = Column(Numeric(8, 2), nullable=True)

    # Cross-database JSON support (JSONB on PostgreSQL, JSON on SQLite)
    assumptions = Column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=False)
    projections = Column(JSON().with_variant(JSONB, "postgresql"), default=list, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    company = relationship("Company", backref=backref("valuations", cascade="all, delete-orphan"))
