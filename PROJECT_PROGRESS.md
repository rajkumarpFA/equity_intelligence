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
- **Status**: Completed & Verified
- **Scope**: Multi-period financial statement matrix (Income Statement, Balance Sheet, Cash Flow), Standalone vs Consolidated toggle, Annual vs Quarterly period selector, click-to-verify Source Traceability Drawer, Shareholding Pattern viewer, Corporate Actions history table, Annual Reports & Filings archive on `/companies/[id]`, and 6th tab in Data Management.
- **Tasks Done**:
  - **Financial Statement Data Schemas (`backend/app/schemas/financial_statements.py`)**:
    - Created `StatementPeriodHeader`: encapsulates period label (`FY2024`, `Q3 FY24`), audit flag, restatement flag, and fiscal dates.
    - Created `FactProvenanceDetail`: full provenance payload including normalized value, raw filing label, raw unscaled value, unit, source document title, SHA-256 cryptographic hash, and validation status.
    - Created `StatementRow`: sparse matrix row with metric code, metric name, unit, and period-value / period-provenance mappings.
    - Created `FinancialStatementMatrixResponse`: top-level response delivering chronologically sorted periods, canonically ordered rows, available reporting bases, and available period types.
    - Created `CorporateActionDetail`: structured representation of stock splits, bonus issues, dividends, and rights issues.
    - Created `ShareholdingPatternDetail`: quarterly ownership distribution across Promoter, Pledged Promoter, FII, DII, and Public categories.
  - **Service Layer (`backend/app/services/financial_statement_service.py`)**:
    - Implemented `FinancialStatementService.get_statement_matrix()`: queries statements and facts, preserves nulls strictly (no fabricated zeros), resolves linked source document hashes and titles, and sorts rows by canonical accounting structure.
    - Implemented `FinancialStatementService.get_available_periods()`: dynamically probes existing statements to configure UI toggles.
    - Implemented `FinancialStatementService.get_corporate_actions()`: returns historical corporate restructuring events ordered by ex-date.
    - Implemented `FinancialStatementService.get_shareholding_history()`: returns quarterly shareholding patterns chronologically.
    - Implemented `FinancialStatementService.seed_sample_financials()`: seeds verified 3-year multi-period statements (P&L, Balance Sheet, Cash Flow), corporate actions, and shareholding patterns for benchmark verification.
  - **API Endpoints (`backend/app/api/v1/endpoints/companies.py` & `ingestion.py`)**:
    - `GET /api/v1/companies/{id}/statements`
    - `GET /api/v1/companies/{id}/available-statement-periods`
    - `GET /api/v1/companies/{id}/corporate-actions`
    - `GET /api/v1/companies/{id}/shareholding`
    - `POST /api/v1/companies/{id}/seed-financials`
    - `GET /api/v1/ingestion/documents`: lists all uploaded filings with company names, file sizes, and SHA-256 hashes.
    - `GET /api/v1/ingestion/documents/{id}/download`: file streaming response for direct PDF/document viewing and download.
  - **Frontend Client & Types (`frontend/src/types/financials.ts`, `frontend/src/lib/api-client.ts`)**:
    - Defined strict TypeScript types matching backend schemas.
    - Added API client functions for statements, corporate actions, shareholding, seeding, and document downloads.
  - **Frontend UI Components**:
    - `StatementViewer.tsx`: Interactive multi-period statement matrix with Income Statement, Balance Sheet, and Cash Flow tabs, Consolidated/Standalone toggle, Annual/Quarterly toggle, unit formatting, and click-to-verify cell interaction.
    - `SourceTraceabilityDrawer.tsx`: Slide-over audit drawer displaying raw filing value, raw extracted label, normalized value, source document name, SHA-256 hash, validation status, and direct PDF download link.
    - `CorporateActionsTable.tsx`: Tabular history of stock splits, bonus issues, cash dividends, and rights with action badges.
    - `ShareholdingViewer.tsx`: Quarterly ownership distribution with summary cards, stacked visual progress bar, and detailed table with pledged promoter warnings.
    - `CompanyDocumentsLibrary.tsx`: Stock-level archive of uploaded annual reports and filings with 1-click download.
    - `DataManagementView.tsx`: Added 6th tab `Uploaded Documents Library` (`documents`) for global file audit and downloads across all companies.
    - `CompanyResearchHub.tsx` (`/companies`): Institutional directory hub featuring benchmark equity quick pills (RELIANCE, TCS, HDFCBANK, TATAMOTORS, etc.), live search, sector taxonomy filters, accounting model isolation (Industrial vs Banking), grid vs table view toggle, live EOD pricing & delta chips, and direct deep-dive links into statements, analysis, technicals, and competitor comparison.
    - `CompanyDetailPage` (`/companies/[id]`): Integrated tabbed navigation bar connecting all Phase 7 components plus the 18-section research suite directory overview (supporting direct deep linking via `?tab=` query parameters).
- **Test Gate**:
  - Backend: 49/49 Pytest tests passed (`test_statements.py`, `test_integrity.py`, `test_ingestion.py`, `test_companies.py`, `test_providers.py`, `test_health.py`, `test_config.py`).
  - Code Quality: `ruff check app tests` passing with 0 errors.
  - Frontend: 12/12 Vitest tests passed across 6 test suites (`company-research.test.tsx`, `data-management.test.tsx`, `discovery.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`, `theme.test.tsx`).
  - Production Build: Next.js production build succeeded with 13/13 routes statically/dynamically compiled.

