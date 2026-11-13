"""Institutional preset screens for the equity screening engine."""

from typing import Any

PRESET_SCREENS: list[dict[str, Any]] = [
    {
        "id": 1001,
        "name": "Buffett Moats",
        "description": "High return on capital (ROCE/ROE > 18%), sustained 3-year revenue growth (> 10%), and conservative balance sheet leverage (D/E <= 0.5x).",
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "roce", "operator": ">=", "value": 18.0},
                {"field": "roe", "operator": ">=", "value": 18.0},
                {"field": "debt_to_equity", "operator": "<=", "value": 0.5},
                {"field": "revenue_cagr_3y", "operator": ">=", "value": 10.0},
            ],
        },
        "sort_by": "roce",
        "sort_direction": "desc",
        "is_preset": True,
    },
    {
        "id": 1002,
        "name": "High Growth Compounders",
        "description": "Consistent double-digit compounding across revenue and net profits (> 15% 3Y CAGR) with high operating capital return (> 15% ROCE).",
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "revenue_cagr_3y", "operator": ">=", "value": 15.0},
                {"field": "pat_cagr_3y", "operator": ">=", "value": 15.0},
                {"field": "roce", "operator": ">=", "value": 15.0},
            ],
        },
        "sort_by": "revenue_cagr_3y",
        "sort_direction": "desc",
        "is_preset": True,
    },
    {
        "id": 1003,
        "name": "Low Debt Cannibals",
        "description": "Virtually debt-free companies (D/E <= 0.20x) with massive interest coverage (> 8.0x) and strong net profit margins (> 8%).",
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "debt_to_equity", "operator": "<=", "value": 0.20},
                {"field": "interest_coverage", "operator": ">=", "value": 8.0},
                {"field": "net_margin", "operator": ">=", "value": 8.0},
            ],
        },
        "sort_by": "interest_coverage",
        "sort_direction": "desc",
        "is_preset": True,
    },
    {
        "id": 1004,
        "name": "Value Dividend Kings",
        "description": "Prudently priced equities (P/E <= 25x) generating strong returns on capital (ROCE >= 15%) without balance sheet distress.",
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "pe", "operator": "<=", "value": 25.0},
                {"field": "roce", "operator": ">=", "value": 15.0},
                {"field": "debt_to_equity", "operator": "<=", "value": 0.50},
            ],
        },
        "sort_by": "pe",
        "sort_direction": "asc",
        "is_preset": True,
    },
    {
        "id": 1005,
        "name": "Institutional Financial Titans",
        "description": "Leading banking & financial institutions generating superior return on equity (ROE >= 12%) with sound capital adequacy.",
        "filter_expression": {
            "conjunction": "AND",
            "conditions": [
                {"field": "is_financial_sector", "operator": "==", "value": True},
                {"field": "roe", "operator": ">=", "value": 12.0},
            ],
        },
        "sort_by": "roe",
        "sort_direction": "desc",
        "is_preset": True,
    },
]
