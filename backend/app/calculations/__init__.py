"""Calculation engine package: deterministic financial ratio and scoring modules."""

from app.calculations.growth import calculate_cagr, calculate_yoy_growth
from app.calculations.profitability import (
    dupont_analysis,
    ebitda_margin,
    net_profit_margin,
    operating_margin,
    return_on_assets,
    return_on_capital_employed,
    return_on_equity,
)
from app.calculations.solvency import (
    current_ratio,
    debt_to_assets,
    debt_to_equity,
    interest_coverage,
    quick_ratio,
)
from app.calculations.efficiency import (
    asset_turnover,
    cash_conversion_cycle,
    creditor_days,
    debtor_days,
    inventory_days,
    inventory_turnover,
    working_capital_days,
)
from app.calculations.scores import (
    calculate_altman_z_score,
    calculate_piotroski_f_score,
)
from app.calculations.banking import (
    capital_adequacy_ratio,
    casa_ratio,
    cost_to_income_ratio,
    net_interest_margin,
    npa_pct,
)
from app.calculations.technical import (
    calculate_bollinger_bands,
    calculate_ema,
    calculate_historical_returns,
    calculate_macd,
    calculate_max_drawdown,
    calculate_pivot_points,
    calculate_rsi,
    calculate_sma,
    evaluate_trend_signal,
)

__all__ = [
    "calculate_cagr",
    "calculate_yoy_growth",
    "operating_margin",
    "ebitda_margin",
    "net_profit_margin",
    "return_on_equity",
    "return_on_capital_employed",
    "return_on_assets",
    "dupont_analysis",
    "debt_to_equity",
    "interest_coverage",
    "current_ratio",
    "quick_ratio",
    "debt_to_assets",
    "asset_turnover",
    "debtor_days",
    "inventory_days",
    "creditor_days",
    "cash_conversion_cycle",
    "working_capital_days",
    "inventory_turnover",
    "calculate_altman_z_score",
    "calculate_piotroski_f_score",
    "net_interest_margin",
    "cost_to_income_ratio",
    "casa_ratio",
    "npa_pct",
    "capital_adequacy_ratio",
    "calculate_sma",
    "calculate_ema",
    "calculate_rsi",
    "calculate_macd",
    "calculate_bollinger_bands",
    "calculate_historical_returns",
    "calculate_max_drawdown",
    "calculate_pivot_points",
    "evaluate_trend_signal",
]
