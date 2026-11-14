# Calculations Engine

## Overview
Deterministic financial ratio, scoring, technical indicator, and valuation model functions for Indian equities. All routines are strictly pure mathematical calculation functions decoupled from database models and network I/O.

## Interface
- **Banking Ratios** (`banking.py`): `capital_adequacy_ratio`, `casa_ratio`, `cost_to_income_ratio`, `net_interest_margin`, `npa_pct`
- **Operating Efficiency** (`efficiency.py`): `asset_turnover`, `inventory_turnover`, `inventory_days`, `debtor_days`, `creditor_days`, `working_capital_days`, `cash_conversion_cycle`
- **Growth Analysis** (`growth.py`): `calculate_cagr`, `calculate_yoy_growth`
- **Profitability & DuPont** (`profitability.py`): `operating_margin`, `net_profit_margin`, `ebitda_margin`, `return_on_equity`, `return_on_assets`, `return_on_capital_employed`, `dupont_analysis`
- **Quality & Solvency Scores** (`scores.py`): `calculate_piotroski_f_score`, `calculate_altman_z_score`
- **Solvency & Liquidity** (`solvency.py`): `current_ratio`, `quick_ratio`, `debt_to_equity`, `debt_to_assets`, `interest_coverage`
- **Technicals & Momentum** (`technical.py`): `calculate_sma`, `calculate_ema`, `calculate_rsi`, `calculate_macd`, `calculate_bollinger_bands`, `calculate_pivot_points`, `calculate_max_drawdown`, `calculate_historical_returns`, `evaluate_trend_signal`
- **Intrinsic Valuation Models** (`valuation.py`): `calculate_dcf`, `calculate_reverse_dcf`, `calculate_dcf_sensitivity_matrix`, `calculate_graham_formula`, `calculate_dividend_discount_model`, `calculate_historical_multiples_valuation`

## Invariants
- **Deterministic Pure Functions**: Every calculation function takes raw primitive or decimal numbers and returns float/None results with zero external dependencies.
- **Zero-Division Protection**: Every division must guard against `denominator == 0` and return `None` or an explicit fallback rather than throwing runtime `ZeroDivisionError`.
- **Financial Sector Isolation**: Industrial metrics (e.g. EBITDA, Current Ratio, Inventory Days) are explicitly bypassed or marked non-applicable for commercial banks (`is_financial_sector=True`).

## Side Effects
- None. Calculation functions do not mutate input structures, perform I/O, or interact with databases.

## Verification
- Run: `cd backend && uv run pytest tests/test_valuation.py tests/test_technicals.py tests/test_analysis.py`
