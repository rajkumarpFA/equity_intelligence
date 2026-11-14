# Core Domain Services

## Overview
Business orchestration layer managing database sessions, entity queries, multi-period financial analysis, external market data providers, watchlists, screener rules, and user investment journals.

## Interface
- `company_service.py`: `CompanyService` — CRUD, dual exchange symbol resolution (NSE/BSE), corporate identifier indexing (ISIN, CIN).
- `financial_statement_service.py`: `FinancialStatementService` — Standardized 10-year statement matrix generation (`STANDALONE` vs `CONSOLIDATED`), historical restatements.
- `price_service.py`: `PriceService` — Daily EOD candlestick ingestion, provider routing (Yahoo Finance / Upstox), technical indicator computation.
- `valuation_service.py`: `ValuationService` — DCF workbench, sensitivity grids, Benjamin Graham intrinsic value, saved user models.
- `analysis_service.py`: `AnalysisService` — Financial health ratios, 3-stage DuPont decomposition, 9-factor Piotroski F-Score.
- `comparison_service.py`: `ComparisonService` — Side-by-side peer benchmarking, cross-sector validation, leader metric tagging.
- `screening_service.py`: `ScreeningService` — Quantitative screener evaluation engine, custom multi-rule condition evaluator.
- `watchlist_service.py`: `WatchlistService` — User watchlist management, target price alert triggers.
- `journal_service.py`: `JournalService` — Thesis notes, investment log tracking with tagged rationale.
- `integrity_service.py`: `IntegrityService` — Mathematical reconciliation of balance sheets, shareholding sum validation.

## Invariants
- **Session Management**: All service methods accept an `AsyncSession` dependency injected from FastAPI endpoints.
- **Reporting Basis Isolation**: Statements must always be tagged as either `STANDALONE` or `CONSOLIDATED`.
- **Financial Sector Validation**: Comparison and screener engines enforce separation between industrial equities and financial sector companies (Banks & NBFCs).

## Side Effects
- Reads and mutates the PostgreSQL database via SQLAlchemy async sessions.
- Ingests external market data via HTTP endpoints when cache is cold.

## Verification
- Run: `cd backend && uv run pytest tests/test_services.py tests/test_valuation.py tests/test_screening.py`