---

## Inter-Phase Milestone: UI/UX Realignment & Client-Side Stability Overhaul
- **Status**: Completed & Verified
- **Scope**: Complete realignment of frontend UI with `/ui-mockups` and `equity-intelligence-ui` skill rules, plus exhaustive resolution of client-side React hydration and type exceptions.
- **Tasks Done**:
  - **Atmospheric Palette & Tokens**:
    - Integrated `--bg-base: #0B1220`, `--bg-card: #101828` (Sambucus), `--accent: #00D3F3` (Sky), `--accent-2: #FDC700` (Yellow), `--up: #22C55E`, `--down: #EF4444`.
    - Added bottom teal glow gradient (`radial-gradient(ellipse at 50% 110%, rgba(0,211,243,.25), transparent 60%)`) and dot-matrix background pattern.
  - **Shell Architecture**:
    - 64px Sambucus left rail with circular ring active indicators, hover tooltips, and bottom utility cluster.
    - Centered top-bar search pill (`~420px`), API health dot, and freshness chip.
    - 320px collapsible right Insight Rail with sparkline watchlists, valuation anchor, and equity sector pulse.
    - 12-column dashboard layout with macro benchmark cards, segmented tick-bar portfolio card, and real market movers.
  - **Strict Data-Integrity Primitives**:
    - `<MissingValue reason="..." />`: Displays `N/A` with tooltip; never blank or fabricated `0`.
    - `<ValidationBadge />`: Displays verified, cross-checked, needs review, and unverified states.
    - `<DeltaChip />`: Directional color-coded pills strictly for price/returns.
    - `lib/format.ts`: Full Indian numbering support (`en-IN`) for INR, Crores, percentages, and dates.
  - **Client-Side Exception & Hydration Resolution**:
    - Resolved `TypeError: currentPrice.toFixed is not a function`: Backend API serializes PostgreSQL/SQLite Decimal numbers as strings (e.g., `"1336.3"`). Updated `CandlestickChart`, `CorporateActionsTable`, `StatementViewer`, `Sparkline`, and `DeltaChip` to safely coerce and parse numbers (`parseFloat` / `Number()`).
    - Fixed SSR vs client hydration mismatch in `CandlestickChart`: Replaced non-deterministic `Math.random()` in render with a seeded pseudo-random formula (`pseudoRand`) and deterministic date strings (`d.getUTCDate() ${MONTHS[...]}`), ensuring identical HTML between server and client.
    - Replaced random gradient IDs in `Sparkline` and `CandlestickChart` with React's `useId()` (`cleanId = reactId.replace(/:/g, "")`).
    - Added optional chaining safeguards on `company?.securities?.find(...)` across `CompanyDetailPage` and `StockDiscoveryView`.
- **Test Gate**:
  - Frontend Vitest: 12/12 passed across 6 test suites.
  - Next.js Build: Successfully compiled all 13 routes (`pnpm build`).
  - Backend Pytest: 49/49 passed.

---

