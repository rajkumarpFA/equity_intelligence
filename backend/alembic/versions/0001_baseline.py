"""Baseline migration verifying alembic setup

Revision ID: 0001_baseline
Revises: 
Create Date: 2026-11-12 22:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline setup — domain tables are added in subsequent phases
    pass


def downgrade() -> None:
    pass
