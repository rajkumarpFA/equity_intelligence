"""Create data_sources, source_documents, ingestion_jobs, rejected_records,
validation_results, financial_metrics, financial_statements, financial_facts,
price_history, corporate_actions, and shareholding_history tables.

Revision ID: 0003_ingestion_statements
Revises: 0002_companies_securities
Create Date: 2026-11-13 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_ingestion_statements"
down_revision: Union[str, None] = "0002_companies_securities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. data_sources
    op.create_table(
        "data_sources",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=30), nullable=False),
        sa.Column("base_url", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_data_sources_name"), "data_sources", ["name"], unique=True)

    # 2. source_documents
    op.create_table(
        "source_documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=512), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("fiscal_year", sa.Integer(), nullable=True),
        sa.Column("fiscal_period", sa.String(length=20), nullable=True),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("upload_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meta_info", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_source_documents_sha256_hash"), "source_documents", ["sha256_hash"], unique=True)
    op.create_index(op.f("ix_source_documents_company_id"), "source_documents", ["company_id"], unique=False)

    # 3. ingestion_jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("records_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_inserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("execution_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ingestion_jobs_idempotency_key"), "ingestion_jobs", ["idempotency_key"], unique=True)
    op.create_index(op.f("ix_ingestion_jobs_job_type"), "ingestion_jobs", ["job_type"], unique=False)
    op.create_index(op.f("ix_ingestion_jobs_status"), "ingestion_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_ingestion_jobs_source_id"), "ingestion_jobs", ["source_id"], unique=False)
    op.create_index(op.f("ix_ingestion_jobs_company_id"), "ingestion_jobs", ["company_id"], unique=False)

    # 4. rejected_records
    op.create_table(
        "rejected_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ingestion_job_id", sa.Integer(), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("rejection_reason", sa.Text(), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("review_status", sa.String(length=20), nullable=False, server_default="UNRESOLVED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rejected_records_ingestion_job_id"), "rejected_records", ["ingestion_job_id"], unique=False)
    op.create_index(op.f("ix_rejected_records_source_id"), "rejected_records", ["source_id"], unique=False)

    # 5. validation_results
    op.create_table(
        "validation_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ingestion_job_id", sa.Integer(), nullable=True),
        sa.Column("rule_code", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="WARNING"),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_validation_results_ingestion_job_id"), "validation_results", ["ingestion_job_id"], unique=False)
    op.create_index(op.f("ix_validation_results_rule_code"), "validation_results", ["rule_code"], unique=False)

    # 6. financial_metrics
    op.create_table(
        "financial_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("is_banking_specific", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("normal_balance", sa.String(length=10), nullable=False, server_default="CREDIT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_financial_metrics_code"), "financial_metrics", ["code"], unique=True)
    op.create_index(op.f("ix_financial_metrics_category"), "financial_metrics", ["category"], unique=False)

    # 7. financial_statements
    op.create_table(
        "financial_statements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("statement_type", sa.String(length=30), nullable=False),
        sa.Column("reporting_basis", sa.String(length=20), nullable=False),
        sa.Column("period_type", sa.String(length=20), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.Column("fiscal_quarter", sa.Integer(), nullable=True),
        sa.Column("publication_date", sa.Date(), nullable=True),
        sa.Column("is_audited", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_restated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("supersedes_statement_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supersedes_statement_id"], ["financial_statements.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_id",
            "statement_type",
            "reporting_basis",
            "period_type",
            "period_end",
            "version",
            name="uq_statement_period_version",
        ),
    )
    op.create_index(op.f("ix_financial_statements_company_id"), "financial_statements", ["company_id"], unique=False)
    op.create_index(op.f("ix_financial_statements_fiscal_year"), "financial_statements", ["fiscal_year"], unique=False)
    op.create_index("idx_statement_company_period", "financial_statements", ["company_id", "period_end"], unique=False)
    op.create_index("idx_statement_lookup", "financial_statements", ["company_id", "statement_type", "reporting_basis"], unique=False)

    # 8. financial_facts
    op.create_table(
        "financial_facts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("statement_id", sa.Integer(), nullable=False),
        sa.Column("metric_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("raw_value", sa.String(length=100), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="CRORES"),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("source_document_id", sa.Integer(), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("extraction_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("extraction_method", sa.String(length=30), nullable=False, server_default="API"),
        sa.Column("validation_status", sa.String(length=30), nullable=False, server_default="UNVERIFIED"),
        sa.ForeignKeyConstraint(["metric_id"], ["financial_metrics.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_document_id"], ["source_documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["statement_id"], ["financial_statements.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("statement_id", "metric_id", name="uq_statement_metric"),
    )
    op.create_index(op.f("ix_financial_facts_statement_id"), "financial_facts", ["statement_id"], unique=False)
    op.create_index(op.f("ix_financial_facts_metric_id"), "financial_facts", ["metric_id"], unique=False)
    op.create_index(op.f("ix_financial_facts_source_id"), "financial_facts", ["source_id"], unique=False)
    op.create_index(op.f("ix_financial_facts_source_document_id"), "financial_facts", ["source_document_id"], unique=False)
    op.create_index("idx_fact_statement_metric", "financial_facts", ["statement_id", "metric_id"], unique=False)

    # 9. price_history
    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("security_id", sa.Integer(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("open", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("high", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("low", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("close", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.Column("volume", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("adj_close", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["security_id"], ["securities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("security_id", "trade_date", name="uq_security_trade_date"),
    )
    op.create_index(op.f("ix_price_history_security_id"), "price_history", ["security_id"], unique=False)
    op.create_index(op.f("ix_price_history_trade_date"), "price_history", ["trade_date"], unique=False)
    op.create_index(op.f("ix_price_history_source_id"), "price_history", ["source_id"], unique=False)
    op.create_index("idx_price_security_date", "price_history", ["security_id", "trade_date"], unique=False)

    # 10. corporate_actions
    op.create_table(
        "corporate_actions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("security_id", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(length=30), nullable=False),
        sa.Column("announcement_date", sa.Date(), nullable=True),
        sa.Column("ex_date", sa.Date(), nullable=True),
        sa.Column("record_date", sa.Date(), nullable=True),
        sa.Column("ratio_numerator", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("ratio_denominator", sa.Numeric(precision=18, scale=6), nullable=True),
        sa.Column("dividend_amount", sa.Numeric(precision=20, scale=4), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["security_id"], ["securities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_corporate_actions_company_id"), "corporate_actions", ["company_id"], unique=False)
    op.create_index(op.f("ix_corporate_actions_security_id"), "corporate_actions", ["security_id"], unique=False)
    op.create_index(op.f("ix_corporate_actions_ex_date"), "corporate_actions", ["ex_date"], unique=False)
    op.create_index("idx_corporate_action_company_ex_date", "corporate_actions", ["company_id", "ex_date"], unique=False)

    # 11. shareholding_history
    op.create_table(
        "shareholding_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("promoter_pct", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("promoter_pledged_pct", sa.Numeric(precision=18, scale=6), nullable=False, server_default="0"),
        sa.Column("fii_pct", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("dii_pct", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("public_pct", sa.Numeric(precision=18, scale=6), nullable=False),
        sa.Column("others_pct", sa.Numeric(precision=18, scale=6), nullable=False, server_default="0"),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("source_document_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_document_id"], ["source_documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "period_end", name="uq_company_shareholding_period"),
    )
    op.create_index(op.f("ix_shareholding_history_company_id"), "shareholding_history", ["company_id"], unique=False)
    op.create_index(op.f("ix_shareholding_history_period_end"), "shareholding_history", ["period_end"], unique=False)
    op.create_index("idx_shareholding_company_period", "shareholding_history", ["company_id", "period_end"], unique=False)


def downgrade() -> None:
    op.drop_table("shareholding_history")
    op.drop_table("corporate_actions")
    op.drop_table("price_history")
    op.drop_table("financial_facts")
    op.drop_table("financial_statements")
    op.drop_table("financial_metrics")
    op.drop_table("validation_results")
    op.drop_table("rejected_records")
    op.drop_table("ingestion_jobs")
    op.drop_table("source_documents")
    op.drop_table("data_sources")