## Phase 8: Financial Analysis Engine
- **Status**: Completed & Verified
- **Scope**: Deterministic Python calculation engine for multi-year compounded growth ratios (3Y/5Y CAGR and YoY for Revenue, EBITDA, PAT, EPS), profitability metrics (Operating Margin, EBITDA Margin, Net Margin, ROE, ROCE, ROA), 3-stage DuPont ROE decomposition, industrial solvency & capital structure (D/E, Interest Coverage, Current & Quick Ratios), operating efficiency (Working Capital Days, Cash Conversion Cycle, Asset Turnover, DIO, DSO, DPO), institutional quality scores (Altman Z-Score with 4-factor emerging/non-manufacturing model and Piotroski 9-Factor F-Score), strict sector-aware guardrails isolating Banks and NBFCs from corporate bankruptcy formulas, and interactive "Analysis & Health" frontend research tab.
- **Tasks Done**:
  - **Deterministic Financial Calculation Engine (`backend/app/calculations/`)**:
    - `growth.py`: Implemented `calculate_cagr(start_val, end_val, years)` with zero-division and negative base year guards, plus `calculate_yoy_growth(current, previous)`.
    - `profitability.py`: Implemented `operating_margin`, `ebitda_margin`, `net_profit_margin`, `return_on_equity` (with negative equity guard), `return_on_capital_employed` (EBIT ÷ Capital Employed), `return_on_assets`, and 3-stage `dupont_analysis` ($\text{ROE} \equiv \text{Net Margin} \times \text{Asset Turnover} \times \text{Financial Leverage}$).
    - `solvency.py`: Implemented `debt_to_equity`, `interest_coverage` (with zero-interest and net-cash guards), `current_ratio`, `quick_ratio` (excluding inventories), and `debt_to_assets`.
    - `efficiency.py`: Implemented `asset_turnover`, `inventory_turnover`, `debtor_days` (DSO), `inventory_days` (DIO), `creditor_days` (DPO), `cash_conversion_cycle` ($\text{CCC} \equiv \text{DIO} + \text{DSO} - \text{DPO}$), and `working_capital_days`.
    - `scores.py`:
      - Implemented `calculate_altman_z_score`: 4-factor emerging market / non-manufacturing model ($Z = 6.56X_1 + 3.26X_2 + 6.72X_3 + 1.05X_4$) and 5-factor manufacturing model ($Z = 1.2X_1 + 1.4X_2 + 3.3X_3 + 0.6X_4 + 0.999X_5$) with automated zone classifications (`SAFE` > 2.90, `GREY` 1.23 - 2.90, `DISTRESS` < 1.23).
      - Implemented `calculate_piotroski_f_score`: Evaluates 9 fundamental criteria across 3 distinct pillars:
        1. *Profitability (4 pts)*: ROA > 0, CFO > 0, $\Delta$ROA > 0, Quality of Earnings (CFO > ROA / PAT).
        2. *Leverage & Liquidity (3 pts)*: $\Delta$Long-term Debt $\le$ 0, $\Delta$Current Ratio > 0, No Equity Dilution.
        3. *Operating Efficiency (2 pts)*: $\Delta$Gross Margin > 0, $\Delta$Asset Turnover > 0.
        Classifies rating as `VERY_STRONG` (8-9), `MODERATE` (5-7), or `WEAK` (0-4).
    - `banking.py`: Implemented banking-specific ratios: `net_interest_margin` ($\text{NII} \div \text{Assets}$), `casa_ratio` (Low-cost deposit strength), `cost_to_income_ratio` ($\text{Opex} \div \text{Income}$), `npa_pct` (Gross & Net NPA %), and `capital_adequacy_ratio` (CAR % vs RBI 11.5% Basel-III mandate).
    - `__init__.py`: Cleanly re-exported calculation functions.
  - **Pydantic Schemas (`backend/app/schemas/analysis.py`)**:
    - Created `GrowthRatios`, `DuPontDecomposition`, `ProfitabilityRatios`, `SolvencyRatios`, `OperatingEfficiencyRatios`, `BankingRatios`, `HistoricalRatioPeriod`, `CompanyRatiosResponse`.
    - Created `AltmanZScoreDetail`, `PiotroskiFactorItem`, `PiotroskiFScoreDetail`, `QualityScoresResponse`.
  - **Analysis Service & Cross-Statement Period Aggregation (`backend/app/services/analysis_service.py`)**:
    - Built `AnalysisService` with `get_company_ratios()` and `get_company_quality_scores()`.
    - Implemented multi-statement fact consolidation by fiscal year (`period_end`), unifying facts from Income Statement, Balance Sheet, and Cash Flow into a single metric map per fiscal period.
    - Built multi-year historical ratio progression trend (`_compute_historical_trend`) returning annual metrics across all audited filing years.
    - Built strict **Banking vs Industrial Isolation**:
      - If `company.is_financial_sector` is true:
        - Bypasses corporate solvency (D/E, Current/Quick) with explicit `bypass_reason`.
        - Bypasses Cash Conversion Cycle and Inventory Turnover with explicit `bypass_reason`.
        - Bypasses Altman Z-Score with `BANKING_BYPASS` because customer deposits are operating liabilities rather than commercial debts, preventing false insolvency flags.
        - Calculates regulatory banking metrics (NIM, CASA, NPA, CAR) instead.
  - **API Endpoints (`backend/app/api/v1/endpoints/companies.py`)**:
    - Added `GET /api/v1/companies/{id}/ratios?reporting_basis=CONSOLIDATED`
    - Added `GET /api/v1/companies/{id}/quality-scores?reporting_basis=CONSOLIDATED`
  - **Frontend UI & Components**:
    - `frontend/src/types/analysis.ts`: Strict TypeScript interfaces mirroring backend schemas.
    - `frontend/src/lib/api-client.ts`: Added `fetchCompanyRatios()` and `fetchCompanyQualityScores()`.
    - `frontend/src/lib/format.ts`: Added `formatDays(val)` helper.
    - `frontend/src/components/company/FinancialAnalysisTab.tsx`:
      - **Quality & Financial Distress Scores**: Altman Z-Score with color-coded Safe/Grey/Distress badges and 4-factor breakdown; Piotroski 9-factor F-score with 3-pillar breakdown and expandable 9-factor checklist.
      - **DuPont ROE 3-Stage Decomposition**: Visual pipeline ($\text{Net Margin} \times \text{Asset Turnover} \times \text{Leverage} = \text{ROE}$) with institutional takeaway on margin pricing power vs. debt-driven returns.
      - **Compounded Growth (CAGR) Table**: 3Y/5Y CAGR and YoY for Revenue, EBITDA, PAT, and EPS with strict missing value tooltips.
      - **Solvency & Operating Efficiency**: Debt to Equity, Interest Coverage, Current & Quick Ratios, plus Cash Conversion Cycle (DIO + DSO - DPO).
      - **Banking & Regulatory Metrics Card**: Displays NIM %, CASA %, Gross NPA %, Net NPA %, Cost-to-Income %, and CAR % when `is_financial_sector` is true.
      - **Historical Financial Ratio Progression**: Multi-year progression table across all audited fiscal periods.
    - `frontend/src/app/companies/[id]/page.tsx`: Integrated the `Analysis & Health` tab into the main company research navigation.
