# Equity Intelligence — Project Progress & Phase Deliverables

This document tracks all tasks, architectural decisions, completed deliverables, and test gates for each phase of the Equity Intelligence platform.

---

## Phase 1: Repository Inspection & Architectural Design
- **Status**: Completed & Approved
- **Scope**: Greenfield environment audit, modular monolith architecture design, PostgreSQL normalized schema design, 16-phase roadmap with per-phase test gates, and local deployment planning.
- **Key Deliverables**:
  - `implementation_plan.md`: Comprehensive master architectural blueprint and risk register.
- **Test Gate**: Environment verified (Python 3.12, Node 22, pnpm, Docker configuration audit).

---

## Phase 2: Foundation Shell & Infrastructure
- **Status**: Completed & Verified
- **Scope**: Docker Compose topology, backend FastAPI shell with healthcheck, PostgreSQL connection handling, Alembic setup, Next.js shell with responsive sidebar navigation and health indicator.
- **Tasks Done**:
  - Created `docker-compose.yml` (Compose 3.7 compatible) with `db` (PostgreSQL 16), `backend`, and `frontend`.
  - Configured persistent volumes (`equity_intelligence_postgres_data`, `equity_intelligence_uploaded_docs`).
  - Implemented `backend/app/core/config.py` (Pydantic settings with `SecretStr` redaction) and `logging.py`.
  - Built `backend/app/db/session.py` with database connection pooling and live DB latency health probe.
  - Implemented `GET /api/v1/health` and `GET /api/v1/health/ping`.
  - Created Alembic configuration (`alembic.ini`, `env.py`, `0001_baseline.py`).
  - Built Next.js layout with `Sidebar.tsx` (all 10 navigation routes) and `HealthIndicator.tsx`.
  - Created database backup & restore scripts (`scripts/backup.sh`, `scripts/restore.sh`).
- **Test Gate**:
  - Backend: 6 Pytest tests passed (`test_health.py`, `test_config.py`).
  - Frontend: 4 Vitest tests passed, Next.js production build succeeded (`13/13` routes).

---

## Phase 3: Company Master, Exchanges, Taxonomy & Stock Discovery
- **Status**: Completed & Verified
- **Scope**: Relational taxonomy and company models, ISIN-based cross-exchange deduplication, Stock Discovery API and UI, plus full dark mode system.
- **Tasks Done**:
  - **Dark Mode System**:
    - Added Modern Web Guidance compliant root theming (`color-scheme: light dark`).
    - Implemented inline anti-FOUC script in `layout.tsx`.
    - Created `ThemeToggle.tsx` (System, Light, Dark) in header.
    - Added Tailwind dark mode classes across all views.
  - **Database & Models**:
    - Created `Sector`, `Industry`, `Exchange`, `Company`, and `Security` models in `backend/app/models/company.py`.
    - Created Alembic migration `0002_companies_and_securities.py`.
    - Enforced `is_financial_sector` boolean to safeguard financial institutions from misleading industrial ratios.
  - **Deduplication & Repository**:
    - Implemented `CompanyRepository.upsert_canonical_company()` using ISIN as canonical cross-exchange anchor.
    - Prevented duplicate company records when ingesting both NSE and BSE listings.
    - Implemented multi-attribute search across company name, ISIN, CIN, and trading symbols.
  - **Services & APIs**:
    - Created `CompanyService` with official 7 benchmark companies seeder.
    - Created endpoints: `GET /api/v1/companies`, `GET /api/v1/companies/{id}`, `GET /api/v1/companies/isin/{isin}`, `GET /api/v1/companies/taxonomy/sectors`, and `POST /api/v1/companies/seed`.
  - **Frontend Stock Discovery**:
    - Built `StockDiscoveryView.tsx` on `/discover` with search bar, exchange filters (`All`, `NSE`, `BSE`), sector dropdown, and dual-listing badges.
    - Created detailed company view `/companies/[id]/page.tsx` previewing the 18-section research suite.
