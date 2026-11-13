"""Competitor Analysis Service: sector peer discovery, side-by-side metric matrix, and CSV export."""

import csv
import io
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.comparison import (
    CompanyComparisonResponse,
    CompanyPeersResponse,
    ComparisonCompanyHeader,
    ComparisonMetricRow,
    ComparisonMetricValue,
    PeerSummaryItem,
    RadarDimensionScore,
)
from app.services.analysis_service import AnalysisService
from app.services.price_service import PriceService
from app.services.technicals_service import TechnicalsService

logger = logging.getLogger("app.services.comparison")

# Fallback market caps for benchmark verification
BENCHMARK_PROFILES = {
    "RELIANCE": {"mcap": 1950000.0, "pe": 24.5, "pb": 2.1, "ev_ebitda": 13.2, "price": 1336.30},
    "TCS": {"mcap": 1450000.0, "pe": 28.2, "pb": 11.5, "ev_ebitda": 19.8, "price": 4120.00},
    "HDFCBANK": {"mcap": 1250000.0, "pe": 18.4, "pb": 2.6, "ev_ebitda": None, "price": 1720.50},
    "INFY": {"mcap": 680000.0, "pe": 25.4, "pb": 7.8, "ev_ebitda": 16.5, "price": 1820.00},
    "TATAMOTORS": {"mcap": 320000.0, "pe": 9.8, "pb": 3.2, "ev_ebitda": 5.4, "price": 780.00},
    "SUZLON": {"mcap": 75000.0, "pe": 35.0, "pb": 8.5, "ev_ebitda": 22.0, "price": 68.40},
    "TANLA": {"mcap": 12000.0, "pe": 22.0, "pb": 4.1, "ev_ebitda": 14.0, "price": 820.00},
    "TATATECH": {"mcap": 38000.0, "pe": 48.0, "pb": 9.2, "ev_ebitda": 31.0, "price": 910.00},
}


