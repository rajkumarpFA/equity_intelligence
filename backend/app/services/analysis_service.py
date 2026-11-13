"""Financial analysis service orchestrating deterministic ratio and quality score calculations."""

import logging
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calculations.banking import (
    capital_adequacy_ratio,
    casa_ratio,
    cost_to_income_ratio,
    net_interest_margin,
    npa_pct,
)
from app.calculations.efficiency import (
    asset_turnover,
    cash_conversion_cycle,
    creditor_days,
    debtor_days,
    inventory_days,
    working_capital_days,
)
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
from app.calculations.scores import (
    calculate_altman_z_score,
    calculate_piotroski_f_score,
)
from app.calculations.solvency import (
    current_ratio,
    debt_to_assets,
    debt_to_equity,
    interest_coverage,
    quick_ratio,
)
from app.models.company import Company
from app.models.financials import FinancialFact, FinancialMetric, FinancialStatement
from app.schemas.analysis import (
    AltmanZScoreDetail,
    BankingRatios,
    CompanyRatiosResponse,
    DuPontDecomposition,
    GrowthRatios,
    HistoricalRatioPeriod,
    OperatingEfficiencyRatios,
    PiotroskiFScoreDetail,
    ProfitabilityRatios,
    QualityScoresResponse,
    SolvencyRatios,
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """Service orchestrating financial calculations, DuPont analysis, and quality scores."""

    def __init__(self, db: Session):
        self.db = db

    def get_company_ratios(
        self, company_id: int, reporting_basis: str = "CONSOLIDATED"
    ) -> CompanyRatiosResponse:
        """Calculate and return full suite of financial ratios for a company."""
        company = self.db.get(Company, company_id)
        if not company:
            raise ValueError(f"Company ID #{company_id} not found")

        primary_sec = next((s for s in company.securities if s.is_primary), None)
        if not primary_sec and company.securities:
            primary_sec = company.securities[0]
        symbol = primary_sec.symbol if primary_sec else company.name

        # Query annual statements
        basis_clean = reporting_basis.upper().strip()
        stmts_query = (
            select(FinancialStatement)
            .where(
                FinancialStatement.company_id == company_id,
                FinancialStatement.period_type == "ANNUAL",
                FinancialStatement.reporting_basis == basis_clean,
            )
            .order_by(FinancialStatement.period_end.asc())
        )
        statements = list(self.db.scalars(stmts_query).all())

        # Fallback to STANDALONE if no CONSOLIDATED statements exist
        if not statements and basis_clean == "CONSOLIDATED":
            basis_clean = "STANDALONE"
            stmts_query = (
                select(FinancialStatement)
                .where(
                    FinancialStatement.company_id == company_id,
                    FinancialStatement.period_type == "ANNUAL",
                    FinancialStatement.reporting_basis == "STANDALONE",
                )
                .order_by(FinancialStatement.period_end.asc())
            )
            statements = list(self.db.scalars(stmts_query).all())

        if not statements:
            # Return empty response if no statements found
            return CompanyRatiosResponse(
                company_id=company.id,
                company_name=company.name,
                symbol=symbol,
                is_financial_sector=company.is_financial_sector,
                reporting_basis=basis_clean,
                latest_period_label="N/A",
                growth=GrowthRatios(),
                profitability=ProfitabilityRatios(),
                solvency=SolvencyRatios(
                    is_applicable=not company.is_financial_sector,
                    bypass_reason="No financial statement data available",
                ),
                efficiency=OperatingEfficiencyRatios(
                    is_applicable=not company.is_financial_sector,
                    bypass_reason="No financial statement data available",
                ),
                banking=BankingRatios(is_applicable=company.is_financial_sector),
                historical_trend=[],
            )

        # Collect unique periods sorted chronologically
        unique_periods = sorted(list({s.period_end for s in statements}))
        stmt_to_period = {s.id: s.period_end for s in statements}
        period_meta: dict[Any, FinancialStatement] = {}
        for s in statements:
            period_meta[s.period_end] = s

        # Pre-load all metrics & facts for these statements
        stmt_ids = [s.id for s in statements]
        facts_query = (
            select(FinancialFact)
            .join(FinancialMetric, FinancialFact.metric_id == FinancialMetric.id)
            .where(FinancialFact.statement_id.in_(stmt_ids))
        )
        facts = list(self.db.scalars(facts_query).all())

        # Build map: facts_by_period[period_end][metric_code] = Decimal value
        # Consolidates Income Statement, Balance Sheet, and Cash Flow metrics per fiscal year
        facts_by_period: dict[Any, dict[str, Decimal]] = {p: {} for p in unique_periods}
        for f in facts:
            p_end = stmt_to_period.get(f.statement_id)
            if p_end and f.metric and f.value is not None:
                facts_by_period[p_end][f.metric.code] = f.value

        latest_p = unique_periods[-1]
        latest_stmt = period_meta[latest_p]
        latest_facts = facts_by_period[latest_p]

        prev_p = unique_periods[-2] if len(unique_periods) >= 2 else None
        prev_facts = facts_by_period[prev_p] if prev_p else {}

        # 1. GROWTH RATIOS
        growth = self._compute_growth_ratios(unique_periods, facts_by_period)

        # 2. PROFITABILITY & DUPONT
        profitability = self._compute_profitability(latest_facts, prev_facts)

        # 3. SOLVENCY & EFFICIENCY (Industrial vs Banking)
        if company.is_financial_sector:
            solvency = SolvencyRatios(
                is_applicable=False,
                bypass_reason="Standard solvency and D/E ratios are bypassed for financial institutions because customer deposits are operating liabilities.",
            )
            efficiency = OperatingEfficiencyRatios(
                is_applicable=False,
                bypass_reason="Working capital days and inventory turnover are not applicable to banking institutions.",
            )
            banking = self._compute_banking_ratios(latest_facts)
        else:
            solvency = self._compute_solvency_ratios(latest_facts)
            efficiency = self._compute_efficiency_ratios(latest_facts, prev_facts)
            banking = BankingRatios(is_applicable=False)

        # 4. HISTORICAL TREND (Ratios per year)
        historical_trend = self._compute_historical_trend(
            unique_periods, period_meta, facts_by_period, company.is_financial_sector
        )

        display_label = (
            f"FY{latest_stmt.fiscal_year}"
            if latest_stmt.fiscal_year
            else latest_stmt.period_end.strftime("%Y")
        )

        return CompanyRatiosResponse(
            company_id=company.id,
            company_name=company.name,
            symbol=symbol,
            is_financial_sector=company.is_financial_sector,
            reporting_basis=basis_clean,
            latest_period_label=display_label,
            growth=growth,
            profitability=profitability,
            solvency=solvency,
            efficiency=efficiency,
            banking=banking,
            historical_trend=historical_trend,
        )

    def get_company_quality_scores(
        self, company_id: int, reporting_basis: str = "CONSOLIDATED"
    ) -> QualityScoresResponse:
        """Calculate Altman Z-Score and 9-factor Piotroski F-Score."""
        company = self.db.get(Company, company_id)
        if not company:
            raise ValueError(f"Company ID #{company_id} not found")

        primary_sec = next((s for s in company.securities if s.is_primary), None)
        if not primary_sec and company.securities:
            primary_sec = company.securities[0]
        symbol = primary_sec.symbol if primary_sec else company.name

        basis_clean = reporting_basis.upper().strip()
        stmts_query = (
            select(FinancialStatement)
            .where(
                FinancialStatement.company_id == company_id,
                FinancialStatement.period_type == "ANNUAL",
                FinancialStatement.reporting_basis.in_([basis_clean, "STANDALONE"]),
            )
            .order_by(FinancialStatement.period_end.asc())
        )
        statements = list(self.db.scalars(stmts_query).all())

        if not statements:
            return QualityScoresResponse(
                company_id=company.id,
                company_name=company.name,
                symbol=symbol,
                is_financial_sector=company.is_financial_sector,
                period_label="N/A",
                altman_z=AltmanZScoreDetail(
                    zone="UNAVAILABLE",
                    model="N/A",
                    interpretation="No statement data available",
                    is_applicable=not company.is_financial_sector,
                ),
                piotroski_f=PiotroskiFScoreDetail(
                    rating="UNAVAILABLE",
                    summary="No statement data available",
                ),
            )

        # Group statements by unique period_end
        unique_periods = sorted(list({s.period_end for s in statements}))
        stmt_to_period = {s.id: s.period_end for s in statements}
        period_meta: dict[Any, FinancialStatement] = {}
        for s in statements:
            period_meta[s.period_end] = s

        stmt_ids = [s.id for s in statements]
        facts_query = (
            select(FinancialFact)
            .join(FinancialMetric, FinancialFact.metric_id == FinancialMetric.id)
            .where(FinancialFact.statement_id.in_(stmt_ids))
        )
        facts = list(self.db.scalars(facts_query).all())

        facts_by_period: dict[Any, dict[str, Decimal]] = {p: {} for p in unique_periods}
        for f in facts:
            p_end = stmt_to_period.get(f.statement_id)
            if p_end and f.metric and f.value is not None:
                facts_by_period[p_end][f.metric.code] = f.value

        curr_p = unique_periods[-1]
        curr_stmt = period_meta[curr_p]
        curr_facts = facts_by_period[curr_p]

        prev_p = unique_periods[-2] if len(unique_periods) >= 2 else None
        prev_facts = facts_by_period[prev_p] if prev_p else {}

        display_label = (
            f"FY{curr_stmt.fiscal_year}"
            if curr_stmt.fiscal_year
            else curr_stmt.period_end.strftime("%Y")
        )

        # 1. Altman Z-Score
        if company.is_financial_sector:
            altman_z = AltmanZScoreDetail(
                score=None,
                zone="UNAVAILABLE",
                model="BANKING_BYPASS",
                interpretation="Altman Z-Score is not applicable to banks or financial institutions where asset/liability structures fundamentally differ from industrial firms.",
                is_applicable=False,
                bypass_reason="Model calibrated for non-financial corporations only.",
            )
        else:
            # Prepare inputs
            curr_assets = curr_facts.get("TOTAL_ASSETS") or Decimal("100")
            curr_liab = curr_facts.get("TOTAL_LIABILITIES") or (
                curr_facts.get("TOTAL_DEBT", Decimal("0"))
                + curr_facts.get("TRADE_PAYABLES", Decimal("0"))
                + curr_facts.get("OTHER_CURRENT_LIABILITIES", Decimal("0"))
            )
            # Working capital = Current Assets - Current Liabilities
            wc = curr_facts.get("TRADE_RECEIVABLES", Decimal("0")) + curr_facts.get("INVENTORIES", Decimal("0")) + curr_facts.get("CASH_EQUIVALENTS", Decimal("0")) - curr_facts.get("TRADE_PAYABLES", Decimal("0"))
            if wc == Decimal("0"):
                wc = Decimal("0.1") * curr_assets

            retained = curr_facts.get("RESERVES") or (curr_facts.get("TOTAL_EQUITY", Decimal("0")) * Decimal("0.8"))
            ebit = curr_facts.get("EBIT") or (curr_facts.get("EBITDA", Decimal("0")) - curr_facts.get("DEPRECIATION", Decimal("0")))
            equity = curr_facts.get("TOTAL_EQUITY") or (curr_facts.get("EQUITY_CAPITAL", Decimal("0")) + retained)

            z_dict = calculate_altman_z_score(
                working_capital=wc,
                total_assets=curr_assets,
                retained_earnings=retained,
                ebit=ebit,
                book_equity=equity,
                total_liabilities=curr_liab,
            )
            altman_z = AltmanZScoreDetail(
                score=z_dict.get("score"),
                zone=z_dict.get("zone", "UNAVAILABLE"),
                model=z_dict.get("model", "NON_MANUFACTURING_4_FACTOR"),
                interpretation=z_dict.get("interpretation", ""),
                components=z_dict.get("components", {}),
                is_applicable=True,
            )

        # 2. Piotroski F-Score (9 criteria)
        piot_curr = {
            "pat": curr_facts.get("PAT"),
            "cfo": curr_facts.get("CFO") or (curr_facts.get("PAT", Decimal("0")) * Decimal("1.1")),
            "total_assets": curr_facts.get("TOTAL_ASSETS"),
            "long_term_debt": curr_facts.get("LONG_TERM_DEBT") or curr_facts.get("TOTAL_DEBT"),
            "current_assets": curr_facts.get("TOTAL_ASSETS", Decimal("100")) * Decimal("0.4"),
            "current_liabilities": curr_facts.get("OTHER_CURRENT_LIABILITIES", Decimal("10")) + curr_facts.get("TRADE_PAYABLES", Decimal("10")),
            "equity_capital": curr_facts.get("EQUITY_CAPITAL"),
            "revenue": curr_facts.get("REVENUE") or curr_facts.get("TOTAL_INCOME"),
        }
        piot_prev = {
            "pat": prev_facts.get("PAT"),
            "cfo": prev_facts.get("CFO"),
            "total_assets": prev_facts.get("TOTAL_ASSETS"),
            "long_term_debt": prev_facts.get("LONG_TERM_DEBT") or prev_facts.get("TOTAL_DEBT"),
            "current_assets": prev_facts.get("TOTAL_ASSETS", Decimal("100")) * Decimal("0.4"),
            "current_liabilities": prev_facts.get("OTHER_CURRENT_LIABILITIES", Decimal("10")) + prev_facts.get("TRADE_PAYABLES", Decimal("10")),
            "equity_capital": prev_facts.get("EQUITY_CAPITAL"),
            "revenue": prev_facts.get("REVENUE") or prev_facts.get("TOTAL_INCOME"),
        }

        f_dict = calculate_piotroski_f_score(piot_curr, piot_prev)
        piotroski_f = PiotroskiFScoreDetail(
            score=f_dict.get("score"),
            max_score=f_dict.get("max_score", 9),
            rating=f_dict.get("rating", "UNAVAILABLE"),
            summary=f_dict.get("summary", ""),
            profitability_score=f_dict.get("profitability_score", 0),
            leverage_score=f_dict.get("leverage_score", 0),
            efficiency_score=f_dict.get("efficiency_score", 0),
            factors=f_dict.get("factors", {}),
            is_applicable=True,
        )

        return QualityScoresResponse(
            company_id=company.id,
            company_name=company.name,
            symbol=symbol,
            is_financial_sector=company.is_financial_sector,
            period_label=display_label,
            altman_z=altman_z,
            piotroski_f=piotroski_f,
        )

    # ---------------------------------------------------------
    # Internal Calculation Helpers
    # ---------------------------------------------------------

    def _compute_growth_ratios(
        self,
        periods: list[Any],
        facts_by_period: dict[Any, dict[str, Decimal]],
    ) -> GrowthRatios:
        """Calculate 3Y/5Y CAGR and YoY growth rates."""
        if len(periods) < 2:
            return GrowthRatios()

        rev_series: list[Decimal | None] = [
            facts_by_period[p].get("REVENUE") or facts_by_period[p].get("TOTAL_INCOME")
            for p in periods
        ]
        ebitda_series: list[Decimal | None] = [
            facts_by_period[p].get("EBITDA") or facts_by_period[p].get("NET_INTEREST_INCOME") or facts_by_period[p].get("NII")
            for p in periods
        ]
        pat_series: list[Decimal | None] = [
            facts_by_period[p].get("PAT") for p in periods
        ]
        eps_series: list[Decimal | None] = [
            facts_by_period[p].get("EPS") for p in periods
        ]

        # YoY (latest vs previous)
        rev_yoy = calculate_yoy_growth(rev_series[-1], rev_series[-2])
        pat_yoy = calculate_yoy_growth(pat_series[-1], pat_series[-2])

        # 3Y CAGR (needs at least 4 periods: T, T-1, T-2, T-3)
        rev_3y = calculate_cagr(rev_series[-4], rev_series[-1], 3) if len(rev_series) >= 4 else None
        ebitda_3y = calculate_cagr(ebitda_series[-4], ebitda_series[-1], 3) if len(ebitda_series) >= 4 else None
        pat_3y = calculate_cagr(pat_series[-4], pat_series[-1], 3) if len(pat_series) >= 4 else None
        eps_3y = calculate_cagr(eps_series[-4], eps_series[-1], 3) if len(eps_series) >= 4 else None

        # 5Y CAGR (needs at least 6 periods)
        rev_5y = calculate_cagr(rev_series[-6], rev_series[-1], 5) if len(rev_series) >= 6 else None
        ebitda_5y = calculate_cagr(ebitda_series[-6], ebitda_series[-1], 5) if len(ebitda_series) >= 6 else None
        pat_5y = calculate_cagr(pat_series[-6], pat_series[-1], 5) if len(pat_series) >= 6 else None
        eps_5y = calculate_cagr(eps_series[-6], eps_series[-1], 5) if len(eps_series) >= 6 else None

        return GrowthRatios(
            revenue_cagr_3y=rev_3y,
            revenue_cagr_5y=rev_5y,
            ebitda_cagr_3y=ebitda_3y,
            ebitda_cagr_5y=ebitda_5y,
            pat_cagr_3y=pat_3y,
            pat_cagr_5y=pat_5y,
            eps_cagr_3y=eps_3y,
            eps_cagr_5y=eps_5y,
            revenue_yoy_pct=rev_yoy,
            pat_yoy_pct=pat_yoy,
        )

    def _compute_profitability(
        self,
        latest: dict[str, Decimal],
        prev: dict[str, Decimal],
    ) -> ProfitabilityRatios:
        """Compute margins, returns on capital, and DuPont breakdown."""
        revenue = latest.get("REVENUE") or latest.get("TOTAL_INCOME")
        ebit = latest.get("EBIT")
        ebitda = latest.get("EBITDA")
        pat = latest.get("PAT")

        equity = latest.get("TOTAL_EQUITY")
        prev_equity = prev.get("TOTAL_EQUITY")

        assets = latest.get("TOTAL_ASSETS")
        prev_assets = prev.get("TOTAL_ASSETS")

        curr_liab = latest.get("TOTAL_LIABILITIES")

        op_margin = operating_margin(ebit, revenue)
        eb_margin = ebitda_margin(ebitda, revenue)
        np_margin = net_profit_margin(pat, revenue)
        roe = return_on_equity(pat, equity, prev_equity)
        roce = return_on_capital_employed(
            ebit=ebit,
            total_assets=assets,
            current_liabilities=curr_liab,
            total_debt=latest.get("TOTAL_DEBT"),
            total_equity=equity,
        )
        roa = return_on_assets(pat, assets, prev_assets)

        dupont_dict = dupont_analysis(
            pat=pat,
            revenue=revenue,
            assets=assets,
            equity=equity,
        )

        return ProfitabilityRatios(
            operating_margin_pct=op_margin,
            ebitda_margin_pct=eb_margin,
            net_profit_margin_pct=np_margin,
            return_on_equity_pct=roe,
            return_on_capital_employed_pct=roce,
            return_on_assets_pct=roa,
            dupont=DuPontDecomposition(**dupont_dict),
        )

    def _compute_solvency_ratios(self, latest: dict[str, Decimal]) -> SolvencyRatios:
        """Calculate industrial solvency ratios."""
        debt = latest.get("TOTAL_DEBT")
        equity = latest.get("TOTAL_EQUITY")
        ebit = latest.get("EBIT")
        finance_costs = latest.get("FINANCE_COSTS")
        assets = latest.get("TOTAL_ASSETS")

        # Estimate current assets & current liabilities if not directly broken out
        ca = latest.get("TRADE_RECEIVABLES", Decimal("0")) + latest.get("INVENTORIES", Decimal("0")) + latest.get("CASH_EQUIVALENTS", Decimal("0"))
        cl = latest.get("TRADE_PAYABLES", Decimal("0")) + latest.get("OTHER_CURRENT_LIABILITIES", Decimal("0"))

        if cl == Decimal("0") and assets:
            cl = assets * Decimal("0.2")
        if ca == Decimal("0") and assets:
            ca = assets * Decimal("0.4")

        inv = latest.get("INVENTORIES", Decimal("0"))

        de = debt_to_equity(debt, equity)
        icr = interest_coverage(ebit, finance_costs)
        cr = current_ratio(ca, cl)
        qr = quick_ratio(ca, inv, cl)
        da = debt_to_assets(debt, assets)

        return SolvencyRatios(
            debt_to_equity=de,
            interest_coverage_ratio=icr,
            current_ratio=cr,
            quick_ratio=qr,
            debt_to_assets=da,
            is_applicable=True,
        )

    def _compute_efficiency_ratios(
        self, latest: dict[str, Decimal], prev: dict[str, Decimal]
    ) -> OperatingEfficiencyRatios:
        """Calculate operating efficiency, asset turnover, and CCC."""
        revenue = latest.get("REVENUE") or latest.get("TOTAL_INCOME")
        assets = latest.get("TOTAL_ASSETS")
        prev_assets = prev.get("TOTAL_ASSETS")

        rec = latest.get("TRADE_RECEIVABLES")
        inv = latest.get("INVENTORIES")
        pay = latest.get("TRADE_PAYABLES")
        opex = latest.get("OPERATING_EXPENSES") or latest.get("COST_OF_MATERIALS") or revenue

        at = asset_turnover(revenue, assets, prev_assets)
        d_days = debtor_days(rec, revenue)
        i_days = inventory_days(inv, revenue)
        c_days = creditor_days(pay, opex)
        ccc = cash_conversion_cycle(i_days, d_days, c_days)

        wc = (rec or Decimal("0")) + (inv or Decimal("0")) - (pay or Decimal("0"))
        wc_days = working_capital_days(wc, revenue)

        return OperatingEfficiencyRatios(
            asset_turnover=at,
            inventory_days=i_days,
            debtor_days=d_days,
            creditor_days=c_days,
            cash_conversion_cycle_days=ccc,
            working_capital_days=wc_days,
            is_applicable=True,
        )

    def _compute_banking_ratios(self, latest: dict[str, Decimal]) -> BankingRatios:
        """Calculate regulatory & operating metrics for banks and NBFCs."""
        nii = latest.get("NII") or (latest.get("INTEREST_EARNED", Decimal("0")) - latest.get("INTEREST_EXPENDED", Decimal("0")))
        assets = latest.get("TOTAL_ASSETS")
        opex = latest.get("OPERATING_EXPENSES") or latest.get("EMPLOYEE_EXPENSE", Decimal("0"))
        total_income = latest.get("TOTAL_INCOME") or (nii + latest.get("OTHER_INCOME", Decimal("0")))

        nim = net_interest_margin(nii, assets)
        casa = casa_ratio(latest.get("CASA_RATIO"))
        cti = cost_to_income_ratio(opex, total_income)
        gnpa = npa_pct(latest.get("NPA_GROSS_PCT"))
        nnpa = npa_pct(latest.get("NPA_NET_PCT"))
        car = capital_adequacy_ratio(latest.get("CAR"))

        return BankingRatios(
            net_interest_margin_pct=nim,
            casa_ratio_pct=casa,
            cost_to_income_pct=cti,
            gross_npa_pct=gnpa,
            net_npa_pct=nnpa,
            capital_adequacy_ratio_pct=car,
            is_applicable=True,
        )

    def _compute_historical_trend(
        self,
        periods: list[Any],
        period_meta: dict[Any, FinancialStatement],
        facts_by_period: dict[Any, dict[str, Decimal]],
        is_financial: bool,
    ) -> list[HistoricalRatioPeriod]:
        """Compute key ratio progression across each historical statement period."""
        trend: list[HistoricalRatioPeriod] = []

        for p in periods:
            s = period_meta[p]
            facts = facts_by_period[p]
            rev = facts.get("REVENUE") or facts.get("TOTAL_INCOME")
            pat = facts.get("PAT")
            ebit = facts.get("EBIT")
            eq = facts.get("TOTAL_EQUITY")
            debt = facts.get("TOTAL_DEBT")
            assets = facts.get("TOTAL_ASSETS")
            fc = facts.get("FINANCE_COSTS")

            label = f"FY{s.fiscal_year}" if s.fiscal_year else s.period_end.strftime("%Y")

            opm = operating_margin(ebit, rev)
            npm = net_profit_margin(pat, rev)
            roe = return_on_equity(pat, eq)
            roce = return_on_capital_employed(ebit=ebit, total_assets=assets, total_debt=debt, total_equity=eq)

            de = debt_to_equity(debt, eq) if not is_financial else None
            icr = interest_coverage(ebit, fc) if not is_financial else None

            # Quick CCC estimation
            i_days = inventory_days(facts.get("INVENTORIES"), rev) if not is_financial else None
            d_days = debtor_days(facts.get("TRADE_RECEIVABLES"), rev) if not is_financial else None
            c_days = creditor_days(facts.get("TRADE_PAYABLES"), rev) if not is_financial else None
            ccc = cash_conversion_cycle(i_days, d_days, c_days) if not is_financial else None

            trend.append(
                HistoricalRatioPeriod(
                    period_label=label,
                    fiscal_year=s.fiscal_year,
                    period_end=s.period_end.isoformat(),
                    operating_margin_pct=opm,
                    net_profit_margin_pct=npm,
                    roe_pct=roe,
                    roce_pct=roce,
                    debt_to_equity=de,
                    current_ratio=None,
                    interest_coverage=icr,
                    cash_conversion_cycle_days=ccc,
                )
            )

        return trend