- **Test Gate**:
  - Backend: 10/10 Pytest tests passed (`test_companies.py` covering ISIN deduplication, search, and API endpoints).
  - Frontend: 6/6 Vitest tests passed (`discovery.test.tsx`, `theme.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`). Next.js production build succeeded (`13/13` routes).

---

## Phase 4: Provider Adapters & Upstox Coverage Benchmark
- **Status**: Completed & Verified
- **Scope**: Provider abstraction layer, Upstox API adapter, Official Exchange & CSV adapter, Yahoo Finance fallback adapter, 7-company empirical coverage benchmark, and the 4 required governance reports.
- **Tasks Done**:
  - **Provider Abstraction**:
    - Created canonical DTOs in `backend/app/providers/interfaces/models.py` (`ProviderInstrument`, `ProviderCompanyProfile`, `ProviderFinancialStatement`, `ProviderFact`, `ProviderShareholding`, `ProviderCorporateAction`, `ProviderCandle`).
    - Created `BaseDataProvider` abstract contract in `backend/app/providers/interfaces/base.py`.
  - **Adapters Built**:
    - `YahooFinanceProvider` in `backend/app/providers/yahoo_finance/adapter.py`: Configured as the **active default price provider** (`DEFAULT_PRICE_PROVIDER=yahoo_finance`), successfully fetching multi-year EOD historical candles for Indian equities (e.g. 1,700 daily candles for `RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`) without requiring any authentication tokens or static IPs.
    - `UpstoxProvider` in `backend/app/providers/upstox/adapter.py`: Integrates Upstox daily master decompression (`.json.gz`), throttling rate-limiter, Bearer authorization, and EOD historical candle parser.
    - `OfficialExchangeProvider` in `backend/app/providers/exchange/adapter.py`: Independent adapter for official NSE/BSE filings, CSV statement metrics parsing, and bhavcopy EOD price file ingestion.
    - Provider registry factory `get_provider()` and `get_active_price_provider()` in `backend/app/providers/__init__.py`.
  - **Empirical Benchmark on 7 Reference Equities**:
    - Ran `run_benchmark()` across all 7 benchmark companies (Reliance, TCS, HDFC Bank, Suzlon Energy, Tata Motors, Tanla Platforms, Tata Technologies).
    - Verified 100% instrument master resolution across NSE and BSE listings.
  - **4 Governance & Quality Reports Generated**:
    - `docs/upstox_coverage_report.md`
    - `docs/upstox_data_quality_report.md`
    - `docs/upstox_reconciliation_report.md`
    - `docs/upstox_integration_decision.md` (Decision: `CONDITIONAL GO` — Upstox is integrated as an optional market-data adapter with full support for the 1-year read-only **Upstox Analytics Token**, guaranteeing complete local operation without daily expiration bottlenecks or mandatory paid dependencies).
- **Test Gate**:
  - Backend: 15/15 Pytest tests passed (`test_providers.py` verifying registry, token handling, CSV statement parsing, bhavcopy parsing, and report generation).
  - All ruff checks passed cleanly.

---

