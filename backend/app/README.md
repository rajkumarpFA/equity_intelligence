# Equity Intelligence Backend Blueprint

## System Overview
FastAPI asynchronous backend platform providing financial intelligence, valuation engines, multi-period financial statement analysis, market data ingestion, and portfolio tracking for Indian equities (NSE & BSE).

## Subdirectories & System Boundaries
- **Calculations** (`./calculations/README.md`): Pure deterministic financial math engines (DCF, Graham, Piotroski, DuPont, Ratios, Technicals).
- **Services** (`./services/README.md`): Domain orchestration, business logic, multi-period aggregations, and database transactions.
- **Models** (`./models/README.md`): SQLAlchemy 2.0 ORM declarative models, foreign keys, and relational schema constraints.
- **API Endpoints** (`./api/`): FastAPI REST router mounting versioned v1 endpoints (`/companies`, `/financials`, `/valuation`, `/screener`, `/compare`, `/watchlists`, `/journal`).
- **Core** (`./core/`): Application configuration (`config.py`), security tokens, and logging.
- **Database** (`./db/`): SQLAlchemy async session factory, engine setup, and base declarative metadata.
- **Providers** (`./providers/`): External market data adapters (Yahoo Finance, Upstox API v2).

## Global Invariants
- **Non-blocking Async**: All I/O, database queries, and external HTTP fetches must run asynchronously without blocking the event loop.
- **Financial Sector Segregation**: Universal separation between industrial and banking equities (`is_financial_sector=True`).
- **Accounting Reporting Basis**: Explicit separation between `STANDALONE` (parent company only) and `CONSOLIDATED` (subsidiary-inclusive) financials.

## Global Side Effects
- Manages state in the PostgreSQL database (`equity_intelligence`).
- Performs outbound HTTPS calls to market data providers for price updates.

## System Verification
- Run: `cd backend && uv run pytest`
