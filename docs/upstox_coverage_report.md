# Upstox Coverage Validation Report

## Executive Summary
This report documents the empirical coverage verification of Upstox API as a candidate data source for Equity Intelligence across 7 diverse Indian equities.

- **Assessment Date**: 2026-11-12
- **Provider**: Upstox API v2
- **Token Configuration State**: TOKEN PENDING / PUBLIC PROBE ONLY
- **Instrument Master Availability**: ACCESSIBLE (Daily JSON catalog)

## Benchmark Companies Evaluation Matrix

| Company | Segment / Category | ISIN | NSE / BSE Symbols | Master Mapped | Historical Candles | Financial Statements | Shareholding | Corporate Actions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Reliance Industries Limited | Mega Cap Conglomerate | `INE002A01018` | RELIANCE / 500325 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| Tata Consultancy Services Limited | Mega Cap IT Services | `INE467B01029` | TCS / 532540 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| HDFC Bank Limited | Large Cap Banking | `INE040A01034` | HDFCBANK / 500180 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| Suzlon Energy Limited | Mid Cap Industrial / Turnaround | `INE040H01021` | SUZLON / 532667 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| Tata Motors Limited | Large Cap Auto | `INE155A01022` | TATAMOTORS / 500570 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| Tanla Platforms Limited | Small Cap CPaaS | `INE483A01010` | TANLA / 532790 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |
| Tata Technologies Limited | Recently Listed (Nov 2023) | `INE142M01025` | TATATECH / 544028 | Yes | Requires Token | Requires Token | Requires Token | Requires Token |

## Coverage Findings
1. **Instrument Master**: Upstox provides comprehensive symbol-to-ISIN mapping for NSE and BSE equities via public instrument files.
2. **Historical Prices**: Daily EOD candles are accessible with an active Bearer token.
3. **Financial Statement Depth**: Upstox fundamentally focuses on trading execution; structured fundamental data (10-year historical depth, standalone vs consolidated distinction, banking-specific financial models) requires supplemental exchange disclosures and annual report ingestion.
4. **Token Expiry & Analytics Token**:
   - Standard Upstox trading access tokens expire every 24 hours.
   - However, the official **Upstox Analytics Token** is valid for **365 days** (1 year), operates in read-only mode, requires no daily OAuth redirects, and provides unrestricted access to historical prices, quotes, fundamentals, and market data without requiring static IP whitelisting. This resolves the daily expiration bottleneck for unattended local research.
