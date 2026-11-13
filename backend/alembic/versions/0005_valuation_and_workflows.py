"""Create valuations, watchlists, watchlist_items, and investment_notes tables.

Revision ID: 0005_valuation_and_workflows
Revises: 0004_screening_engine
Create Date: 2026-11-13 18:26:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0005_valuation_and_workflows"
down_revision: Union[str, None] = "0004_screening_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. valuations table
    op.create_table(
        "valuations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("model_type", sa.String(length=32), nullable=False, server_default="DCF"),
        sa.Column("scenario_name", sa.String(length=64), nullable=False, server_default="BASE"),
        sa.Column("intrinsic_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("current_price_at_run", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("margin_of_safety_pct", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column(
            "assumptions",
            sa.JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
        sa.Column(
            "projections",
            sa.JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_valuations_id"), "valuations", ["id"], unique=False)
    op.create_index(op.f("ix_valuations_company_id"), "valuations", ["company_id"], unique=False)
    op.create_index(op.f("ix_valuations_model_type"), "valuations", ["model_type"], unique=False)

    # 2. watchlists table
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=False, server_default="#00d992"),
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
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_watchlists_id"), "watchlists", ["id"], unique=False)
    op.create_index(op.f("ix_watchlists_name"), "watchlists", ["name"], unique=True)

    # 3. watchlist_items table
    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("watchlist_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("target_entry_price", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("target_exit_price", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("conviction", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("thesis_summary", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["watchlist_id"], ["watchlists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("watchlist_id", "company_id", name="uq_watchlist_company"),
    )
    op.create_index(op.f("ix_watchlist_items_id"), "watchlist_items", ["id"], unique=False)
    op.create_index(op.f("ix_watchlist_items_watchlist_id"), "watchlist_items", ["watchlist_id"], unique=False)
    op.create_index(op.f("ix_watchlist_items_company_id"), "watchlist_items", ["company_id"], unique=False)

    # 4. investment_notes table
    op.create_table(
        "investment_notes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="THESIS"),
        sa.Column("conviction_score", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "catalysts",
            sa.JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
        sa.Column(
            "key_risks",
            sa.JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
        sa.Column("target_price", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("review_date", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_investment_notes_id"), "investment_notes", ["id"], unique=False)
    op.create_index(op.f("ix_investment_notes_company_id"), "investment_notes", ["company_id"], unique=False)
    op.create_index(op.f("ix_investment_notes_category"), "investment_notes", ["category"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_investment_notes_category"), table_name="investment_notes")
    op.drop_index(op.f("ix_investment_notes_company_id"), table_name="investment_notes")
    op.drop_index(op.f("ix_investment_notes_id"), table_name="investment_notes")
    op.drop_table("investment_notes")

    op.drop_index(op.f("ix_watchlist_items_company_id"), table_name="watchlist_items")
    op.drop_index(op.f("ix_watchlist_items_watchlist_id"), table_name="watchlist_items")
    op.drop_index(op.f("ix_watchlist_items_id"), table_name="watchlist_items")
    op.drop_table("watchlist_items")

    op.drop_index(op.f("ix_watchlists_name"), table_name="watchlists")
    op.drop_index(op.f("ix_watchlists_id"), table_name="watchlists")
    op.drop_table("watchlists")

    op.drop_index(op.f("ix_valuations_model_type"), table_name="valuations")
    op.drop_index(op.f("ix_valuations_company_id"), table_name="valuations")
    op.drop_index(op.f("ix_valuations_id"), table_name="valuations")
    op.drop_table("valuations")
