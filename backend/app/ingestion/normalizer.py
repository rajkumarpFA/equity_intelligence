"""Normalization engine for financial metrics, units, periods, and corporate reporting."""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

# Canonical dictionary mapping raw filing labels to standardized metric codes
METRIC_ALIASES: dict[str, str] = {
    # --- Income Statement ---
    "revenue": "REVENUE",
    "revenues": "REVENUE",
    "revenue from operations": "REVENUE",
    "revenue from operations net": "REVENUE",
    "net sales": "REVENUE",
    "sales": "REVENUE",
    "turnover": "REVENUE",
    "income from operations": "REVENUE",
    "gross revenue": "REVENUE",
    
    "other income": "OTHER_INCOME",
    "other operating income": "OTHER_INCOME",
    "non operating income": "OTHER_INCOME",
    
    "total income": "TOTAL_INCOME",
    "total revenue": "TOTAL_INCOME",
    "total revenue from operations": "TOTAL_INCOME",
    
    "operating expenses": "OPERATING_EXPENSES",
    "total expenses": "OPERATING_EXPENSES",
    "raw material cost": "COST_OF_MATERIALS",
    "cost of materials consumed": "COST_OF_MATERIALS",
    "employee benefits expense": "EMPLOYEE_EXPENSE",
    "employee cost": "EMPLOYEE_EXPENSE",
    
    "operating profit": "EBITDA",
    "ebitda": "EBITDA",
    "pbdit": "EBITDA",
    "profit before depreciation interest and tax": "EBITDA",
    
    "depreciation": "DEPRECIATION",
    "depreciation and amortization": "DEPRECIATION",
    "depreciation & amortisation expense": "DEPRECIATION",
    
    "ebit": "EBIT",
    "pbit": "EBIT",
    "profit before interest and tax": "EBIT",
    "operating profit after depreciation": "EBIT",
    
    "finance costs": "FINANCE_COSTS",
    "finance cost": "FINANCE_COSTS",
    "interest expense": "FINANCE_COSTS",
    "interest": "FINANCE_COSTS",
    
    "profit before tax": "PBT",
    "pbt": "PBT",
    "profit before exceptional items and tax": "PBT",
    
    "tax expense": "TAX",
    "tax": "TAX",
    "current tax": "TAX",
    "provision for tax": "TAX",
    
    "profit after tax": "PAT",
    "pat": "PAT",
    "net profit": "PAT",
    "profit for the period": "PAT",
    "net income": "PAT",
    "profit loss for the period": "PAT",
    
    "basic eps": "EPS",
    "eps": "EPS",
    "diluted eps": "EPS_DILUTED",
    "earnings per share": "EPS",

    # --- Balance Sheet ---
    "equity share capital": "EQUITY_CAPITAL",
    "share capital": "EQUITY_CAPITAL",
    "paid up capital": "EQUITY_CAPITAL",
    
    "other equity": "RESERVES",
    "reserves and surplus": "RESERVES",
    "reserves": "RESERVES",
    
    "total equity": "TOTAL_EQUITY",
    "net worth": "TOTAL_EQUITY",
    "shareholders funds": "TOTAL_EQUITY",
    
    "borrowings": "TOTAL_DEBT",
    "total debt": "TOTAL_DEBT",
    "long term borrowings": "LONG_TERM_DEBT",
    "short term borrowings": "SHORT_TERM_DEBT",
    "non current borrowings": "LONG_TERM_DEBT",
    "current borrowings": "SHORT_TERM_DEBT",
    
    "trade payables": "TRADE_PAYABLES",
    "other current liabilities": "OTHER_CURRENT_LIABILITIES",
    "total liabilities": "TOTAL_LIABILITIES",
    
    "property plant and equipment": "FIXED_ASSETS",
    "fixed assets": "FIXED_ASSETS",
    "tangible assets": "FIXED_ASSETS",
    "capital work in progress": "CWIP",
    "cwip": "CWIP",
    
    "non current investments": "NON_CURRENT_INVESTMENTS",
    "investments": "INVESTMENTS",
    "trade receivables": "TRADE_RECEIVABLES",
    "cash and cash equivalents": "CASH_AND_EQUIVALENTS",
    "bank balances": "CASH_AND_EQUIVALENTS",
    "cash and bank balances": "CASH_AND_EQUIVALENTS",
    "total assets": "TOTAL_ASSETS",

    # --- Cash Flow Statement ---
    "net cash flow from operating activities": "OPERATING_CASH_FLOW",
    "cash from operating activities": "OPERATING_CASH_FLOW",
    "cfo": "OPERATING_CASH_FLOW",
    "cash flow from operations": "OPERATING_CASH_FLOW",
    
    "net cash flow from investing activities": "INVESTING_CASH_FLOW",
    "cash from investing activities": "INVESTING_CASH_FLOW",
    "cfi": "INVESTING_CASH_FLOW",
    
    "net cash flow from financing activities": "FINANCING_CASH_FLOW",
    "cash from financing activities": "FINANCING_CASH_FLOW",
    "cff": "FINANCING_CASH_FLOW",
    
    "net cash flow": "NET_CASH_FLOW",
    "free cash flow": "FREE_CASH_FLOW",
    "fcf": "FREE_CASH_FLOW",

    # --- Banking & Financial Sector Specific ---
    "interest earned": "INTEREST_EARNED",
    "interest expended": "INTEREST_EXPENDED",
    "net interest income": "NET_INTEREST_INCOME",
    "nii": "NET_INTEREST_INCOME",
    "non interest income": "NON_INTEREST_INCOME",
    "other income banking": "NON_INTEREST_INCOME",
    "provisions and contingencies": "PROVISIONS",
    "provisions": "PROVISIONS",
    "gross npa": "NPA_GROSS",
    "net npa": "NPA_NET",
    "gross npa pct": "NPA_GROSS_PCT",
    "gross npa percentage": "NPA_GROSS_PCT",
    "net npa pct": "NPA_NET_PCT",
    "net npa percentage": "NPA_NET_PCT",
    "casa pct": "CASA_RATIO",
    "casa ratio": "CASA_RATIO",
    "capital adequacy ratio": "CAR",
    "car": "CAR",
}


