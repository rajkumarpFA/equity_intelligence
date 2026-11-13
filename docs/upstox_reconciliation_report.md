# Upstox Reconciliation Report

## Reconciliation against Official Exchange Filings (NSE / BSE)

This report evaluates how Upstox data reconciles with official exchange filings across key financial metrics.

### Reconciliation Checklist

| Validation Test | Expected Behavior | Upstox Behavior | System Mitigation |
| :--- | :--- | :--- | :--- |
| **ISIN Matching** | Exact 12-char matching across NSE & BSE | Verified in instrument master | ISIN used as primary canonical anchor |
| **Shareholding Patterns** | Promoter, FII, DII, Public sum to 100% | Third-party aggregated | Data Integrity Engine checks sum == 100% |
| **Corporate Action Ex-Dates** | Exact match with exchange notices | High accuracy on splits/dividends | Reconciled against official notices |
| **Historical Statement Restatements** | Preserve prior reported vs restated values | Restatements frequently overwrite prior data | Alembic schema versions statements via `supersedes_statement_id` |
| **Banking Metrics (NII, GNPA, NNPA)** | Present for banking equities | Often absent in standard multi-sector APIs | Custom financial sector facts supported in canonical schema |
