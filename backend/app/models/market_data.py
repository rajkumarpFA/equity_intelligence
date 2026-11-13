"""Market data, historical daily prices, corporate actions, and shareholding patterns."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PriceHistory(Base):
    """Historical EOD OHLCV candlestick records per security."""

    __tablename__ = "price_history"
    __table_args__ = (
        UniqueConstraint("security_id", "trade_date", name="uq_security_trade_date"),
        Index("idx_price_security_date", "security_id", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    security_id: Mapped[int] = mapped_column(
        ForeignKey("securities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    open: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    adj_close: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)

    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class CorporateAction(Base):
    """Corporate actions (dividends, splits, bonuses, rights, buybacks) with adjustment parameters."""

    __tablename__ = "corporate_actions"
    __table_args__ = (
        Index("idx_corporate_action_company_ex_date", "company_id", "ex_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    security_id: Mapped[int | None] = mapped_column(
        ForeignKey("securities.id", ondelete="SET NULL"), nullable=True, index=True
    )

    action_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # DIVIDEND, SPLIT, BONUS, RIGHTS, BUYBACK, SPINOFF, NAME_CHANGE
    announcement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ex_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    record_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # For splits & bonuses (e.g., 2:1 bonus -> ratio_numerator=2, ratio_denominator=1)
    ratio_numerator: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    ratio_denominator: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)

    # For cash dividends
    dividend_amount: Mapped[Decimal | None] = mapped_column(Numeric(20, 4), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class ShareholdingHistory(Base):
    """Quarterly shareholding distribution pattern disclosing ownership breakdown and promoter pledge."""

    __tablename__ = "shareholding_history"
    __table_args__ = (
        UniqueConstraint("company_id", "period_end", name="uq_company_shareholding_period"),
        Index("idx_shareholding_company_period", "company_id", "period_end"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    promoter_pct: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    promoter_pledged_pct: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), default=Decimal("0.0"), nullable=False
    )
    fii_pct: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    dii_pct: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    public_pct: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    others_pct: Mapped[Decimal] = mapped_column(
        Numeric(18, 6), default=Decimal("0.0"), nullable=False
    )

    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True
    )
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("source_documents.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
