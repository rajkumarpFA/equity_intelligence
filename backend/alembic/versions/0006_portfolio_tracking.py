"""Create portfolios, transactions, and portfolio_holdings tables.

Revision ID: 0006_portfolio_tracking
Revises: 0005_valuation_and_workflows
Create Date: 2026-11-14 13:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_portfolio_tracking"
down_revision: Union[str, None] = "0005_valuation_and_workflows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. portfolios table
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("benchmark_symbol", sa.String(length=20), nullable=False, server_default="^NSEI"),
        sa.Column("cash_balance", sa.Numeric(precision=20, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_portfolio_name"),
    )
    op.create_index(op.f("ix_portfolios_id"), "portfolios", ["id"], unique=False)
    op.create_index(op.f("ix_portfolios_name"), "portfolios", ["name"], unique=True)

    # 2. transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("security_id", sa.Integer(), nullable=True),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("transaction_type", sa.String(length=20), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("trade_time", sa.Time(), nullable=True),
        sa.Column("order_sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("price_per_share", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("amount", sa.Numeric(precision=20, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("brokerage_charges", sa.Numeric(precision=14, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("taxes", sa.Numeric(precision=14, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("broker_trade_id", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["security_id"], ["securities.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", "broker_trade_id", name="uq_portfolio_broker_trade"),
    )
    op.create_index(op.f("ix_transactions_id"), "transactions", ["id"], unique=False)
    op.create_index(op.f("ix_transactions_portfolio_id"), "transactions", ["portfolio_id"], unique=False)
    op.create_index(op.f("ix_transactions_security_id"), "transactions", ["security_id"], unique=False)
    op.create_index(op.f("ix_transactions_company_id"), "transactions", ["company_id"], unique=False)
    op.create_index(op.f("ix_transactions_transaction_type"), "transactions", ["transaction_type"], unique=False)
    op.create_index(op.f("ix_transactions_trade_date"), "transactions", ["trade_date"], unique=False)
    op.create_index(
        "idx_txn_portfolio_security_date",
        "transactions",
        ["portfolio_id", "security_id", "trade_date", "order_sequence"],
        unique=False,
    )

    # 3. portfolio_holdings table
    op.create_table(
        "portfolio_holdings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("security_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("total_quantity", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("average_buy_price", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("invested_amount", sa.Numeric(precision=20, scale=4), nullable=False, server_default="0.0000"),
        sa.Column("realized_pnl", sa.Numeric(precision=20, scale=4), nullable=False, server_default="0.0000"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["security_id"], ["securities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", "security_id", name="uq_portfolio_security_holding"),
    )
    op.create_index(op.f("ix_portfolio_holdings_id"), "portfolio_holdings", ["id"], unique=False)
    op.create_index(op.f("ix_portfolio_holdings_portfolio_id"), "portfolio_holdings", ["portfolio_id"], unique=False)
    op.create_index(op.f("ix_portfolio_holdings_security_id"), "portfolio_holdings", ["security_id"], unique=False)
    op.create_index(op.f("ix_portfolio_holdings_company_id"), "portfolio_holdings", ["company_id"], unique=False)


def downgrade() -> None:
    op.drop_table("portfolio_holdings")
    op.drop_table("transactions")
    op.drop_table("portfolios")
