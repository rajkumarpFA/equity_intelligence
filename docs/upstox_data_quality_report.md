# Upstox Data Quality Report

## Data Quality Criteria & Integrity Analysis

### 1. Standalone vs Consolidated Segregation
- **Risk Identified**: Many market data APIs conflate standalone (parent entity only) and consolidated (subsidiary-inclusive) financials or silently drop restated quarters.
- **Upstox Assessment**: Upstox API v2 returns consolidated summaries for large caps, but historical restatement annotations and standalone disclosures for capital allocation analysis are incomplete.
- **Architectural Safeguard**: Equity Intelligence isolates `reporting_basis` (`STANDALONE` vs `CONSOLIDATED`) at the database constraint level.

### 2. Financial Sector vs Industrial Company Accounting
- **Observation on HDFC Bank (`INE040A01034`)**: Generic industrial fields (EBITDA, Operating Profit, Inventory Turnover, Current Ratio) are meaningless or misleading for commercial banks and NBFCs.
- **Requirement**: The system must enforce `is_financial_sector=True` and reject blind generic calculations.

### 3. Missing Value Propagation
- **Rule**: Never replace missing metrics with zero. Missing data must be explicitly represented as `NULL` / `N/A` with an audit reason tag.

### 4. Price & Corporate Action Adjustments
- Splits, bonuses, and dividend adjustments must be stored alongside unadjusted raw prices to prevent false drawdown artifacts.