def clean_label(label: str) -> str:
    """Normalize raw metric name for dictionary lookup."""
    label = label.lower().strip()
    # Replace percent symbol with pct word to distinguish ratios from absolute figures
    label = label.replace("%", " pct ")
    # Remove currency or unit notations e.g. (in cr), (rs.), (crores)
    label = re.sub(r"\(.*?\)", "", label)
    # Remove special punctuation
    label = re.sub(r"[^\w\s]", " ", label)
    # Collapse multiple whitespace
    label = re.sub(r"\s+", " ", label).strip()
    return label


def normalize_metric_code(raw_label: str) -> str | None:
    """Map a raw filing or CSV metric label to a canonical metric code."""
    cleaned = clean_label(raw_label)
    if cleaned in METRIC_ALIASES:
        return METRIC_ALIASES[cleaned]
    # Check if cleaned is already an exact uppercase canonical code
    code_attempt = raw_label.upper().replace(" ", "_").strip()
    if code_attempt in METRIC_ALIASES.values():
        return code_attempt
    return None


def normalize_unit_and_value(
    raw_value: Any, reported_unit: str, metric_code: str
) -> tuple[Decimal, str]:
    """Convert financial amounts into standard canonical representation.
    
    Standardization rules:
    - Absolute aggregates (Revenue, PAT, Debt, Assets) are standardized to 'CRORES'.
    - Per-share metrics (EPS, Book Value) are standardized to 'INR'.
    - Percentages (Ratios, NPA %, CASA %) are standardized to 'PERCENTAGE'.
    """
    if raw_value is None or raw_value == "":
        raise ValueError("Cannot normalize empty or None value")

    # Clean string value if needed
    if isinstance(raw_value, str):
        cleaned_str = raw_value.replace(",", "").replace(" ", "").replace("%", "")
        # Handle bracketed negative numbers like "(123.45)" -> "-123.45"
        if cleaned_str.startswith("(") and cleaned_str.endswith(")"):
            cleaned_str = "-" + cleaned_str[1:-1]
        try:
            val = Decimal(cleaned_str)
        except InvalidOperation as e:
            raise ValueError(f"Invalid decimal string: {raw_value}") from e
    else:
        val = Decimal(str(raw_value))

    unit_upper = reported_unit.upper().strip()

    # Per-share metrics
    if metric_code in {"EPS", "EPS_DILUTED", "BOOK_VALUE_PER_SHARE", "DIVIDEND_PER_SHARE"}:
        # Value is in INR per share
        return val, "PER_SHARE"

    # Percentage metrics
    if metric_code in {"NPA_GROSS_PCT", "NPA_NET_PCT", "CASA_RATIO", "CAR", "PROMOTER_PCT"}:
        return val, "PERCENTAGE"

    # Standardize all corporate aggregate numbers to CRORES
    if unit_upper in {"CRORES", "CR", "CRORE"}:
        return val, "CRORES"
    elif unit_upper in {"LAKHS", "LAKH", "LACS", "LAC"}:
        # 100 Lakhs = 1 Crore
        return val / Decimal(100), "CRORES"
    elif unit_upper in {"MILLIONS", "MN", "MILLION"}:
        # 10 Million = 1 Crore
        return val / Decimal(10), "CRORES"
    elif unit_upper in {"BILLIONS", "BN", "BILLION"}:
        # 1 Billion = 100 Crores
        return val * Decimal(100), "CRORES"
    elif unit_upper in {"INR", "RUPEES", "RS", "UNITS", "EXACT"}:
        # 1 Crore = 10,000,000 INR
        return val / Decimal(10000000), "CRORES"
    else:
        # Default assume reported unit
        return val, unit_upper