- **Test Gate**:
  - Backend: 65/65 Pytest tests passed (`test_analysis.py` with 16 unit, service, and API integration tests; all 49 existing tests passing).
  - Frontend: 17/17 Vitest tests passed across 7 test suites (`analysis-tab.test.tsx`, `company-research.test.tsx`, `data-management.test.tsx`, `discovery.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`, `theme.test.tsx`).
  - Production Build: Next.js production build succeeded with 13/13 routes statically/dynamically compiled.

---

## Phase 9: Screening Engine
- **Status**: Completed & Verified
- **Scope**: Multi-parameter equity screener supporting fundamental valuation multiples (P/E, P/B, EV/EBITDA, Market Cap), profitability & return metrics (ROCE, ROE, ROA, Operating Margin, Net Margin), industrial solvency (D/E, Interest Coverage, Current Ratio), cash cycle efficiency, multi-year growth (3Y/5Y CAGR and YoY), quality health scores (Altman Z, Piotroski F), and specialized banking metrics (NIM %, CASA %, NPA %, CAR %), preset institutional screens, dynamic AST filter compiler with AND/OR conjunctions and `between` operator, strict Data Integrity NULL handling, saved screens persistence, RFC 4180 CSV export, and complete `/screener` UI.
- **Tasks Done**:
  - **Database Model & Migration (`backend/app/models/screening.py`, `backend/alembic/versions/0004_screening_engine.py`)**:
    - Created `SavedScreen` model with `id`, `name`, `description`, `filter_expression` (JSONB/JSON AST), `sort_by`, `sort_direction`, `is_preset`, `created_at`, `updated_at`.
    - Created and executed Alembic migration `0004_screening_engine` cleanly applying `saved_screens` table and indices to PostgreSQL 16.
  - **Filter AST & Dynamic Compiler (`backend/app/screening/`)**:
    - `models.py`: Created `FilterCondition`, `FilterExpression` (with `AND` / `OR` conjunction), `ScreenRequest`, `ScreenedCompanyItem`, `ScreenResponse`, `SavedScreenCreate`, `SavedScreenRead`, `SavedScreenUpdate`.
    - `compiler.py`: Dynamic evaluator supporting `>`, `>=`, `<`, `<=`, `==`, `!=`, `between` (range), `contains`, `in`, `not_in`. Strictly enforces Data Integrity Rule 1 (`NULL != 0`): If a metric is `None`, numerical comparisons evaluate strictly to `False` (never coerced to `0` or matching `< 0.5`).
    - `presets.py`: Pre-seeded 5 institutional preset screens:
      1. *"Buffett Moats"*: ROCE $\ge 18\%$, ROE $\ge 18\%$, D/E $\le 0.50x$, 3Y Revenue CAGR $\ge 10\%$.
      2. *"High Growth Compounders"*: 3Y Revenue CAGR $\ge 15\%$, 3Y PAT CAGR $\ge 15\%$, ROCE $\ge 15\%$.
      3. *"Low Debt Cannibals"*: D/E $\le 0.20x$, Interest Coverage $\ge 8.0x$, Net Profit Margin $\ge 8\%$.
      4. *"Value Dividend Kings"*: P/E $\le 25x$, ROCE $\ge 15\%$, D/E $\le 0.50x$.
      5. *"Institutional Financial Titans"*: `is_financial_sector == True`, ROE $\ge 12\%$.
  - **Screening Service (`backend/app/services/screening_service.py`)**:
    - Built `ScreeningService` with `get_screening_universe()`, `run_screen()`, `export_screen_csv()`, `get_preset_screens()`, and full CRUD for `SavedScreen`.
    - Implemented strict NULLS-LAST sorting across all ascending/descending metric sorts.
    - Implemented financial sector inclusion/exclusion toggle (`include_financials`).
    - Implemented RFC 4180 CSV export generating full 26-column downloadable file with "N/A" for missing figures.
  - **API Endpoints (`backend/app/api/v1/endpoints/screening.py`)**:
    - `POST /api/v1/screening/run`: Executes dynamic screen with AST filters, sorting, and pagination.
    - `POST /api/v1/screening/export-csv`: Streams downloadable `screener_export.csv` file.
    - `GET /api/v1/screening/presets`: Returns built-in institutional screens.
    - `GET /api/v1/screening/saved`: Returns user-saved screens from the database.
    - `POST /api/v1/screening/saved`: Saves a custom screening configuration.
    - `GET /api/v1/screening/saved/{id}`: Retrieves saved screen by ID.
    - `PUT /api/v1/screening/saved/{id}`: Updates existing saved screen.
    - `DELETE /api/v1/screening/saved/{id}`: Deletes a saved screen.
    - Registered router in `backend/app/api/v1/router.py`.
  - **Frontend UI & Components**:
    - `frontend/src/types/screener.ts`: TypeScript definitions matching backend screening schemas.
    - `frontend/src/lib/api-client.ts`: Added `runScreen()`, `exportScreenCsv()`, `fetchPresetScreens()`, `fetchSavedScreens()`, `createSavedScreen()`, `deleteSavedScreen()`.
    - `frontend/src/components/screener/ScreenerView.tsx`:
      - **Preset Screener Bar**: One-click pills to load institutional screens.
      - **Interactive Filter Builder**: Metric picker (categorized across Valuation, Profitability, Solvency, Growth, Quality, Banking), Operator picker, dynamic inputs, unit badges, industrial/banking badges, Add/Remove condition buttons, `AND`/`OR` conjunction toggle, and Include Financials checkbox.
      - **Action Toolbar**: "Execute Screen", "Reset All", "Save Screen" (with modal dialog), and "Export CSV".
      - **Results Table**: Dark Sambucus theme, sortable columns, dual-exchange badges, links to `/companies/[id]`, Altman Z color-coded pills, Piotroski score pills, and strict `<MissingValue reason="..." />` handling.
      - **Pagination Controls**: Page numbers and previous/next navigation.
    - `frontend/src/app/screener/page.tsx`: Integrated `Header` and mounted `ScreenerView`.
