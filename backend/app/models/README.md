# Database Models

## Overview
SQLAlchemy 2.0 async ORM declarative models mapping domain entities to the PostgreSQL relational database schema.

## Interface
- `company.py`: `Company`, `Security` — Equities, dual-listed tickers (NSE/BSE), ISIN unique indices, sector/industry classifications.
- `financials.py`: `FinancialStatement`, `StatementLineItem`, `FinancialFact` — Normalized multi-period financial tables with `reporting_basis` enum and restatement lineage (`supersedes_statement_id`).
- `market_data.py`: `PriceHistory`, `CorporateAction`, `ShareholdingPattern` — Historical EOD candlestick data, splits, dividends, bonuses, and shareholding percentages.
- `valuation.py`: `ValuationModel`, `ValuationScenario` — User-saved DCF, Graham, and multiple valuation models.
- `screening.py`: `ScreeningPreset`, `CustomScreen` — Saved screening filters and condition trees.
- `workflow.py`: `Watchlist`, `WatchlistItem`, `InvestmentJournalNote` — Investment watchlist items and thesis journal entries.
- `ingestion.py`: `DataSource`, `IngestionJob`, `IngestionLog` — Provenance records for financial filing and market data ingestion jobs.

## Invariants
- **ISIN Canonical Anchor**: `Company.isin` is unique across Indian securities.
- **Reporting Basis Separation**: Statements cannot have a null `reporting_basis`; must be explicitly `STANDALONE` or `CONSOLIDATED`.
- **Temporal Keys**: `PriceHistory` enforces unique constraint on `(security_id, trade_date)`.

## Side Effects
- Defines relational foreign keys, cascade deletes, and unique database constraints.

## Verification
- Run: `cd backend && uv run pytest tests/test_models.py`
