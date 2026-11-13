"""Financial statements, normalized facts, and financial metrics dictionary."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.company import Company

from sqlalchemy import (
    Boolean,
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class FinancialMetric(Base):
    """Standardized metric catalog (e.g., REVENUE, PAT, EBITDA, TOTAL_DEBT, CASA_RATIO)."""

    __tablename__ = "financial_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, BANKING_INCOME, BANKING_BALANCE_SHEET, RATIO
    is_banking_specific: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    normal_balance: Mapped[str] = mapped_column(
        String(10), default="CREDIT", nullable=False
    )  # CREDIT or DEBIT

    facts: Mapped[list["FinancialFact"]] = relationship("FinancialFact", back_populates="metric")


class FinancialStatement(Base):
    """Container for reported financial statements (Balance Sheet, P&L, Cash Flow)."""

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "statement_type",
            "reporting_basis",
            "period_type",
            "period_end",
            "version",
            name="uq_statement_period_version",
        ),
        Index("idx_statement_company_period", "company_id", "period_end"),
        Index("idx_statement_lookup", "company_id", "statement_type", "reporting_basis"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    statement_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # BALANCE_SHEET, INCOME_STATEMENT, CASH_FLOW
    reporting_basis: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # STANDALONE, CONSOLIDATED
    period_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # ANNUAL, QUARTERLY, HALF_YEARLY

    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    fiscal_quarter: Mapped[int | None] = mapped_column(Integer, nullable=True)

    publication_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_audited: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_restated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    supersedes_statement_id: Mapped[int | None] = mapped_column(
        ForeignKey("financial_statements.id", ondelete="SET NULL"), nullable=True
    )

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

    company: Mapped["Company"] = relationship("Company")
    facts: Mapped[list["FinancialFact"]] = relationship(
        "FinancialFact", back_populates="statement", cascade="all, delete-orphan"
    )


class FinancialFact(Base):
    """Atomic normalized financial line item with precise numerical value and full source provenance."""

    __tablename__ = "financial_facts"
    __table_args__ = (
        UniqueConstraint("statement_id", "metric_id", name="uq_statement_metric"),
        Index("idx_fact_statement_metric", "statement_id", "metric_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    statement_id: Mapped[int] = mapped_column(
        ForeignKey("financial_statements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_id: Mapped[int] = mapped_column(
        ForeignKey("financial_metrics.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    value: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False)
    raw_value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    unit: Mapped[str] = mapped_column(
        String(20), default="CRORES", nullable=False
    )  # CRORES, LAKHS, INR, PER_SHARE, PERCENTAGE

    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("source_documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extraction_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    extraction_method: Mapped[str] = mapped_column(
        String(30), default="API", nullable=False
    )  # API, CSV_IMPORT, PDF_EXTRACT, MANUAL_ENTRY
    validation_status: Mapped[str] = mapped_column(
        String(30), default="UNVERIFIED", nullable=False
    )  # VERIFIED, CROSS_CHECKED, NEEDS_REVIEW, UNVERIFIED

    statement: Mapped["FinancialStatement"] = relationship("FinancialStatement", back_populates="facts")
    metric: Mapped["FinancialMetric"] = relationship("FinancialMetric", back_populates="facts")
