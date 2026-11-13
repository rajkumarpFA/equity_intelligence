# Upstox Integration Decision

## Final Architectural Decision: **CONDITIONAL GO**

### 1. Key Finding: Upstox Analytics Token Support
The **Upstox Analytics Token** is a major operational advantage for Equity Intelligence:
- **1-Year Validity**: Unlike standard trading tokens that expire every 24 hours, the Analytics Token is valid for **365 days** without requiring daily login or OAuth redirects.
- **Strictly Read-Only**: Eliminates all risk of accidental live order placement, aligning directly with our product vision as an independent personal research platform.
- **No Static IP Required for Research Data**: Market quotes, historical daily candles, option chains, fundamentals, FII/DII flow, and news endpoints are completely open without IP whitelisting.

### 2. Decision Rationale
- **Primary Market Data Source**: With a valid 1-year Analytics Token (`UPSTOX_ANALYTICS_TOKEN`), Upstox provides reliable, unattended historical EOD price candles and instrument discovery for 365 days.
- **Independent Fallback Preserved**: Even with an Analytics Token, official exchange filings and local CSV/PDF ingestion remain the definitive foundation for deep fundamental statements and restatements.
- **Zero Hard Dependency**: The application starts and runs cleanly with or without the token.
