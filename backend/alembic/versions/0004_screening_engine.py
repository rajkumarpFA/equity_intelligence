"""Create saved_screens table.

Revision ID: 0004_screening_engine
Revises: 0003_ingestion_statements
Create Date: 2026-11-13 15:57:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0004_screening_engine"
down_revision: Union[str, None] = "0003_ingestion_statements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_screens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "filter_expression",
            sa.JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
        sa.Column("sort_by", sa.String(length=50), nullable=False, server_default="market_cap"),
        sa.Column("sort_direction", sa.String(length=4), nullable=False, server_default="desc"),
        sa.Column("is_preset", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
    op.create_index(op.f("ix_saved_screens_id"), "saved_screens", ["id"], unique=False)
    op.create_index(op.f("ix_saved_screens_name"), "saved_screens", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_screens_name"), table_name="saved_screens")
    op.drop_index(op.f("ix_saved_screens_id"), table_name="saved_screens")
    op.drop_table("saved_screens")
