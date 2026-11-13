"""Official Exchange (NSE/BSE) public disclosures and CSV/filing adapter."""

import csv
import io
import logging
from datetime import date
from decimal import Decimal

from app.providers.interfaces.base import BaseDataProvider
from app.providers.interfaces.models import (
    ProviderCandle,
    ProviderCompanyProfile,
    ProviderCorporateAction,
    ProviderFact,
    ProviderFinancialStatement,
    ProviderInstrument,
    ProviderShareholding,
)

logger = logging.getLogger("app.providers.exchange")


class OfficialExchangeProvider(BaseDataProvider):
    """Adapter for official NSE & BSE exchange disclosures, bhavcopy price files, and CSV datasets."""

    @property
    def provider_name(self) -> str:
        return "official_exchange"

    def is_configured(self) -> bool:
        # Official exchange/local filing adapter requires no paid API keys
        return True

    async def get_instrument_master(self, exchange: str = "NSE") -> list[ProviderInstrument]:
        """Parse official exchange equity master list."""
        return []

    async def get_company_profile(
        self, isin: str, symbol: str | None = None
    ) -> ProviderCompanyProfile | None:
        return None

    async def get_historical_candles(
        self,
        symbol: str,
        exchange: str = "NSE",
        from_date: date | None = None,
        to_date: date | None = None,
        provider_instrument_key: str | None = None,
    ) -> list[ProviderCandle]:
        return []

    async def get_financial_statements(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderFinancialStatement]:
        return []

    async def get_shareholding(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderShareholding]:
        return []

    async def get_corporate_actions(
        self,
        isin: str,
        symbol: str | None = None,
    ) -> list[ProviderCorporateAction]:
        return []

    def parse_financial_statements_csv(
        self,
        csv_content: str,
        statement_type: str = "INCOME_STATEMENT",
        reporting_basis: str = "CONSOLIDATED",
    ) -> list[ProviderFinancialStatement]:
        """Parse structured tabular CSV containing financial statement metrics across multiple periods."""
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)
        if len(rows) < 2:
            return []

        # Header row contains period dates: Metric, 2024-03-31, 2023-03-31, ...
        header = rows[0]
        period_dates: list[date] = []
        date_indices: list[int] = []

        for idx, col in enumerate(header[1:], start=1):
            col_clean = col.strip()
            try:
                p_date = date.fromisoformat(col_clean)
                period_dates.append(p_date)
                date_indices.append(idx)
            except ValueError:
                continue

        if not period_dates:
            return []

        # Create empty statement container for each period
        statements: dict[date, ProviderFinancialStatement] = {
            p_date: ProviderFinancialStatement(
                statement_type=statement_type,  # type: ignore
                reporting_basis=reporting_basis,  # type: ignore
                period_type="ANNUAL",
                period_end=p_date,
                facts=[],
            )
            for p_date in period_dates
        }

        # Parse metrics
        for row in rows[1:]:
            if not row or not row[0].strip():
                continue
            metric_name = row[0].strip()
            metric_code = metric_name.upper().replace(" ", "_").replace("/", "_")

            for p_date, col_idx in zip(period_dates, date_indices, strict=False):
                if col_idx < len(row):
                    val_str = row[col_idx].strip().replace(",", "")
                    if val_str and val_str not in ("-", "NA", "N/A", "null"):
                        try:
                            val_dec = Decimal(val_str)
                            statements[p_date].facts.append(
                                ProviderFact(
                                    metric_name=metric_name,
                                    metric_code=metric_code,
                                    value=val_dec,
                                    raw_value=val_str,
                                    unit="CRORES",
                                    currency="INR",
                                )
                            )
                        except (ValueError, ArithmeticError):
                            logger.debug(
                                "Skipping unparseable metric value '%s' for %s",
                                val_str,
                                metric_name,
                            )
                            continue

        return list(statements.values())

    def parse_eod_bhavcopy_csv(self, csv_content: str, target_symbol: str) -> list[ProviderCandle]:
        """Parse official NSE bhavcopy CSV for a specific target symbol."""
        reader = csv.DictReader(io.StringIO(csv_content))
        candles: list[ProviderCandle] = []

        for row in reader:
            sym = (row.get("SYMBOL") or row.get("TckrSymb") or "").strip().upper()
            series = (row.get("SERIES") or row.get("SctySrs") or "").strip().upper()

            if sym == target_symbol.upper() and series in ("EQ", ""):
                dt_str = row.get("TIMESTAMP") or row.get("TradDt") or ""
                try:
                    # Parse standard formats e.g. "2024-03-28" or "28-MAR-2024"
                    t_date = date.fromisoformat(dt_str)
                except ValueError:
                    continue

                candles.append(
                    ProviderCandle(
                        trade_date=t_date,
                        open=Decimal(str(row.get("OPEN") or row.get("OpnPric") or 0)),
                        high=Decimal(str(row.get("HIGH") or row.get("HghPric") or 0)),
                        low=Decimal(str(row.get("LOW") or row.get("LwPric") or 0)),
                        close=Decimal(str(row.get("CLOSE") or row.get("ClsPric") or 0)),
                        volume=int(row.get("TOTTRDQTY") or row.get("TtlTradgVol") or 0),
                        adj_close=Decimal(str(row.get("CLOSE") or row.get("ClsPric") or 0)),
                    )
                )

        candles.sort(key=lambda c: c.trade_date)
        return candles