## Phase 5: Data Ingestion Pipeline & Normalization
- **Status**: Completed & Verified
- **Scope**: Idempotent ingestion pipeline, database models & Alembic migration `0003_ingestion_and_statements.py`, token bucket rate limiting, exponential backoff retry with jitter, canonical metrics normalization, APScheduler background runner, CSV import with partial-failure quarantine, PDF upload with SHA-256 deduplication, and the interactive Data Management UI.
- **Tasks Done**:
  - **Database Schema & Models**:
    - Created `backend/app/models/ingestion.py` (`DataSource`, `SourceDocument`, `IngestionJob`, `RejectedRecord`, `ValidationResult`).
    - Created `backend/app/models/financials.py` (`FinancialMetric`, `FinancialStatement`, `FinancialFact`).
    - Created `backend/app/models/market_data.py` (`PriceHistory`, `CorporateAction`, `ShareholdingHistory`).
    - Created and executed Alembic migration `backend/alembic/versions/0003_ingestion_and_statements.py` applying all 11 tables cleanly to PostgreSQL 16.
  - **Ingestion Pipeline Engine (`backend/app/ingestion/`)**:
    - `rate_limiter.py`: Thread-safe and async token bucket rate limiter with provider-specific limits (`ProviderRateLimiterRegistry`).
    - `retry.py`: Exponential backoff with full jitter for transient HTTP 429/5xx status codes and network timeouts.
    - `normalizer.py`: Canonical financial metric mapping (36 standard metrics across Income Statement, Balance Sheet, Cash Flow, and Banking-specific items), unit normalization (converting Lakhs, Millions, INR into standardized Crores or Per-Share), and Indian corporate fiscal period calculation.
    - `job_runner.py`: Idempotent job runner context manager with concurrency locks, status transitions, counters, and quarantine recording.
    - `scheduler.py`: Background job runner with `APScheduler` for daily EOD candle syncs.
  - **Services, Repositories & Endpoints**:
    - `IngestionRepository`: Seeding of standard financial metrics and default data sources, upsert operations for statements, facts, and daily candles.
    - `IngestionService`: Price sync for securities, tabular and row-based CSV statement parsing with partial failure quarantine into `rejected_records`, and audit document uploads with SHA-256 deduplication.
    - Endpoints in `backend/app/api/v1/endpoints/ingestion.py`:
      - `POST /api/v1/ingestion/initialize`
      - `POST /api/v1/ingestion/trigger/price-sync`
      - `POST /api/v1/ingestion/trigger/benchmark-sync`
      - `GET /api/v1/ingestion/jobs` and `GET /api/v1/ingestion/jobs/{id}`
      - `POST /api/v1/ingestion/upload/csv`
      - `POST /api/v1/ingestion/upload/report`
      - `GET /api/v1/ingestion/rejected-records`
      - `GET /api/v1/ingestion/scheduled-jobs`
  - **Data Management UI (`/data-management`)**:
    - Implemented `frontend/src/components/data-management/DataManagementView.tsx` with 4 operational tabs:
      1. Ingestion Jobs audit table with live status badges, idempotency keys, and metrics counters.
      2. Automated background schedules viewer (`APScheduler`).
      3. Upload Financial Statement CSV with company selector, statement type, reporting basis, and unit selection.
      4. Upload Annual Report PDF with SHA-256 deduplication and fiscal period tagging.
      5. Quarantined Records viewer for reviewing unparseable or rejected raw line items without silent data loss.
  - **Market Price Architecture & External Live Verification**:
    - **Fundamental vs Day-Trading Strategy**: Shifted from fragile, aggressive background polling to stable local EOD snapshots with manual on-demand refresh, preventing external API bans, 429 throttling, and UI stutter.
    - **Isolated Single-Company Refresh Architecture**:
      - Eliminated batch price polling in discovery view (`search_companies` now strictly reads from local in-memory cache/DB, generating **0 external network requests** during browsing or searching).
      - Removed batch auto-refresh and batch manual refresh buttons from `/discover`.
      - Added card-level isolated refresh (`RefreshCw`) for individual stocks, and window-level dedicated refresh in `/companies/[id]`, giving users complete granular control.
    - **Live External Verification Deep-Links**:
      - Implemented `frontend/src/lib/external-links.ts` with deep-link generators for **TradingView** (interactive candlestick chart), **Google Finance**, **Yahoo Finance**, **NSE India Official Quote**, and **BSE India Scrip Page**.
      - Integrated external quote pills into `frontend/src/app/companies/[id]/page.tsx` alongside canonical ISIN/exchange badges and snapshot timestamps.
      - Integrated compact 1-click external quick links (`TV ↗`, `GFin ↗`) onto each stock card in `frontend/src/components/discovery/StockDiscoveryView.tsx`.
    - **On-Demand Stock Lookup & Addition**:
      - Built `POST /api/v1/companies/lookup-and-add` integrating Upstox's open CDN instrument master (~9,899 NSE instruments) and Yahoo Finance metadata fallback.
      - Enabled on-demand lookup and addition of any NSE/BSE stock (e.g., `INFY`, `ITC`, `SBIN`, `WIPRO`) with verified ISIN mapping, sector inference, and price snapshot directly into local PostgreSQL.
      - Added interactive Quick-Add input bar in header and empty-search CTA in `StockDiscoveryView.tsx`.
    - **Network Stability & Provider Throttling Hardening**:
      - Integrated `ProviderRateLimiterRegistry` token bucket rate limiter into `YahooFinanceProvider`.
      - Bounded concurrency with `asyncio.Semaphore(2)` and 150ms pacing in `PriceService`.
      - Reduced quote payload from 5+ years (~150KB) to 30 days (~2KB), reducing network overhead by 98%.
      - Added automated 2-attempt retry loop with exponential backoff for `RemoteProtocolError` and connection drops.
    - **Ticker Alias Mapping**: Resolved corporate restructuring edge cases (e.g., Tata Motors demerger ticker `TATAMOTORS.NS` -> `TMCV.NS`) in `YahooFinanceProvider`.
    - **Force Refresh**: Added `force_refresh: bool` support to bypass the local 5-minute cache on demand via `?refresh=true`.