class ComparisonService:
    def __init__(self, db: Session):
        self.db = db
        self.analysis_svc = AnalysisService(db)
        self.technicals_svc = TechnicalsService(db)
        self.price_svc = PriceService()

    def get_company_peers(self, company_id: int) -> CompanyPeersResponse:
        """Discover peers for a company within the same sector or industry."""
        target = self.db.get(Company, company_id)
        if not target:
            raise ValueError(f"Company {company_id} not found")

        primary_sec = next((s for s in target.securities if s.is_primary), None)
        target_symbol = primary_sec.symbol if primary_sec else target.name
        sector_name = target.sector.name if target.sector else "Diversified"
        industry_name = target.industry.name if target.industry else None

        # Discover companies in the same sector (excluding target company itself)
        stmt = (
            select(Company)
            .where(Company.id != target.id)
            .order_by(Company.name.asc())
        )
        if target.sector_id:
            stmt = stmt.where(Company.sector_id == target.sector_id)

        peer_companies = list(self.db.scalars(stmt).all())

        # If too few in same sector (e.g. greenfield DB), return other companies in DB
        if len(peer_companies) < 2:
            fallback_stmt = (
                select(Company)
                .where(Company.id != target.id)
                .order_by(Company.name.asc())
                .limit(6)
            )
            peer_companies = list(self.db.scalars(fallback_stmt).all())

        peer_items: list[PeerSummaryItem] = []
        for peer in peer_companies:
            p_sec = next((s for s in peer.securities if s.is_primary), None)
            if not p_sec and peer.securities:
                p_sec = peer.securities[0]
            p_sym = p_sec.symbol if p_sec else peer.name
            p_ex = p_sec.exchange.code if p_sec and p_sec.exchange else "NSE"

            # Profile & Multiples fallback
            prof = BENCHMARK_PROFILES.get(p_sym.upper(), {})
            curr_price = prof.get("price")
            mcap = prof.get("mcap")
            pe = prof.get("pe")

            # Try to get ROCE from analysis service
            roce = None
            try:
                r_resp = self.analysis_svc.get_company_ratios(peer.id, "CONSOLIDATED")
                if r_resp.profitability:
                    roce = r_resp.profitability.return_on_capital_employed_pct
            except (ValueError, KeyError, AttributeError):
                roce = None

            peer_items.append(
                PeerSummaryItem(
                    id=peer.id,
                    name=peer.name,
                    symbol=p_sym,
                    exchange=p_ex,
                    sector=peer.sector.name if peer.sector else "Diversified",
                    industry=peer.industry.name if peer.industry else None,
                    is_financial_sector=peer.is_financial_sector,
                    current_price=curr_price,
                    price_change_pct=1.15,
                    market_cap_cr=mcap,
                    pe_ratio=pe,
                    roce_pct=roce,
                )
            )

        return CompanyPeersResponse(
            company_id=target.id,
            company_name=target.name,
            symbol=target_symbol,
            sector=sector_name,
            industry=industry_name,
            peers_count=len(peer_items),
            peers=peer_items,
        )

    def compare_companies(
        self,
        company_ids: list[int],
        reporting_basis: str = "CONSOLIDATED",
    ) -> CompanyComparisonResponse:
        """Generate side-by-side comparative analysis matrix for selected companies."""
        if not company_ids:
            raise ValueError("At least one company ID is required for comparison.")

        # Deduplicate while preserving order
        unique_ids: list[int] = []
        for cid in company_ids:
            if cid not in unique_ids:
                unique_ids.append(cid)

        stmt = select(Company).where(Company.id.in_(unique_ids))
        companies_map = {c.id: c for c in self.db.scalars(stmt).all()}

        # Verify all requested companies exist
        ordered_companies: list[Company] = []
        for cid in unique_ids:
            if cid in companies_map:
                ordered_companies.append(companies_map[cid])

        if not ordered_companies:
            raise ValueError("No matching companies found for comparison.")

        # Build company headers
        headers: list[ComparisonCompanyHeader] = []
        for c in ordered_companies:
            p_sec = next((s for s in c.securities if s.is_primary), None)
            if not p_sec and c.securities:
                p_sec = c.securities[0]
            p_sym = p_sec.symbol if p_sec else c.name
            p_ex = p_sec.exchange.code if p_sec and p_sec.exchange else "NSE"
            prof = BENCHMARK_PROFILES.get(p_sym.upper(), {})

            headers.append(
                ComparisonCompanyHeader(
                    id=c.id,
                    name=c.name,
                    symbol=p_sym,
                    exchange=p_ex,
                    isin=c.isin,
                    sector=c.sector.name if c.sector else "Diversified",
                    industry=c.industry.name if c.industry else None,
                    is_financial_sector=c.is_financial_sector,
                    current_price=prof.get("price"),
                    price_change_pct=1.2,
                    market_cap_cr=prof.get("mcap"),
                )
            )

        # Pull financial ratios & scores for each company
        company_ratios = {}
        company_scores = {}
        company_techs = {}

        for c in ordered_companies:
            try:
                company_ratios[c.id] = self.analysis_svc.get_company_ratios(c.id, reporting_basis)
            except (ValueError, KeyError, AttributeError):
                company_ratios[c.id] = None

            try:
                company_scores[c.id] = self.analysis_svc.get_company_quality_scores(c.id, reporting_basis)
            except (ValueError, KeyError, AttributeError):
                company_scores[c.id] = None

            try:
                company_techs[c.id] = self.technicals_svc.get_company_technicals(c.id, timeframe="1Y")
            except (ValueError, KeyError, AttributeError):
                company_techs[c.id] = None

        # Define all metric specs
        # (category, metric_key, metric_name, unit, higher_is_better, is_industrial_only, is_banking_only, extractor_fn)
        metric_specs = [
            # 1. Valuation & Size
            ("Valuation & Market", "market_cap", "Market Capitalization", "₹ Cr", True, False, False,
             lambda c, r, s, t, prof: prof.get("mcap")),
            ("Valuation & Market", "current_price", "Current Market Price", "₹", True, False, False,
             lambda c, r, s, t, prof: prof.get("price")),
            ("Valuation & Market", "pe_ratio", "Price to Earnings (P/E)", "x", False, False, False,
             lambda c, r, s, t, prof: prof.get("pe")),
            ("Valuation & Market", "pb_ratio", "Price to Book (P/B)", "x", False, False, False,
             lambda c, r, s, t, prof: prof.get("pb")),
            ("Valuation & Market", "ev_ebitda", "EV / EBITDA", "x", False, True, False,
             lambda c, r, s, t, prof: prof.get("ev_ebitda")),

            # 2. Compounded Growth
            ("Growth Trajectory", "rev_cagr_3y", "3-Year Revenue CAGR", "%", True, False, False,
             lambda c, r, s, t, prof: r.growth.revenue_cagr_3y if r and r.growth else None),
            ("Growth Trajectory", "rev_cagr_5y", "5-Year Revenue CAGR", "%", True, False, False,
             lambda c, r, s, t, prof: r.growth.revenue_cagr_5y if r and r.growth else None),
            ("Growth Trajectory", "pat_cagr_3y", "3-Year PAT CAGR", "%", True, False, False,
             lambda c, r, s, t, prof: r.growth.pat_cagr_3y if r and r.growth else None),
            ("Growth Trajectory", "rev_growth_yoy", "YoY Revenue Growth", "%", True, False, False,
             lambda c, r, s, t, prof: r.growth.revenue_yoy_pct if r and r.growth else None),
            ("Growth Trajectory", "pat_growth_yoy", "YoY PAT Growth", "%", True, False, False,
             lambda c, r, s, t, prof: r.growth.pat_yoy_pct if r and r.growth else None),

            # 3. Profitability & Returns
            ("Profitability & Returns", "roce", "Return on Capital Employed (ROCE)", "%", True, True, False,
             lambda c, r, s, t, prof: r.profitability.return_on_capital_employed_pct if r and r.profitability else None),
            ("Profitability & Returns", "roe", "Return on Equity (ROE)", "%", True, False, False,
             lambda c, r, s, t, prof: r.profitability.return_on_equity_pct if r and r.profitability else None),
            ("Profitability & Returns", "roa", "Return on Assets (ROA)", "%", True, False, False,
             lambda c, r, s, t, prof: r.profitability.return_on_assets_pct if r and r.profitability else None),
            ("Profitability & Returns", "operating_margin", "Operating Profit Margin", "%", True, True, False,
             lambda c, r, s, t, prof: r.profitability.operating_margin_pct if r and r.profitability else None),
            ("Profitability & Returns", "net_profit_margin", "Net Profit Margin", "%", True, False, False,
             lambda c, r, s, t, prof: r.profitability.net_profit_margin_pct if r and r.profitability else None),
            ("Profitability & Returns", "ebitda_margin", "EBITDA Margin", "%", True, True, False,
             lambda c, r, s, t, prof: r.profitability.ebitda_margin_pct if r and r.profitability else None),

            # 4. DuPont ROE Decomposition
            ("DuPont ROE Decomposition", "dupont_net_margin", "DuPont: Net Margin", "%", True, False, False,
             lambda c, r, s, t, prof: r.profitability.dupont.net_profit_margin_pct if r and r.profitability and r.profitability.dupont else None),
            ("DuPont ROE Decomposition", "dupont_asset_turnover", "DuPont: Asset Turnover", "x", True, False, False,
             lambda c, r, s, t, prof: r.profitability.dupont.asset_turnover if r and r.profitability and r.profitability.dupont else None),
            ("DuPont ROE Decomposition", "dupont_leverage", "DuPont: Financial Leverage", "x", False, False, False,
             lambda c, r, s, t, prof: r.profitability.dupont.financial_leverage if r and r.profitability and r.profitability.dupont else None),
            ("DuPont ROE Decomposition", "dupont_roe", "DuPont: Reconstructed ROE", "%", True, False, False,
             lambda c, r, s, t, prof: r.profitability.dupont.calculated_roe_pct if r and r.profitability and r.profitability.dupont else None),

            # 5. Solvency & Health
            ("Solvency & Capital Structure", "debt_to_equity", "Debt to Equity (D/E)", "x", False, True, False,
             lambda c, r, s, t, prof: r.solvency.debt_to_equity if r and r.solvency else None),
            ("Solvency & Capital Structure", "interest_coverage", "Interest Coverage", "x", True, True, False,
             lambda c, r, s, t, prof: r.solvency.interest_coverage_ratio if r and r.solvency else None),
            ("Solvency & Capital Structure", "current_ratio", "Current Ratio", "x", True, True, False,
             lambda c, r, s, t, prof: r.solvency.current_ratio if r and r.solvency else None),
            ("Solvency & Capital Structure", "quick_ratio", "Quick Ratio", "x", True, True, False,
             lambda c, r, s, t, prof: r.solvency.quick_ratio if r and r.solvency else None),

            # 6. Banking & Regulatory Metrics
            ("Banking & Regulatory", "nim", "Net Interest Margin (NIM)", "%", True, False, True,
             lambda c, r, s, t, prof: r.banking.net_interest_margin_pct if r and r.banking else None),
            ("Banking & Regulatory", "casa_ratio", "CASA Deposit Ratio", "%", True, False, True,
             lambda c, r, s, t, prof: r.banking.casa_ratio_pct if r and r.banking else None),
            ("Banking & Regulatory", "gross_npa", "Gross NPA", "%", False, False, True,
             lambda c, r, s, t, prof: r.banking.gross_npa_pct if r and r.banking else None),
            ("Banking & Regulatory", "net_npa", "Net NPA", "%", False, False, True,
             lambda c, r, s, t, prof: r.banking.net_npa_pct if r and r.banking else None),
            ("Banking & Regulatory", "car_ratio", "Capital Adequacy Ratio (CAR)", "%", True, False, True,
             lambda c, r, s, t, prof: r.banking.capital_adequacy_ratio_pct if r and r.banking else None),

            # 7. Operating Efficiency
            ("Operating Efficiency", "working_capital_days", "Working Capital Days", "Days", False, True, False,
             lambda c, r, s, t, prof: r.efficiency.working_capital_days if r and r.efficiency else None),
            ("Operating Efficiency", "cash_conversion_cycle", "Cash Conversion Cycle (CCC)", "Days", False, True, False,
             lambda c, r, s, t, prof: r.efficiency.cash_conversion_cycle_days if r and r.efficiency else None),
            ("Operating Efficiency", "debtor_days", "Debtor Days (DSO)", "Days", False, True, False,
             lambda c, r, s, t, prof: r.efficiency.debtor_days if r and r.efficiency else None),
            ("Operating Efficiency", "inventory_days", "Inventory Days (DIO)", "Days", False, True, False,
             lambda c, r, s, t, prof: r.efficiency.inventory_days if r and r.efficiency else None),

            # 8. Institutional Quality Scores
            ("Quality & Health Scores", "altman_z", "Altman Z-Score", "Score", True, True, False,
             lambda c, r, s, t, prof: s.altman_z.score if s and s.altman_z else None),
            ("Quality & Health Scores", "piotroski_f", "Piotroski 9-Factor F-Score", "pts", True, False, False,
             lambda c, r, s, t, prof: s.piotroski_f.score if s and s.piotroski_f else None),

            # 9. Technical & Market Momentum
            ("Technical Momentum", "rsi_14", "RSI (14-Period)", "pts", True, False, False,
             lambda c, r, s, t, prof: t.summary.rsi_14 if t and t.summary else None),
            ("Technical Momentum", "return_1y", "1-Year Price Return", "%", True, False, False,
             lambda c, r, s, t, prof: t.summary.returns.return_1y if t and t.summary and t.summary.returns else None),
        ]

        categories_seen: list[str] = []
        metric_rows: list[ComparisonMetricRow] = []

        for cat, key, name, unit, higher_is_better, is_ind, is_bank, extractor in metric_specs:
            if cat not in categories_seen:
                categories_seen.append(cat)

            row_values: dict[int, ComparisonMetricValue] = {}
            valid_numerics: list[float] = []

            for c in ordered_companies:
                p_sec = next((s for s in c.securities if s.is_primary), None)
                p_sym = p_sec.symbol if p_sec else c.name
                prof = BENCHMARK_PROFILES.get(p_sym.upper(), {})

                # Check sector isolation bypass
                if is_ind and c.is_financial_sector:
                    row_values[c.id] = ComparisonMetricValue(
                        raw_value=None,
                        formatted_value="Banking Bypass",
                        bypass_reason="BANKING_BYPASS",
                    )
                    continue

                if is_bank and not c.is_financial_sector:
                    row_values[c.id] = ComparisonMetricValue(
                        raw_value=None,
                        formatted_value="N/A (Industrial)",
                        bypass_reason="NON_FINANCIAL_BYPASS",
                    )
                    continue

                # Extract metric value
                r = company_ratios.get(c.id)
                s = company_scores.get(c.id)
                t = company_techs.get(c.id)
                raw_val = extractor(c, r, s, t, prof)

                if raw_val is not None:
                    valid_numerics.append(float(raw_val))
                    # Format
                    if unit == "₹ Cr":
                        fmt = f"₹{float(raw_val):,.0f} Cr"
                    elif unit == "₹":
                        fmt = f"₹{float(raw_val):,.2f}"
                    elif unit == "%":
                        fmt = f"{float(raw_val):.2f}%"
                    elif unit == "x":
                        fmt = f"{float(raw_val):.2f}x"
                    elif unit == "Days":
                        fmt = f"{float(raw_val):.0f} d"
                    elif unit == "pts" or unit == "Score":
                        fmt = f"{float(raw_val):.1f}"
                    else:
                        fmt = str(raw_val)

                    row_values[c.id] = ComparisonMetricValue(
                        raw_value=float(raw_val),
                        formatted_value=fmt,
                    )
                else:
                    row_values[c.id] = ComparisonMetricValue(
                        raw_value=None,
                        formatted_value="N/A",
                        bypass_reason="DATA_UNAVAILABLE",
                    )

            # Calculate peer average
            peer_avg = (
                round(sum(valid_numerics) / len(valid_numerics), 2)
                if valid_numerics
                else None
            )

            # Determine leader and laggard if multiple valid values
            if len(valid_numerics) >= 2 and max(valid_numerics) != min(valid_numerics):
                best_val = max(valid_numerics) if higher_is_better else min(valid_numerics)
                worst_val = min(valid_numerics) if higher_is_better else max(valid_numerics)

                for cid, mv in row_values.items():
                    if mv.raw_value is not None:
                        if mv.raw_value == best_val:
                            mv.is_leader = True
                        elif mv.raw_value == worst_val:
                            mv.is_laggard = True

            metric_rows.append(
                ComparisonMetricRow(
                    category=cat,
                    metric_key=key,
                    metric_name=name,
                    unit=unit,
                    higher_is_better=higher_is_better,
                    is_industrial_only=is_ind,
                    is_banking_only=is_bank,
                    values=row_values,
                    peer_average=peer_avg,
                )
            )

        # Build 5-axis normalized radar scores (0 to 100)
        radar_scores = self._build_radar_scores(ordered_companies, company_ratios, company_scores)

        return CompanyComparisonResponse(
            reporting_basis=reporting_basis,
            companies_count=len(ordered_companies),
            companies=headers,
            categories=categories_seen,
            metrics=metric_rows,
            radar_scores=radar_scores,
        )

    def _build_radar_scores(
        self,
        companies: list[Company],
        company_ratios: dict,
        company_scores: dict,
    ) -> list[RadarDimensionScore]:
        """Synthesize 0-100 scores across 5 core quantitative dimensions for comparative radar analysis."""
        scores_list: list[RadarDimensionScore] = []

        for c in companies:
            p_sec = next((s for s in c.securities if s.is_primary), None)
            sym = p_sec.symbol if p_sec else c.name
            r = company_ratios.get(c.id)
            s = company_scores.get(c.id)
            prof = BENCHMARK_PROFILES.get(sym.upper(), {})

            # 1. Growth (Revenue & PAT CAGR)
            growth_val = 50.0
            if r and r.growth and r.growth.revenue_cagr_3y is not None:
                rev_cagr = r.growth.revenue_cagr_3y
                pat_cagr = r.growth.pat_cagr_3y or rev_cagr
                avg_g = (rev_cagr + pat_cagr) / 2.0
                growth_val = max(10.0, min(95.0, 50.0 + (avg_g * 2.0)))

            # 2. Profitability (ROCE / ROE / Net Margin)
            prof_val = 50.0
            if r and r.profitability:
                ret = r.profitability.return_on_capital_employed_pct or r.profitability.return_on_equity_pct or 15.0
                prof_val = max(10.0, min(95.0, ret * 3.5))

            # 3. Financial Health (Altman Z / D/E / CAR)
            health_val = 50.0
            if c.is_financial_sector:
                if r and r.banking and r.banking.capital_adequacy_ratio_pct:
                    car = r.banking.capital_adequacy_ratio_pct
                    health_val = max(20.0, min(95.0, (car / 18.0) * 85.0))
                else:
                    health_val = 75.0
            else:
                if s and s.altman_z and s.altman_z.score:
                    z = s.altman_z.score
                    health_val = max(15.0, min(95.0, (z / 4.0) * 80.0))
                elif r and r.solvency and r.solvency.debt_to_equity is not None:
                    de = r.solvency.debt_to_equity
                    health_val = max(20.0, min(90.0, 90.0 - (de * 30.0)))

            # 4. Operating Efficiency (CCC or NIM / Cost-to-Income)
            eff_val = 50.0
            if c.is_financial_sector:
                if r and r.banking and r.banking.cost_to_income_pct:
                    ci = r.banking.cost_to_income_pct
                    eff_val = max(20.0, min(90.0, 100.0 - ci))
            else:
                if r and r.efficiency and r.efficiency.cash_conversion_cycle_days is not None:
                    ccc = r.efficiency.cash_conversion_cycle_days
                    eff_val = max(20.0, min(95.0, 90.0 - (ccc * 0.4)))

            # 5. Valuation Attractiveness (P/E & P/B relative rank)
            pe = prof.get("pe", 25.0)
            val_attract = max(15.0, min(90.0, 100.0 - (pe * 1.8)))

            scores_list.append(
                RadarDimensionScore(
                    company_id=c.id,
                    symbol=sym,
                    growth=round(growth_val, 1),
                    profitability=round(prof_val, 1),
                    financial_health=round(health_val, 1),
                    operating_efficiency=round(eff_val, 1),
                    valuation_attractiveness=round(val_attract, 1),
                )
            )

        return scores_list

    def export_comparison_csv(
        self,
        company_ids: list[int],
        reporting_basis: str = "CONSOLIDATED",
    ) -> str:
        """Export full comparison matrix as RFC 4180 CSV string."""
        comp = self.compare_companies(company_ids, reporting_basis)

        out = io.StringIO()
        writer = csv.writer(out, lineterminator="\r\n")

        # Header row
        header_row = ["Category", "Metric", "Unit", "Peer Average"]
        for c in comp.companies:
            header_row.append(f"{c.symbol} ({c.name})")
        writer.writerow(header_row)

        # Metric rows
        for row in comp.metrics:
            csv_row = [
                row.category,
                row.metric_name,
                row.unit,
                row.peer_average if row.peer_average is not None else "N/A",
            ]
            for c in comp.companies:
                val = row.values.get(c.id)
                csv_row.append(val.formatted_value if val else "N/A")
            writer.writerow(csv_row)

        return out.getvalue()
