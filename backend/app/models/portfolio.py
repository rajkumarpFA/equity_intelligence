"""SQLAlchemy models for Portfolios, Transactions, and Cached Holdings."""

from datetime import UTC, date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class Portfolio(Base):
    """User investment portfolio with cash balance and benchmark index."""

    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    benchmark_symbol = Column(String(20), nullable=False, default="^NSEI")  # NIFTY 50
    cash_balance = Column(Numeric(20, 4), nullable=False, default=Decimal("0.0000"))
    currency = Column(String(10), nullable=False, default="INR")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    transactions = relationship(
        "Transaction",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="Transaction.trade_date.asc(), Transaction.order_sequence.asc()",
    )
    holdings = relationship(
        "PortfolioHolding",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )


class Transaction(Base):
    """Individual trade or cash flow transaction within a portfolio."""

    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "broker_trade_id", name="uq_portfolio_broker_trade"),
        Index("idx_txn_portfolio_security_date", "portfolio_id", "security_id", "trade_date", "order_sequence"),
    )

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    security_id = Column(
        Integer,
        ForeignKey("securities.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # BUY, SELL, DIVIDEND, SPLIT, BONUS, DEPOSIT, WITHDRAWAL
    transaction_type = Column(String(20), nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    trade_time = Column(Time, nullable=True)
    order_sequence = Column(Integer, nullable=False, default=0)

    quantity = Column(Numeric(18, 4), nullable=True)
    price_per_share = Column(Numeric(18, 4), nullable=True)
    amount = Column(Numeric(20, 4), nullable=False, default=Decimal("0.0000"))

    brokerage_charges = Column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    taxes = Column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))

    broker_trade_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    portfolio = relationship("Portfolio", back_populates="transactions")
    security = relationship("Security")
    company = relationship("Company")


class PortfolioHolding(Base):
    """Aggregate position summary cache per security in a portfolio."""

    __tablename__ = "portfolio_holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "security_id", name="uq_portfolio_security_holding"),
    )

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    security_id = Column(
        Integer,
        ForeignKey("securities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    total_quantity = Column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    average_buy_price = Column(Numeric(18, 4), nullable=False, default=Decimal("0.0000"))
    invested_amount = Column(Numeric(20, 4), nullable=False, default=Decimal("0.0000"))
    realized_pnl = Column(Numeric(20, 4), nullable=False, default=Decimal("0.0000"))

    updated_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    portfolio = relationship("Portfolio", back_populates="holdings")
    security = relationship("Security")
    company = relationship("Company")