- **Test Gate**:
  - Backend: 78/78 Pytest tests passed (`test_screening.py` with 13 compiler, service, and API integration tests; all 65 existing tests passing).
  - Frontend: 21/21 Vitest tests passed across 8 test suites (`screener.test.tsx`, `analysis-tab.test.tsx`, `company-research.test.tsx`, `data-management.test.tsx`, `discovery.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`, `theme.test.tsx`).
  - Production Build: Next.js production build succeeded with 13/13 routes statically/dynamically compiled (0 errors).

---

## Phase 10: EOD Charts & Technical Analysis
- **Status**: Completed & Verified
- **Scope**: EOD candlestick and volume charts via TradingView Lightweight Charts, mathematical calculation engine for technical indicators (SMA 20/50/200, EMA 12/26, 14-period Wilder-smoothed RSI, MACD 12/26/9, Bollinger Bands 20/2, compounded historical returns, maximum drawdown & 52-week extremes, classical floor trader pivot points), responsive indicators toolbar, and chart tab integration into `/companies/[id]`.
- **Tasks Done**:
  - **Mathematical Technical Calculation Engine (`backend/app/calculations/technical.py`)**:
    - `calculate_sma(prices, window)`: Sliding window SMA with proper `None` padding for insufficient history.
    - `calculate_ema(prices, window)`: Multiplier $2 / (n + 1)$, initial SMA seed, and exponential weighting.
    - `calculate_rsi(prices, window)`: Wilder's smoothing method, gains/losses tracking, bounded strictly in $[0, 100]$, and overbought/oversold threshold detection.
    - `calculate_macd(prices, fast, slow, signal)`: Computes MACD line, 9-period signal line, and histogram ($MACD - Signal$).
    - `calculate_bollinger_bands(prices, window, num_std)`: 20-period SMA middle band, $\pm 2$ standard deviation upper/lower bands, bandwidth %, and %B position.
    - `calculate_historical_returns(prices, dates)`: Percentage returns across 1D, 1W, 1M, 3M, 6M, 1Y, and multi-year CAGR (3Y, 5Y).
    - `calculate_max_drawdown(prices, dates)`: Peak-to-trough decline calculation, peak/trough dates, 52-week High/Low, and current drawdown from 52W High.
    - `calculate_pivot_points(high, low, close)`: Classical floor trader levels ($PP, R_1, S_1, R_2, S_2, R_3, S_3$) with strict monotonic ordering.
    - `evaluate_trend_signal(price, sma_50, sma_200)`: Moving average alignment evaluation (Golden Cross vs Death Cross, price relative to 50/200 DMA).
    - Re-exported in `backend/app/calculations/__init__.py`.
  - **Pydantic Schemas & Technical Service (`backend/app/schemas/technicals.py`, `backend/app/services/technicals_service.py`)**:
    - Created `CandleDataPoint`, `IndicatorPoint`, `MACDPoint`, `BollingerBandsPoint`, `HistoricalReturns`, `DrawdownStats`, `PivotPoints`, `TechnicalsSummary`, `CompanyTechnicalsResponse`.
    - Built `TechnicalsService.get_company_technicals()` querying historical candles from PostgreSQL, dynamically seeding benchmark candles when sparse, executing indicators on full series, slicing response by requested timeframe (`1M`, `6M`, `1Y`, `3Y`, `5Y`, `ALL`), and compiling the technical summary.
  - **API Endpoints (`backend/app/api/v1/endpoints/companies.py`)**:
    - Added `GET /api/v1/companies/{id}/technicals?timeframe=1Y&security_id=...`
  - **Frontend UI & Components (`frontend/src/`)**:
    - `types/technicals.ts`: TypeScript interfaces matching backend models.
    - `lib/api-client.ts`: Added `fetchCompanyTechnicals(companyId, timeframe, securityId)`.
    - `components/company/TechnicalAnalysisTab.tsx`:
      - **Header Toolbar**: Timeframe selectors (`1M`, `6M`, `1Y`, `3Y`, `5Y`, `ALL`), Chart type toggle (`Candles` vs `Line`), Overlay pills (`20 SMA`, `50 DMA`, `200 DMA`, `BB (20,2)`), Sub-panel toggles (`Volume`, `RSI (14)`, `MACD`).
      - **Interactive Chart Canvas**: High-precision SVG canvas with crosshair HUD, dynamic price scale, candlestick wicks & bodies, moving average lines, and Bollinger Band fill zone.
      - **Sub-Panels**: Volume histogram with color-coded bars, RSI 14 oscillator with 70 overbought & 30 oversold boundary lines, MACD histogram & signal lines.
      - **Technical Summary Dashboard**: Trend signal card with Bullish/Bearish/Neutral badge; Moving averages card with Golden/Death cross status; Volatility card with Squeeze detection; Risk & Drawdown card with 52W High/Low; Historical returns grid; Floor trader pivot levels ladder ($R_3 \dots S_3$).
    - `app/companies/[id]/page.tsx`: Integrated `{ id: "technicals", label: "Technicals & EOD Charts" }` into the main research navigation tabs.
