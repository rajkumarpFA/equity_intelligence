"""SQLAlchemy models for saved screens and screener configurations."""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class SavedScreen(Base):
    """User-created or pre-configured institutional equity screens."""

    __tablename__ = "saved_screens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON representation of FilterExpression AST
    filter_expression: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)

    sort_by: Mapped[str] = mapped_column(String(50), default="market_cap", nullable=False)
    sort_direction: Mapped[str] = mapped_column(String(4), default="desc", nullable=False)
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<SavedScreen(id={self.id}, name='{self.name}', is_preset={self.is_preset})>"