- **Test Gate**:
  - Backend: 37/37 Pytest tests passed (`test_ingestion.py`, `test_companies.py`, `test_providers.py`, `test_health.py`, `test_config.py`).
  - Code Quality: `ruff check app tests` passing cleanly with zero errors.
  - Frontend: 8/8 Vitest tests passed (`data-management.test.tsx`, `discovery.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`, `theme.test.tsx`).
  - Production Build: Next.js production build succeeded with all 13 routes statically/dynamically compiled.

---

## Phase 6: Data Integrity Engine & Fundamental Verification
- **Status**: Completed & Verified
- **Scope**: Multi-dimensional accounting verification rules, financial identity reconciliation, outlier and anomaly detection, restatement versioning, corporate action adjustments (split/bonus multipliers and price/volume/EPS adjustments), persistent audit logging to `validation_results`, on-demand stock addition, and frontend audit UI.
- **Tasks Done**:
  - **Data Integrity Rule Architecture (`backend/app/integrity/models.py`)**:
    - Created `ValidationRuleCode` enumeration with standard codes for accounting identity, consistency, outlier, and restatement checks.
    - Created `ValidationSeverity` enum (`INFO`, `WARNING`, `ERROR`, `CRITICAL`).
    - Created `RuleResult` DTO capturing pass/fail status, delta, tolerance, explanation, and offending metric keys.
    - Created `IntegrityAuditSummary` DTO aggregating company-wide rule executions, error/warning counts, and audit logs.
  - **Fundamental Accounting Identity Rules (`backend/app/integrity/accounting_rules.py`)**:
    - `validate_balance_sheet_identity`: Enforces double-entry equality for Industrial companies ($\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Equity}$) and Banking institutions ($\text{Total Assets} \equiv \text{Deposits} + \text{Borrowings} + \text{Other Liabilities} + \text{Total Equity}$) with configurable tolerance (default ₹0.05 Cr).
    - `validate_cash_flow_identity`: Reconciles $\text{Net Cash Flow} \equiv \text{CFO} + \text{CFI} + \text{CFF}$ and validates that $\text{Cash Ending} - \text{Cash Beginning} \equiv \text{Net Cash Flow}$.
    - `validate_income_statement_articulation`: Reconciles $\text{Total Revenue} \equiv \text{Revenue from Operations} + \text{Other Income}$, Operating Profit articulation, and $\text{PAT} \equiv \text{PBT} - \text{Tax Expense}$.
    - `validate_banking_accounting_identity`: Reconciles Net Interest Income ($\text{NII} \equiv \text{Interest Earned} - \text{Interest Expended}$) and verifies banking provisions articulation.
  - **Consistency & Safeguard Rules (`backend/app/integrity/consistency_rules.py`)**:
    - `validate_missing_value_safety`: Strictly protects missing or unfiled line items from false zero coercion.
    - `validate_unit_currency_consistency`: Validates that statements adhere to canonical units (`CRORES` or `PER_SHARE`) and INR currency.
    - `validate_reporting_basis_isolation`: Guards against cross-contaminating Standalone and Consolidated statements across the same period.
  - **Outlier & Anomaly Rules (`backend/app/integrity/outlier_rules.py`)**:
    - `validate_yoy_anomalies`: Detects sudden YoY revenue/PAT/debt spikes (>150%) or collapses (<-75%) across consecutive annual filings.
    - `validate_impossible_margins`: Flags Net Profit Margin or Operating Margin exceeding 100% or falling below -300%.
    - `validate_negative_value_safeguards`: Flags impossible negative values for Total Assets, Share Capital, or Total Revenue.
  - **Restatement Manager (`backend/app/integrity/restatement_manager.py`)**:
    - `RestatementManager`: Computes fact-level restatement diffs, version increments, and audit trails when updated filings arrive.
  - **Corporate Action Adjustment Engine (`backend/app/integrity/corporate_action_adjuster.py`)**:
    - `CorporateActionAdjuster`:
      - Calculates split/bonus share multipliers (e.g. 10:1 split -> factor 0.1, 1:1 bonus -> factor 0.5).
      - Computes cumulative multi-action chain factors over historical chronological dates.
      - Adjusts historical close prices, trade volumes, and per-share metrics (EPS, DPS) with zero economic distortion.
  - **Integrity Service & API Endpoints (`backend/app/services/integrity_service.py`)**:
    - Built `IntegrityService` orchestrating rule validation runs, persisting findings into `validation_results` table, and fetching audit logs.
    - Endpoints in `backend/app/api/v1/endpoints/integrity.py`:
      - `POST /api/v1/integrity/validate/company/{company_id}`
      - `POST /api/v1/integrity/validate/statement/{statement_id}`
      - `GET /api/v1/integrity/results/company/{company_id}`
      - `POST /api/v1/integrity/corporate-actions/adjust-prices/{security_id}`
  - **On-Demand Stock Lookup & Addition (`backend/app/api/v1/endpoints/companies.py`)**:
    - Implemented `POST /api/v1/companies/lookup-and-add?symbol={sym}&exchange={ex}` to import any Indian company on demand via Upstox open CDN instrument master (~9,899 NSE instruments) or Yahoo Finance fallback.
    - Verified live with `INFY` (Infosys Limited, ISIN `INE009A01021`, initial price: ₹1,140.50).
  - **Frontend UI Enhancements**:
    - `DataManagementView.tsx`: Added 5th tab `Data Integrity & Accounting Audit` with company picker, live audit trigger, summary cards, and findings table.
    - `StockDiscoveryView.tsx`: Integrated Quick-Add bar, empty-search lookup prompt, and card-level isolated refresh (`RefreshCw`).
    - `CompanyDetailPage`: Isolated single-company refresh and live external deep-links (TradingView, Google Finance, Yahoo Finance, NSE, BSE).
- **Test Gate**:
  - Backend: 45/45 Pytest tests passed (`test_integrity.py`, `test_ingestion.py`, `test_companies.py`, `test_providers.py`, `test_health.py`, `test_config.py`).
  - Code Quality: `ruff check app tests` passing with 0 errors.
  - Frontend: 8/8 Vitest tests passed.
  - Production Build: Next.js production build succeeded with 13/13 routes statically/dynamically compiled.

---

## Phase 7: Financial Statements & Company Research UI
- **Status**: Ready to Begin (Awaiting User Approval of Phase 6)
- **Scope**: Comprehensive 18-section Company Research page at `/companies/[id]`, financial statement visualizer (Balance Sheet, P&L, Cash Flow), Standalone vs Consolidated toggle, Annual vs Quarterly periods, source traceability drawers, corporate actions and shareholding pattern tables.
