"""Deterministic operating efficiency and working capital calculations."""

from decimal import Decimal


def asset_turnover(
    revenue: float | Decimal | None,
    total_assets: float | Decimal | None,
    prev_assets: float | Decimal | None = None,
) -> float | None:
    """Asset Turnover Ratio.

    Formula: Revenue / Average Total Assets
    """
    if revenue is None or total_assets is None:
        return None

    r = float(revenue)
    curr_a = float(total_assets)
    avg_a = (curr_a + float(prev_assets)) / 2.0 if prev_assets is not None else curr_a

    if avg_a <= 0:
        return None

    return round(r / avg_a, 2)


def debtor_days(
    receivables: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """Debtor Days (Days Sales Outstanding - DSO).

    Formula: (Receivables / Revenue) * 365
    """
    if receivables is None or revenue is None:
        return None

    rec = float(receivables)
    rev = float(revenue)

    if rev <= 0:
        return None

    return round((rec / rev) * 365.0, 1)


def inventory_turnover(
    revenue: float | Decimal | None,
    inventories: float | Decimal | None,
) -> float | None:
    """Inventory Turnover Ratio.

    Formula: Revenue / Inventories
    """
    if revenue is None or inventories is None:
        return None

    r = float(revenue)
    inv = float(inventories)

    if inv <= 0:
        return None

    return round(r / inv, 2)


def inventory_days(
    inventories: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """Inventory Days (Days Inventory Outstanding - DIO).

    Formula: (Inventories / Revenue) * 365
    """
    if inventories is None or revenue is None:
        return None

    inv = float(inventories)
    rev = float(revenue)

    if rev <= 0:
        return None

    return round((inv / rev) * 365.0, 1)


def creditor_days(
    payables: float | Decimal | None,
    operating_expenses: float | Decimal | None,
) -> float | None:
    """Creditor Days (Days Payable Outstanding - DPO).

    Formula: (Trade Payables / Operating Expenses or COGS) * 365
    """
    if payables is None or operating_expenses is None:
        return None

    pay = float(payables)
    exp = float(operating_expenses)

    if exp <= 0:
        return None

    return round((pay / exp) * 365.0, 1)


def cash_conversion_cycle(
    inv_days: float | None,
    deb_days: float | None,
    cred_days: float | None,
) -> float | None:
    """Cash Conversion Cycle (CCC in Days).

    Formula: Inventory Days + Debtor Days - Creditor Days
    """
    if inv_days is None and deb_days is None and cred_days is None:
        return None

    # Handle service companies that have zero/none inventory
    i = inv_days or 0.0
    d = deb_days or 0.0
    c = cred_days or 0.0

    return round(i + d - c, 1)


def working_capital_days(
    working_capital: float | Decimal | None,
    revenue: float | Decimal | None,
) -> float | None:
    """Working Capital Days.

    Formula: (Working Capital / Revenue) * 365
    """
    if working_capital is None or revenue is None:
        return None

    wc = float(working_capital)
    rev = float(revenue)

    if rev <= 0:
        return None

    return round((wc / rev) * 365.0, 1)
