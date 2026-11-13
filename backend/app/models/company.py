"""Entity models for Companies, Exchanges, Securities, Sectors, and Industries."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Sector(Base):
    """Broad sector classification (e.g., Financial Services, Energy, IT)."""

    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    industries: Mapped[list["Industry"]] = relationship("Industry", back_populates="sector")
    companies: Mapped[list["Company"]] = relationship("Company", back_populates="sector")


class Industry(Base):
    """Specific industry within a sector (e.g., Private Banks, Oil Exploration)."""

    __tablename__ = "industries"
    __table_args__ = (UniqueConstraint("sector_id", "name", name="uq_sector_industry_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sector_id: Mapped[int] = mapped_column(
        ForeignKey("sectors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    sector: Mapped["Sector"] = relationship("Sector", back_populates="industries")
    companies: Mapped[list["Company"]] = relationship("Company", back_populates="industry")


class Exchange(Base):
    """Stock exchanges listing securities (e.g., NSE, BSE)."""

    __tablename__ = "exchanges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(10), default="IN", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)

    securities: Mapped[list["Security"]] = relationship("Security", back_populates="exchange")


class Company(Base):
    """Canonical corporate entity. Distinct from individual exchange security listings."""

    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    isin: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    cin: Mapped[str | None] = mapped_column(String(25), nullable=True, index=True)

    sector_id: Mapped[int | None] = mapped_column(
        ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    industry_id: Mapped[int | None] = mapped_column(
        ForeignKey("industries.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Financial institutions (Banks/NBFC/Insurance) require different ratio and analysis models
    is_financial_sector: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accounting_standard: Mapped[str] = mapped_column(String(50), default="IND-AS", nullable=False)

    paid_up_capital: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)
    face_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    sector: Mapped[Optional["Sector"]] = relationship("Sector", back_populates="companies")
    industry: Mapped[Optional["Industry"]] = relationship("Industry", back_populates="companies")
    securities: Mapped[list["Security"]] = relationship(
        "Security", back_populates="company", cascade="all, delete-orphan"
    )


class Security(Base):
    """Specific exchange security or trading instrument belonging to a canonical company."""

    __tablename__ = "securities"
    __table_args__ = (
        UniqueConstraint("exchange_id", "symbol", name="uq_exchange_symbol"),
        Index("idx_security_symbol", "symbol"),
        Index("idx_security_company_exchange", "company_id", "exchange_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exchange_id: Mapped[int] = mapped_column(
        ForeignKey("exchanges.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    series: Mapped[str] = mapped_column(String(10), default="EQ", nullable=False)
    exchange_token: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_instrument_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    lot_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    market_cap_category: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # LARGE_CAP, MID_CAP, SMALL_CAP, MICRO_CAP

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    company: Mapped["Company"] = relationship("Company", back_populates="securities")
    exchange: Mapped["Exchange"] = relationship("Exchange", back_populates="securities")
