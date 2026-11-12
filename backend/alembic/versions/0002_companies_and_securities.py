"""Create companies, exchanges, securities, sectors and industries tables

Revision ID: 0002_companies_securities
Revises: 0001_baseline
Create Date: 2026-11-12 23:07:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_companies_securities'
down_revision: Union[str, None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sectors
    op.create_table(
        'sectors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sectors_name'), 'sectors', ['name'], unique=True)

    # 2. industries
    op.create_table(
        'industries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sector_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sector_id', 'name', name='uq_sector_industry_name')
    )
    op.create_index(op.f('ix_industries_sector_id'), 'industries', ['sector_id'], unique=False)

    # 3. exchanges
    op.create_table(
        'exchanges',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=10), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_exchanges_code'), 'exchanges', ['code'], unique=True)

    # 4. companies
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('legal_name', sa.String(length=255), nullable=True),
        sa.Column('isin', sa.String(length=12), nullable=False),
        sa.Column('cin', sa.String(length=25), nullable=True),
        sa.Column('sector_id', sa.Integer(), nullable=True),
        sa.Column('industry_id', sa.Integer(), nullable=True),
        sa.Column('is_financial_sector', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('accounting_standard', sa.String(length=50), nullable=False, server_default='IND-AS'),
        sa.Column('paid_up_capital', sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column('face_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['industry_id'], ['industries.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_companies_isin'), 'companies', ['isin'], unique=True)
    op.create_index(op.f('ix_companies_cin'), 'companies', ['cin'], unique=False)
    op.create_index(op.f('ix_companies_name'), 'companies', ['name'], unique=False)
    op.create_index(op.f('ix_companies_sector_id'), 'companies', ['sector_id'], unique=False)
    op.create_index(op.f('ix_companies_industry_id'), 'companies', ['industry_id'], unique=False)

    # 5. securities
    op.create_table(
        'securities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('exchange_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=50), nullable=False),
        sa.Column('series', sa.String(length=10), nullable=False, server_default='EQ'),
        sa.Column('exchange_token', sa.String(length=50), nullable=True),
        sa.Column('provider_instrument_key', sa.String(length=100), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('lot_size', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('market_cap_category', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exchange_id'], ['exchanges.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('exchange_id', 'symbol', name='uq_exchange_symbol')
    )
    op.create_index('idx_security_symbol', 'securities', ['symbol'], unique=False)
    op.create_index('idx_security_company_exchange', 'securities', ['company_id', 'exchange_id'], unique=False)
    op.create_index(op.f('ix_securities_company_id'), 'securities', ['company_id'], unique=False)
    op.create_index(op.f('ix_securities_exchange_id'), 'securities', ['exchange_id'], unique=False)
    op.create_index(op.f('ix_securities_provider_instrument_key'), 'securities', ['provider_instrument_key'], unique=False)


def downgrade() -> None:
    op.drop_table('securities')
    op.drop_table('companies')
    op.drop_table('exchanges')
    op.drop_table('industries')
    op.drop_table('sectors')
