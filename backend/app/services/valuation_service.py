"""Service orchestrating DCF, Reverse DCF, Historical Multiples, DDM, and Graham models."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.calculations.growth import calculate_cagr
from app.calculations.valuation import (
    calculate_dcf,
    calculate_dcf_sensitivity_matrix,
    calculate_dividend_discount_model,
    calculate_graham_formula,
    calculate_historical_multiples_valuation,
    calculate_reverse_dcf,
)
from app.models.company import Company, Security
from app.models.financials import FinancialFact, FinancialMetric, FinancialStatement
from app.models.market_data import PriceHistory
from app.models.valuation import SavedValuation
from app.schemas.valuation import (
    DCFResult,
    DCFScenarioAssumptions,
    DDMResponse,
    GrahamResponse,
    HistoricalMultiplesResponse,
    ReverseDCFResponse,
    SavedValuationCreate,
    SavedValuationRead,
    SensitivityMatrixResponse,
    ValuationSummaryResponse,
)
from app.services.price_service import PriceService

logger = logging.getLogger(__name__)


class ValuationService:
    """Quantitative valuation engine service for Indian equities."""

    def __init__(self, db: Session):
        self.db = db
        self.price_service = PriceService()

    def _get_company_and_security(self, company_id: int):
        company = self.db.get(Company, company_id)
        if not company:
            raise ValueError(f"Company ID #{company_id} not found")

        sec_stmt = (
            select(Security)
            .where(Security.company_id == company_id)
            .order_by(Security.is_primary.desc())
        )
        primary_sec = self.db.scalars(sec_stmt).first()

        return company, primary_sec

    def _extract_company_financials(self, company_id: int) -> dict[str, Any]:
        """Extract latest financial items, historical series, and current quote."""
        company, primary_sec = self._get_company_and_security(company_id)
        symbol = primary_sec.symbol if primary_sec else company.name

        # Quote
        quote = None
        if primary_sec:
            quote = self.price_service.get_latest_quote(
                primary_sec.symbol, primary_sec.exchange.code if primary_sec.exchange else "NSE"
            )

        current_price = 100.0
        if quote and quote.get("current_price"):
            current_price = float(quote["current_price"])
        else:
            # Check price history
            if primary_sec:
                latest_ph = self.db.scalars(
                    select(PriceHistory)
                    .where(PriceHistory.security_id == primary_sec.id)
                    .order_by(PriceHistory.trade_date.desc())
                    .limit(1)
                ).first()
                if latest_ph and latest_ph.close_price:
                    current_price = float(latest_ph.close_price)

        # Query annual statements
        stmts_query = (
            select(FinancialStatement)
            .where(
                FinancialStatement.company_id == company_id,
                FinancialStatement.period_type == "ANNUAL",
            )
            .order_by(FinancialStatement.period_end.asc())
        )
        statements = list(self.db.scalars(stmts_query).all())

        facts_by_period: dict[Any, dict[str, float]] = {}
        for s in statements:
            if s.period_end not in facts_by_period:
                facts_by_period[s.period_end] = {}

        if statements:
            stmt_ids = [s.id for s in statements]
            stmt_to_period = {s.id: s.period_end for s in statements}
            facts = list(
                self.db.scalars(
                    select(FinancialFact)
                    .join(FinancialMetric, FinancialFact.metric_id == FinancialMetric.id)
                    .where(FinancialFact.statement_id.in_(stmt_ids))
                ).all()
            )
            for f in facts:
                p_end = stmt_to_period.get(f.statement_id)
                if p_end and f.metric and f.value is not None:
                    facts_by_period[p_end][f.metric.code] = float(f.value)

        # Sorted periods
        periods = sorted(facts_by_period.keys())
        latest_facts = facts_by_period[periods[-1]] if periods else {}

        # Metric extraction with robust fallbacks
        latest_revenue = latest_facts.get("total_revenue") or latest_facts.get("revenue") or 1000.0
        latest_ebit = (
            latest_facts.get("ebit")
            or latest_facts.get("operating_income")
            or (latest_revenue * 0.18)
        )
        latest_ebitda = latest_facts.get("ebitda") or (latest_ebit * 1.15)
        latest_tax_rate = 0.25
        latest_net_income = latest_facts.get("net_income") or (latest_ebit * 0.75)
        total_debt = latest_facts.get("total_debt") or latest_facts.get("long_term_debt") or 0.0
        cash = latest_facts.get("cash_and_equivalents") or latest_facts.get("cash") or 0.0

        # Shares outstanding (standardized to Crores matching Cr financial statements)
        calc_shares = None
        if company.paid_up_capital and company.face_value and company.face_value > 0:
            calc_shares = float(company.paid_up_capital / company.face_value)

        raw_shares = (
            latest_facts.get("shares_outstanding")
            or latest_facts.get("diluted_shares")
            or calc_shares
        )
        if not raw_shares or raw_shares <= 0:
            shares = 10.0  # 10 Cr shares fallback
        elif raw_shares > 100000:
            # Absolute share count provided; convert to Crores (1 Cr = 10^7)
            shares = raw_shares / 10000000.0
        else:
            shares = raw_shares

        latest_eps = latest_facts.get("eps") or (latest_net_income / shares if shares > 0 else 10.0)
        latest_bvps = latest_facts.get("book_value_per_share") or (
            (latest_facts.get("total_equity") or 500.0) / shares if shares > 0 else 50.0
        )
        latest_dps = latest_facts.get("dps") or latest_facts.get("dividend_per_share") or None

        # Historical revenue series for CAGR
        hist_revenues = [
            facts_by_period[p].get("total_revenue", 0.0)
            for p in periods
            if facts_by_period[p].get("total_revenue")
        ]
        revenue_cagr = None
        if len(hist_revenues) >= 2:
            try:
                revenue_cagr = float(
                    calculate_cagr(hist_revenues[0], hist_revenues[-1], len(hist_revenues) - 1)
                )
            except (ValueError, ZeroDivisionError, TypeError, KeyError):
                revenue_cagr = None

        # Historical multiples derivation
        hist_pe: list[float] = []
        hist_pb: list[float] = []
        hist_ev_ebitda: list[float] = []
        for p in periods:
            pf = facts_by_period[p]
            ni = pf.get("net_income", 0.0)
            eq = pf.get("total_equity", 0.0)
            eb = pf.get("ebitda", 0.0)
            p_eps = ni / shares if shares > 0 and ni > 0 else None
            p_bvps = eq / shares if shares > 0 and eq > 0 else None

            if p_eps and p_eps > 0:
                hist_pe.append(round(current_price / p_eps, 2))
            if p_bvps and p_bvps > 0:
                hist_pb.append(round(current_price / p_bvps, 2))
            if eb and eb > 0:
                ev = (current_price * shares) + total_debt - cash
                hist_ev_ebitda.append(round(ev / eb, 2))

        # Defaults for historical multiples if sparse data
        if not hist_pe:
            pe_curr = current_price / latest_eps if latest_eps > 0 else 22.0
            hist_pe = [pe_curr * 0.75, pe_curr * 0.9, pe_curr, pe_curr * 1.15, pe_curr * 1.3]
        if not hist_pb:
            pb_curr = current_price / latest_bvps if latest_bvps > 0 else 3.5
            hist_pb = [pb_curr * 0.7, pb_curr * 0.85, pb_curr, pb_curr * 1.2, pb_curr * 1.4]
        if not hist_ev_ebitda and latest_ebitda > 0:
            ev_curr = ((current_price * shares) + total_debt - cash) / latest_ebitda
            hist_ev_ebitda = [ev_curr * 0.75, ev_curr * 0.9, ev_curr, ev_curr * 1.15, ev_curr * 1.3]

        return {
            "company": company,
            "primary_sec": primary_sec,
            "symbol": symbol,
            "is_financial_sector": company.is_financial_sector,
            "current_price": current_price,
            "latest_revenue": latest_revenue,
            "latest_ebit": latest_ebit,
            "latest_ebitda": latest_ebitda,
            "latest_tax_rate": latest_tax_rate,
            "total_debt": total_debt,
            "cash": cash,
            "shares_outstanding": shares,
            "latest_eps": latest_eps,
            "latest_bvps": latest_bvps,
            "latest_dps": latest_dps,
            "revenue_cagr": revenue_cagr,
            "historical_pe": hist_pe,
            "historical_pb": hist_pb,
            "historical_ev_ebitda": hist_ev_ebitda,
        }

    def run_dcf(
        self,
        company_id: int,
        assumptions: DCFScenarioAssumptions,
        override_price: float | None = None,
    ) -> DCFResult:
        """Execute DCF valuation with explicit financial sector guard."""
        data = self._extract_company_financials(company_id)
        company: Company = data["company"]
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        if company.is_financial_sector:
            return DCFResult(
                model="DCF",
                terminal_value_method="BYPASSED",
                enterprise_value=0.0,
                pv_explicit_fcf=0.0,
                terminal_value=0.0,
                pv_terminal_value=0.0,
                total_debt=0.0,
                cash_and_equivalents=0.0,
                equity_value=0.0,
                shares_outstanding=data["shares_outstanding"],
                current_price=price,
                intrinsic_value_per_share=0.0,
                margin_of_safety_pct=0.0,
                is_undervalued=False,
                projections=[],
                status="BYPASSED",
                reason=(
                    "Commercial banks and lending institutions cannot use FCFF valuation "
                    "due to operational interest income and balance sheet funding models. "
                    "Use DDM, P/B Multiples, or Excess Returns instead."
                ),
            )

        res = calculate_dcf(
            latest_revenue=data["latest_revenue"],
            latest_ebit=data["latest_ebit"],
            latest_tax_rate=assumptions.tax_rate,
            shares_outstanding=data["shares_outstanding"],
            total_debt=data["total_debt"],
            cash_and_equivalents=data["cash"],
            current_price=price,
            growth_rates=assumptions.revenue_growth_rates[: assumptions.forecast_years],
            operating_margins=assumptions.operating_margins[: assumptions.forecast_years],
            tax_rate=assumptions.tax_rate,
            reinvestment_rates=assumptions.reinvestment_rates[: assumptions.forecast_years],
            wacc=assumptions.wacc,
            terminal_growth_rate=assumptions.terminal_growth_rate,
            terminal_exit_multiple=assumptions.exit_multiple,
            use_exit_multiple=(assumptions.terminal_method == "EXIT_MULTIPLE"),
        )

        return DCFResult(
            model=res["model"],
            terminal_value_method=res["terminal_value_method"],
            enterprise_value=res["enterprise_value"],
            pv_explicit_fcf=res["pv_explicit_fcf"],
            terminal_value=res["terminal_value"],
            pv_terminal_value=res["pv_terminal_value"],
            total_debt=res["total_debt"],
            cash_and_equivalents=res["cash_and_equivalents"],
            equity_value=res["equity_value"],
            shares_outstanding=res["shares_outstanding"],
            current_price=res["current_price"],
            intrinsic_value_per_share=res["intrinsic_value_per_share"],
            margin_of_safety_pct=res["margin_of_safety_pct"],
            is_undervalued=res["is_undervalued"],
            projections=res["projections"],
            status="SUCCESS",
            reason=None,
        )

    def run_reverse_dcf(
        self,
        company_id: int,
        override_price: float | None = None,
        wacc: float = 0.12,
        terminal_growth_rate: float = 0.05,
        operating_margin: float | None = None,
        reinvestment_rate: float = 0.30,
        projection_years: int = 5,
    ) -> ReverseDCFResponse:
        """Find market-implied growth rate."""
        data = self._extract_company_financials(company_id)
        company: Company = data["company"]
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        if company.is_financial_sector:
            return ReverseDCFResponse(
                model="REVERSE_DCF",
                current_price=price,
                implied_revenue_growth_pct=0.0,
                historical_revenue_cagr_pct=None,
                growth_gap_pct=None,
                is_optimistic=False,
                assumptions={},
                status="BYPASSED",
                reason="Reverse DCF is not applicable to commercial banks and financials.",
            )

        margin = operating_margin if operating_margin is not None else (data["latest_ebit"] / data["latest_revenue"])
        margin = max(0.05, min(0.60, margin))

        res = calculate_reverse_dcf(
            current_price=price,
            latest_revenue=data["latest_revenue"],
            latest_ebit=data["latest_ebit"],
            latest_tax_rate=data["latest_tax_rate"],
            shares_outstanding=data["shares_outstanding"],
            total_debt=data["total_debt"],
            cash_and_equivalents=data["cash"],
            operating_margin=margin,
            wacc=wacc,
            terminal_growth_rate=terminal_growth_rate,
            projection_years=projection_years,
            reinvestment_rate=reinvestment_rate,
        )

        implied_g = res["implied_revenue_growth_pct"]
        hist_cagr = data["revenue_cagr"]
        growth_gap = round(implied_g - (hist_cagr * 100.0), 2) if hist_cagr is not None else None
        is_opt = growth_gap > 5.0 if growth_gap is not None else implied_g > 20.0

        return ReverseDCFResponse(
            model=res["model"],
            current_price=res["current_price"],
            implied_revenue_growth_pct=implied_g,
            historical_revenue_cagr_pct=round(hist_cagr * 100.0, 2) if hist_cagr is not None else None,
            growth_gap_pct=growth_gap,
            is_optimistic=is_opt,
            assumptions=res["assumptions"],
            status="SUCCESS",
        )

    def run_sensitivity_matrix(
        self,
        company_id: int,
        base_growth_rate: float = 0.12,
        base_operating_margin: float = 0.20,
        base_wacc: float = 0.12,
        base_terminal_growth: float = 0.05,
        projection_years: int = 5,
        override_price: float | None = None,
    ) -> SensitivityMatrixResponse:
        """Generate 5x5 WACC vs Terminal Growth matrix."""
        data = self._extract_company_financials(company_id)
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        res = calculate_dcf_sensitivity_matrix(
            latest_revenue=data["latest_revenue"],
            latest_ebit=data["latest_ebit"],
            latest_tax_rate=data["latest_tax_rate"],
            shares_outstanding=data["shares_outstanding"],
            total_debt=data["total_debt"],
            cash_and_equivalents=data["cash"],
            current_price=price,
            base_growth_rate=base_growth_rate,
            base_operating_margin=base_operating_margin,
            base_wacc=base_wacc,
            base_terminal_growth=base_terminal_growth,
            projection_years=projection_years,
        )

        return SensitivityMatrixResponse(
            base_wacc_pct=res["base_wacc_pct"],
            base_terminal_growth_pct=res["base_terminal_growth_pct"],
            current_price=res["current_price"],
            tg_headers=res["tg_headers"],
            matrix=res["matrix"],
        )

    def run_historical_multiples(
        self,
        company_id: int,
        override_price: float | None = None,
    ) -> HistoricalMultiplesResponse:
        """Compute percentile bands and implied prices."""
        data = self._extract_company_financials(company_id)
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        res = calculate_historical_multiples_valuation(
            latest_eps=data["latest_eps"],
            latest_bvps=data["latest_bvps"],
            latest_ebitda=data["latest_ebitda"] if not data["is_financial_sector"] else None,
            shares_outstanding=data["shares_outstanding"],
            total_debt=data["total_debt"],
            cash_and_equivalents=data["cash"],
            current_price=price,
            historical_pe_ratios=data["historical_pe"],
            historical_pb_ratios=data["historical_pb"],
            historical_ev_ebitda_ratios=data["historical_ev_ebitda"] if not data["is_financial_sector"] else [],
        )

        # Compute blended median target price across active models
        targets = []
        if res["pe"]["implied_target_price"]:
            targets.append(res["pe"]["implied_target_price"])
        if res["pb"]["implied_target_price"]:
            targets.append(res["pb"]["implied_target_price"])
        if res["ev_ebitda"]["implied_target_price"]:
            targets.append(res["ev_ebitda"]["implied_target_price"])

        blended_target = round(sum(targets) / len(targets), 2) if targets else None
        blended_mos = (
            round(((blended_target - price) / blended_target) * 100.0, 2)
            if blended_target and blended_target > 0
            else None
        )

        return HistoricalMultiplesResponse(
            model=res["model"],
            current_price=res["current_price"],
            pe=res["pe"],
            pb=res["pb"],
            ev_ebitda=res["ev_ebitda"],
            blended_target_price=blended_target,
            blended_margin_of_safety_pct=blended_mos,
            status="SUCCESS",
        )

    def run_ddm(
        self,
        company_id: int,
        cost_of_equity: float = 0.13,
        dividend_growth_rate: float = 0.06,
        high_growth_period_years: int = 0,
        high_growth_rate: float | None = None,
        override_price: float | None = None,
    ) -> DDMResponse:
        """Run Dividend Discount Model."""
        data = self._extract_company_financials(company_id)
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        res = calculate_dividend_discount_model(
            latest_dps=data["latest_dps"],
            cost_of_equity=cost_of_equity,
            dividend_growth_rate=dividend_growth_rate,
            current_price=price,
            high_growth_period_years=high_growth_period_years,
            high_growth_rate=high_growth_rate,
        )

        return DDMResponse(
            model=res["model"],
            is_applicable=res["is_applicable"],
            bypass_reason=res.get("bypass_reason"),
            message=res.get("message"),
            latest_dps=res.get("latest_dps"),
            cost_of_equity_pct=res.get("cost_of_equity_pct"),
            dividend_growth_pct=res.get("dividend_growth_pct"),
            current_price=res.get("current_price"),
            intrinsic_value=res.get("intrinsic_value"),
            margin_of_safety_pct=res.get("margin_of_safety_pct"),
            is_undervalued=res.get("is_undervalued"),
        )

    def run_graham(
        self,
        company_id: int,
        expected_growth_rate: float = 0.10,
        benchmark_yield_pct: float = 7.10,
        override_price: float | None = None,
    ) -> GrahamResponse:
        """Run Benjamin Graham formula & number."""
        data = self._extract_company_financials(company_id)
        price = override_price if override_price is not None and override_price > 0 else data["current_price"]

        res = calculate_graham_formula(
            latest_eps=data["latest_eps"],
            latest_bvps=data["latest_bvps"],
            expected_growth_rate=expected_growth_rate,
            current_price=price,
            aaa_bond_yield=benchmark_yield_pct,
        )

        return GrahamResponse(
            model=res["model"],
            is_applicable=res["is_applicable"],
            bypass_reason=res.get("bypass_reason"),
            message=res.get("message"),
            latest_eps=res.get("latest_eps"),
            latest_bvps=res.get("latest_bvps"),
            expected_growth_pct=res.get("expected_growth_pct"),
            benchmark_yield_pct=res.get("benchmark_yield_pct"),
            current_price=res.get("current_price"),
            graham_value=res.get("graham_value"),
            graham_number=res.get("graham_number"),
            margin_of_safety_pct=res.get("margin_of_safety_pct"),
            is_undervalued=res.get("is_undervalued"),
        )

    def get_valuation_summary(self, company_id: int) -> ValuationSummaryResponse:
        """Consolidate all valuation models into consensus view."""
        data = self._extract_company_financials(company_id)
        company: Company = data["company"]
        price = data["current_price"]

        # Run models with default base assumptions
        dcf_res = self.run_dcf(company_id, DCFScenarioAssumptions())
        rev_dcf_res = self.run_reverse_dcf(company_id)
        multiples_res = self.run_historical_multiples(company_id)
        ddm_res = self.run_ddm(company_id)
        graham_res = self.run_graham(company_id)

        # Collect valid per-share intrinsic targets for consensus
        valid_targets: list[float] = []
        if dcf_res.status == "SUCCESS" and dcf_res.intrinsic_value_per_share > 0:
            valid_targets.append(dcf_res.intrinsic_value_per_share)
        if multiples_res.blended_target_price and multiples_res.blended_target_price > 0:
            valid_targets.append(multiples_res.blended_target_price)
        if ddm_res.is_applicable and ddm_res.intrinsic_value and ddm_res.intrinsic_value > 0:
            valid_targets.append(ddm_res.intrinsic_value)
        if graham_res.is_applicable and graham_res.graham_value and graham_res.graham_value > 0:
            valid_targets.append(graham_res.graham_value)

        consensus_val = round(sum(valid_targets) / len(valid_targets), 2) if valid_targets else None
        upside = (
            round(((consensus_val - price) / price) * 100.0, 2)
            if consensus_val and price > 0
            else None
        )

        return ValuationSummaryResponse(
            company_id=company.id,
            symbol=data["symbol"],
            company_name=company.name,
            sector_name=company.sector.name if company.sector else None,
            industry_name=company.industry.name if company.industry else None,
            is_financial_sector=company.is_financial_sector,
            current_price=price,
            dcf=dcf_res,
            reverse_dcf=rev_dcf_res,
            historical_multiples=multiples_res,
            ddm=ddm_res,
            graham=graham_res,
            consensus_fair_value=consensus_val,
            consensus_upside_pct=upside,
            applicable_models_count=len(valid_targets),
        )

    # ─── Saved Valuation CRUD ──────────────────────────────────────────

    def save_valuation(self, valuation_in: SavedValuationCreate) -> SavedValuationRead:
        """Persist a valuation run with its scenario parameters."""
        saved = SavedValuation(
            company_id=valuation_in.company_id,
            model_type=valuation_in.model_type,
            scenario_name=valuation_in.scenario_name,
            intrinsic_value=valuation_in.intrinsic_value,
            current_price_at_run=valuation_in.current_price_at_run,
            margin_of_safety_pct=valuation_in.margin_of_safety_pct,
            assumptions=valuation_in.assumptions,
            projections=valuation_in.projections,
            notes=valuation_in.notes,
        )
        self.db.add(saved)
        self.db.commit()
        self.db.refresh(saved)
        return SavedValuationRead.model_validate(saved)

    def list_saved_valuations(self, company_id: int | None = None) -> list[SavedValuationRead]:
        """List saved valuation scenarios."""
        query = select(SavedValuation)
        if company_id is not None:
            query = query.where(SavedValuation.company_id == company_id)
        query = query.order_by(SavedValuation.created_at.desc())
        items = self.db.scalars(query).all()
        return [SavedValuationRead.model_validate(item) for item in items]

    def delete_saved_valuation(self, valuation_id: int) -> bool:
        """Delete a saved valuation scenario."""
        val = self.db.get(SavedValuation, valuation_id)
        if not val:
            return False
        self.db.delete(val)
        self.db.commit()
        return True