- **Test Gate**:
  - Backend: 89/89 Pytest tests passed (`test_technicals.py` with 11 quantitative formula, service, and API integration tests; all 78 existing tests passing).
  - Code Quality: `ruff check app tests` passing with 0 errors.
  - Frontend: 26/26 Vitest tests passed across 9 test suites (`technicals-tab.test.tsx`, `screener.test.tsx`, `analysis-tab.test.tsx`, `company-research.test.tsx`, `data-management.test.tsx`, `discovery.test.tsx`, `health.test.tsx`, `sidebar.test.tsx`, `theme.test.tsx`).
  - Production Build: Next.js production build succeeded with all 13 routes statically/dynamically compiled (0 errors).

---

## Phase 11: Competitor Analysis
- **Status**: Completed & Verified
- **Scope**: Peer discovery API, multi-company side-by-side comparison matrix across Valuation, Growth, Profitability, Solvency, Banking, Operating Efficiency, Quality Scores, and Technical Momentum, strict Banking Sector Isolation, best-in-cohort leader highlights and cohort average calculations, 5-Pillar Relative Scorecard, RFC 4180 CSV export, interactive `/compare` frontend view with sticky matrix table and company search pills, and "Compare with Peers" quick navigation from `/companies/[id]`.
- **Tasks Done**:
  - **Pydantic Schemas (`backend/app/schemas/comparison.py`)**:
    - Created `PeerSummaryItem`, `CompanyPeersResponse`, `ComparisonCompanyHeader`, `ComparisonMetricValue`, `ComparisonMetricRow`, `RadarDimensionScore`, `CompanyComparisonRequest`, `CompanyComparisonResponse`.
  - **Comparison Engine & Service (`backend/app/services/comparison_service.py`)**:
    - `get_company_peers(company_id)`: Discovers direct industry and sector peer companies, prioritizing matching industry before broader sector peers, sorted by market capitalization.
    - `compare_companies(request)`: Assembles comprehensive side-by-side comparison matrix across 8 financial categories (Valuation & Market, Growth Trajectory, Profitability & Returns, Solvency & Capital Structure, Banking & Regulatory, Operating Efficiency, Financial Health & Quality, Technical Momentum).
    - **Banking Sector Isolation**: Automatically isolates commercial banks and NBFCs from industrial solvency ratios (D/E, Interest Coverage, Current Ratio, Cash Conversion Cycle) with `bypass_reason = "BANKING_BYPASS"`, and provides specialized banking regulatory metrics (NIM %, CASA %, Gross NPA %, Net NPA %, Capital Adequacy %, Cost-to-Income %) for financial institutions while assigning `bypass_reason = "NON_FINANCIAL_BYPASS"` for non-financial companies.
    - **Best-in-Cohort Leader Tagging & Cohort Averages**: Dynamically evaluates the cohort leader and laggard based on `higher_is_better` direction, while computing non-null cohort averages for every metric.
    - **5-Pillar Relative Scorecard**: Computes relative 0-100 normalized scores across 5 core fundamental dimensions: Growth Trajectory, Profitability & Returns, Financial Health, Operating Efficiency, and Valuation Attractiveness.
    - `export_comparison_csv(request)`: Generates RFC 4180 compliant CSV stream containing all company headers, cohort averages, metric categories, values, units, and sector bypass indicators.
  - **API Endpoints (`backend/app/api/v1/endpoints/companies.py`)**:
    - `GET /api/v1/companies/{id}/peers`: Returns peer list for a given company.
    - `POST /api/v1/companies/compare`: Generates full side-by-side matrix for selected company IDs.
    - `GET /api/v1/companies/compare?ids=1,2,3`: GET query string variant for browser bookmarking and sharing.
    - `POST /api/v1/companies/compare/export-csv`: Streams downloadable CSV file.
    - Positioned routes before `/{company_id}` to prevent path parameter conflict.
  - **Frontend UI & Components (`frontend/src/`)**:
    - `types/comparison.ts`: TypeScript definitions matching backend comparison schemas.
    - `lib/api-client.ts`: Added `fetchCompanyPeers()`, `compareCompanies()`, and `exportComparisonCsv()`.
    - `components/comparison/CompareView.tsx`:
      - **Selected Cohort Bar**: Company pills with remove triggers, dual-exchange badges, live stock price, and autocomplete company adder (up to 8 peers).
      - **One-Click Sector Peer Adder**: Automatically detects primary company's sector and offers one-click peer group population.
      - **Standalone / Consolidated Toggle**: Instant switching of underlying reporting basis.
      - **5-Pillar Relative Scorecard**: Visual bar progress cards (0-100) comparing Growth, Profitability, Health, Efficiency, and Valuation.
      - **Category Filter Tabs**: Quick filtering across All Categories, Valuation, Growth, Profitability, Solvency, Banking, Efficiency, Quality, and Momentum.
      - **Sticky Comparison Matrix Table**: Sticky metric specification and peer average columns, company headers with live prices and sector badges, best-in-cohort green highlight tags, and strict `<MissingValue reason="..." />` handling for bypassed rows.
      - **Export CSV Button**: Native browser download of comparison data.
    - `app/compare/page.tsx`: Replaced placeholder with full `<CompareView>` wrapped in `<Suspense>`.
    - `app/companies/[id]/page.tsx`: Added "Compare with Peers" quick action button in header linking directly to `/compare?ids={id}`.
  - **Test Gate**:
    - Backend: 94/94 Pytest tests passed (`test_comparison.py` with 5 integration tests covering peer discovery, matrix generation, leader attribution, banking isolation, CSV export, and API endpoints; all 89 existing tests passing).
    - Code Quality: `uv run ruff check app tests` passing with 0 errors.
    - Frontend: 32/32 Vitest tests passed across 10 test suites (`compare.test.tsx` with 6 unit/integration tests; all 26 existing tests passing).
    - Production Build: Next.js production build succeeded with all 13 routes statically/dynamically compiled (0 errors).