def parse_period_date(date_str: str) -> date:
    """Parse various date formats into a standard date object."""
    date_str = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%b %Y",
        "%B %Y",
        "%d %b %Y",
        "%d %B %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format: '{date_str}'")


def determine_fiscal_period(
    period_end: date,
) -> tuple[int, int | None, str]:
    """Given a period end date, determine fiscal year, quarter, and period type for Indian companies.
    
    Indian fiscal year: April 1 to March 31.
    - Q1: June 30 -> FY = Year + 1
    - Q2: Sept 30 -> FY = Year + 1
    - Q3: Dec 31  -> FY = Year + 1
    - Q4: March 31 -> FY = Year (Annual FY end)
    """
    month = period_end.month
    year = period_end.year

    if month in (4, 5, 6):
        return year + 1, 1, "QUARTERLY"
    elif month in (7, 8, 9):
        return year + 1, 2, "QUARTERLY"
    elif month in (10, 11, 12):
        return year + 1, 3, "QUARTERLY"
    elif month in (1, 2, 3):
        return year, 4, "QUARTERLY"
    else:
        return year, None, "ANNUAL"


# Standard Financial Metrics Seed List
STANDARD_FINANCIAL_METRICS: list[dict[str, Any]] = [
    # Income Statement
    {"code": "REVENUE", "name": "Revenue from Operations", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Core operational revenue / net sales"},
    {"code": "OTHER_INCOME", "name": "Other Income", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Non-operating income"},
    {"code": "TOTAL_INCOME", "name": "Total Income", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Sum of operational revenue and other income"},
    {"code": "OPERATING_EXPENSES", "name": "Operating Expenses", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Total operational expenses excluding depreciation and finance costs"},
    {"code": "EBITDA", "name": "Operating Profit (EBITDA)", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Earnings Before Interest, Taxes, Depreciation, and Amortization"},
    {"code": "DEPRECIATION", "name": "Depreciation and Amortization", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Depreciation on fixed assets and amortization of intangibles"},
    {"code": "EBIT", "name": "Operating Profit after Depreciation (EBIT)", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Earnings Before Interest and Taxes"},
    {"code": "FINANCE_COSTS", "name": "Finance Costs", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Interest and debt servicing expenses"},
    {"code": "PBT", "name": "Profit Before Tax", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Earnings before direct tax provisions"},
    {"code": "TAX", "name": "Tax Expense", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Current and deferred tax provisions"},
    {"code": "PAT", "name": "Profit After Tax (Net Profit)", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Bottom-line net profit attributable to shareholders"},
    {"code": "EPS", "name": "Basic Earnings Per Share", "category": "INCOME_STATEMENT", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Net profit divided by weighted average number of equity shares"},

    # Balance Sheet
    {"code": "EQUITY_CAPITAL", "name": "Equity Share Capital", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Nominal value of issued equity shares"},
    {"code": "RESERVES", "name": "Reserves and Surplus", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Retained earnings and other equity reserves"},
    {"code": "TOTAL_EQUITY", "name": "Total Shareholders Equity", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Net worth (Share capital + Reserves)"},
    {"code": "TOTAL_DEBT", "name": "Total Borrowings", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Sum of short-term and long-term interest-bearing debt"},
    {"code": "TOTAL_LIABILITIES", "name": "Total Equity & Liabilities", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "CREDIT", "description": "Total balance sheet liabilities and equity"},
    {"code": "FIXED_ASSETS", "name": "Property, Plant & Equipment", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Net tangible fixed assets"},
    {"code": "CWIP", "name": "Capital Work in Progress", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Capital expenditure under deployment"},
    {"code": "INVESTMENTS", "name": "Investments", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Non-current and current financial investments"},
    {"code": "CASH_AND_EQUIVALENTS", "name": "Cash and Cash Equivalents", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Liquid cash and bank balances"},
    {"code": "TOTAL_ASSETS", "name": "Total Assets", "category": "BALANCE_SHEET", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Total balance sheet assets"},

    # Cash Flow
    {"code": "OPERATING_CASH_FLOW", "name": "Cash Flow from Operations", "category": "CASH_FLOW", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Net cash generated from operating activities"},
    {"code": "INVESTING_CASH_FLOW", "name": "Cash Flow from Investing", "category": "CASH_FLOW", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Net cash used in or generated from capex and investments"},
    {"code": "FINANCING_CASH_FLOW", "name": "Cash Flow from Financing", "category": "CASH_FLOW", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Net cash used in dividends, debt repayment, or equity issuance"},
    {"code": "FREE_CASH_FLOW", "name": "Free Cash Flow", "category": "CASH_FLOW", "is_banking_specific": False, "normal_balance": "DEBIT", "description": "Operating Cash Flow minus Capital Expenditures"},

    # Banking / Financial Sector Specific
    {"code": "INTEREST_EARNED", "name": "Interest Earned", "category": "BANKING_INCOME", "is_banking_specific": True, "normal_balance": "CREDIT", "description": "Interest income on advances and investments"},
    {"code": "INTEREST_EXPENDED", "name": "Interest Expended", "category": "BANKING_INCOME", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Interest paid on deposits and borrowings"},
    {"code": "NET_INTEREST_INCOME", "name": "Net Interest Income (NII)", "category": "BANKING_INCOME", "is_banking_specific": True, "normal_balance": "CREDIT", "description": "Interest earned minus interest expended"},
    {"code": "PROVISIONS", "name": "Provisions & Contingencies", "category": "BANKING_INCOME", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Loan-loss provisions and contingency reserves"},
    {"code": "NPA_GROSS", "name": "Gross Non-Performing Assets", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Total bad loans before provisions"},
    {"code": "NPA_NET", "name": "Net Non-Performing Assets", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Bad loans net of provision reserves"},
    {"code": "NPA_GROSS_PCT", "name": "Gross NPA %", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Gross NPA as percentage of gross advances"},
    {"code": "NPA_NET_PCT", "name": "Net NPA %", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "DEBIT", "description": "Net NPA as percentage of net advances"},
    {"code": "CASA_RATIO", "name": "CASA Ratio (%)", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "CREDIT", "description": "Current Account and Savings Account deposits as % of total deposits"},
    {"code": "CAR", "name": "Capital Adequacy Ratio (CAR %)", "category": "BANKING_BALANCE_SHEET", "is_banking_specific": True, "normal_balance": "CREDIT", "description": "Regulatory capital as percentage of risk-weighted assets"},
]