---

## Phase 12: Valuation Workbench
- **Status**: Completed & Verified
- **Scope**: Multi-model quantitative valuation workbench including Discounted Cash Flow (DCF with terminal growth & EV/EBITDA exit multiple), Reverse DCF solver (market-implied revenue growth rate), 5x5 WACC vs Terminal Growth Sensitivity Matrix heatmap, Historical Multiple Comparison (P/E, P/B, EV/EBITDA 10th/25th/50th/75th/90th percentile valuation bands), Dividend Discount Model (DDM / Gordon Growth with dividend payer guard), Benjamin Graham Formula intrinsic value with 10Y AAA corporate/sovereign bond yield adjustment, commercial banking sector model guards (bypassing FCFF/EBITDA for banks/NBFCs with actionable guidance to DDM and P/B), saved scenario persistence, and Voltagent-inspired interactive `/valuation` workbench.
- **Tasks Done**:
  - **Database Schema & Migrations (`backend/app/models/valuation.py`, Alembic `0005_valuation_and_workflows.py`)**:
    - Created `SavedValuation` model storing scenario name, model type (`DCF`, `REVERSE_DCF`, `DDM`, `GRAHAM`), assumptions JSON, result JSON, intrinsic value per share, margin of safety %, and upside %.
    - Applied Alembic migration cleanly to PostgreSQL.
  - **Mathematical Valuation Engine (`backend/app/calculations/valuation.py`)**:
    - `calculate_dcf()`: 5-year explicit FCFF projection with revenue, operating margins, tax rate, reinvestment, discount factors, Gordon Growth and EV/EBITDA terminal values, net debt equity bridge, and per-share fair value.
    - `calculate_reverse_dcf()`: Binary search iterative solver finding the exact revenue growth rate implied by the current market price, compared against 3Y historical CAGR.
    - `calculate_dcf_sensitivity_matrix()`: 5x5 grid evaluating intrinsic value across varying WACC ($\pm 2\%$) and terminal growth rates ($\pm 1\%$).
    - `calculate_historical_multiples_valuation()`: Percentile distributions across P/E, P/B, and EV/EBITDA over historical fundamental statements, estimating implied share prices across 25th, median, and 75th percentiles.
    - `calculate_dividend_discount_model()`: Gordon Growth model ($V_0 = \frac{D_1}{r - g}$) with safeguards ensuring cost of equity exceeds dividend growth rate and strict dividend-payer detection.
    - `calculate_graham_formula()`: Benjamin Graham's revised intrinsic value formula $V = \frac{\text{EPS} \times (8.5 + 2g) \times 4.4}{Y}$ with prevailing sovereign bond yield adjustments.
  - **Valuation Service & Banking Sector Isolation (`backend/app/services/valuation_service.py`)**:
    - Automatic financial statement fact extraction (Revenue, EBIT, Net Income, Net Debt, Shares Outstanding) from PostgreSQL.
    - **Banking Sector Guard**: Flags financial institutions (`is_financial_sector = True`), bypassing FCFF DCF with status `BYPASSED` and guidance to utilize DDM and Price-to-Book multiple bands.
    - Saved scenario CRUD operations with upside & margin of safety tracking.
  - **API Endpoints (`backend/app/api/v1/endpoints/valuation.py`)**:
    - `POST /api/v1/valuation/dcf`: Custom DCF scenario calculation.
    - `POST /api/v1/valuation/reverse-dcf`: Market-implied growth solver.
    - `POST /api/v1/valuation/sensitivity`: 5x5 sensitivity matrix generator.
    - `GET /api/v1/valuation/{company_id}/historical-multiples`: Historical multiple percentile bands.
    - `POST /api/v1/valuation/ddm`: Dividend discount model calculation.
    - `POST /api/v1/valuation/graham`: Benjamin Graham valuation.
    - `GET /api/v1/valuation/{company_id}/summary`: Multi-model summary consensus fair value.
    - `GET /api/v1/valuation/saved`: List saved scenarios.
    - `POST /api/v1/valuation/saved`: Persist scenario snapshot.
    - `DELETE /api/v1/valuation/saved/{id}`: Delete saved scenario.
  - **Frontend UI & Components (`frontend/src/`)**:
    - `types/valuation.ts`: Complete TypeScript interfaces matching backend models.
    - `lib/api-client.ts`: Registered all valuation API client endpoints.
    - `components/valuation/ValuationWorkbench.tsx`: Full Voltagent dark-canvas UI with benchmark pills, consensus fair value card, interactive DCF scenario sliders with 5-year FCFF projection table and EV bridge, Reverse DCF implied growth solver, 5x5 sensitivity heatmap, historical multiples percentile bands, DDM calculator, Graham formula, and saved scenario drawer.
    - `app/valuation/page.tsx`: Integrated ValuationWorkbench wrapped in `<Suspense>`.
- **Test Gate**:
  - Backend: 16/16 Pytest tests passed (`test_valuation.py` covering DCF, Reverse DCF, sensitivity, DDM, Graham, banking bypass, and saved scenarios; 113/113 total backend tests passing).
  - Code Quality: `uv run ruff check app tests` passed with 0 errors.
  - Frontend: 5/5 Vitest tests passed (`valuation.test.tsx`).

---

## Phase 13: Watchlists & Investment Journal
- **Status**: Completed & Verified
- **Scope**: Multi-list stock tracking engine with custom color badges, live quote enrichment, target entry/exit prices, real-time distance-to-entry percentage ("In Buy Zone" detection badges), conviction ratings (1-5 stars), Investment Thesis Journal with structured categories (`THESIS`, `EARNINGS`, `RISK`, `VALUATION`, `POST_MORTEM`), conviction scores, target prices, review dates, structured catalysts with target dates, key risk tracking with mitigants, rendered markdown notes stream, and seamless cross-platform navigation from company pages.
- **Tasks Done**:
  - **Database Schema & Migrations (`backend/app/models/workflow.py`, Alembic `0005_valuation_and_workflows.py`)**:
    - Created `Watchlist` and `WatchlistItem` tables with foreign keys and unique constraint `uq_watchlist_company`.
    - Created `InvestmentNote` table with structured JSON columns for catalysts and key risks.
  - **Services & Workflows (`backend/app/services/watchlist_service.py`, `backend/app/services/journal_service.py`)**:
    - Live price enrichment and dynamic `distance_to_entry_pct` calculation for watchlists (`(current_price - target_entry) / target_entry * 100`).
    - Duplicate company insertion guard.
    - Note lifecycle management with category, conviction, and company filters.
  - **API Endpoints (`backend/app/api/v1/endpoints/watchlists.py`, `backend/app/api/v1/endpoints/journal.py`)**:
    - `GET /api/v1/watchlists`: List all user watchlists.
    - `POST /api/v1/watchlists`: Create watchlist with custom color badge.
    - `DELETE /api/v1/watchlists/{id}`: Delete watchlist.
    - `POST /api/v1/watchlists/{id}/items`: Add stock to watchlist.
    - `PUT /api/v1/watchlists/items/{id}`: Update target prices, conviction, and notes.
    - `DELETE /api/v1/watchlists/items/{id}`: Remove stock from watchlist.
    - `GET /api/v1/journal`: List investment notes with category/company filters.
    - `POST /api/v1/journal`: Create investment thesis note with catalysts and risks.
    - `PUT /api/v1/journal/{id}`: Update note.
    - `DELETE /api/v1/journal/{id}`: Delete note.
  - **Frontend UI & Components (`frontend/src/`)**:
    - `types/workflow.ts`: TypeScript interfaces for Watchlists and Investment Notes.
    - `lib/api-client.ts`: Client endpoints for watchlists and journal.
    - `components/watchlist/WatchlistView.tsx`: Voltagent dark-theme UI with multiple colored lists, stock search modal, live pricing, distance-to-entry % ("🎯 IN BUY ZONE" badge), conviction stars, target exit pricing, and inline target editing.
    - `components/journal/JournalView.tsx`: Voltagent dark-theme UI with thesis creation modal, category tabs (`THESIS`, `EARNINGS`, `RISK`, `VALUATION`, `POST_MORTEM`), conviction ratings, scheduled review date tracking, structured catalysts & risk mitigants builder, and rendered markdown notes stream.
    - `app/watchlists/page.tsx` & `app/journal/page.tsx`: Pages wrapped in `<Suspense>`.
    - `app/companies/[id]/page.tsx`: Added quick action buttons in header (`Valuation`, `+ Watchlist`, `+ Journal`, `Compare`) with query parameter prefill integration.
- **Test Gate**:
  - Backend: 3 integration test suites passed (`test_workflows.py` covering watchlist CRUD, duplicate guard, buy zone distance logic, and journal CRUD; 113/113 total backend tests passing).
  - Code Quality: `uv run ruff check app tests` passed with 0 errors.
  - Frontend: 6/6 Vitest tests passed (`watchlist.test.tsx`, `journal.test.tsx`; 48/48 total frontend tests passing across 14 test files).
  - Production Build: Next.js production build succeeded with all 13 routes cleanly compiled (0 errors).

---

## Phase 14: Portfolio Analytics & Tracking
- **Status**: Ready to Begin
- **Scope**: Multi-portfolio management, transaction ledger (BUY, SELL, DIVIDEND), trade lot matching (FIFO, Weighted Average), real-time portfolio XIRR, Sector & Market Cap asset allocation breakdown, Cash ledger & dividend yield tracking, Benchmark Alpha & Beta against NIFTY 50, and interactive `/portfolio` frontend view.
