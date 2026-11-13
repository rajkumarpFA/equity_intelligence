"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Info,
  Layers,
  PieChart,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { fetchCompanyQualityScores, fetchCompanyRatios } from "@/lib/api-client";
import { formatPercent, formatRatio, formatDays, formatNumber } from "@/lib/format";
import { MissingValue } from "@/components/common/MissingValue";

interface FinancialAnalysisTabProps {
  companyId: number;
  companyName: string;
  isFinancialSector?: boolean;
}

export function FinancialAnalysisTab({
  companyId,
  companyName,
  isFinancialSector = false,
}: FinancialAnalysisTabProps) {
  const [reportingBasis, setReportingBasis] = useState<"CONSOLIDATED" | "STANDALONE">("CONSOLIDATED");
  const [showPiotroskiFactors, setShowPiotroskiFactors] = useState(false);

  // 1. Fetch Ratios
  const ratiosQuery = useQuery({
    queryKey: ["company-ratios", companyId, reportingBasis],
    queryFn: () => fetchCompanyRatios(companyId, reportingBasis),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Quality Health Scores (Altman Z + Piotroski F)
  const scoresQuery = useQuery({
    queryKey: ["company-quality-scores", companyId, reportingBasis],
    queryFn: () => fetchCompanyQualityScores(companyId, reportingBasis),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = ratiosQuery.isLoading || scoresQuery.isLoading;
  const isError = ratiosQuery.isError || scoresQuery.isError;
  const ratios = ratiosQuery.data;
  const scores = scoresQuery.data;

  const altmanZ = scores?.altman_z;
  const piotroskiF = scores?.piotroski_f;

  return (
    <div className="space-y-6" data-testid="financial-analysis-tab">
      {/* Top Controls & Header Strip */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-1)]">
              Financial Analysis & Fundamental Health
            </h3>
            <p className="text-xs text-[var(--text-3)]">
              {ratios?.latest_period_label
                ? `Computed from audited filings up to ${ratios.latest_period_label}`
                : "DuPont Decomposition, Altman Z, Piotroski F, & Solvency"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Basis Toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setReportingBasis("CONSOLIDATED")}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                reportingBasis === "CONSOLIDATED"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              Consolidated
            </button>
            <button
              type="button"
              onClick={() => setReportingBasis("STANDALONE")}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                reportingBasis === "STANDALONE"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              Standalone
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              ratiosQuery.refetch();
              scoresQuery.refetch();
            }}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:text-[var(--text-1)] transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Banking Sector Isolation Banner */}
      {isFinancialSector && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-sky-300">
          <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <div>
            <span className="font-bold text-sky-200">Financial Sector Governance Rule: </span>
            This company operates in the banking / financial sector. Industrial solvency ratios (D/E, Current Ratio) and Cash Conversion Cycle are intentionally bypassed because customer deposits represent operating liabilities. Specialised regulatory metrics (NIM %, CASA %, NPA %, and CAR %) are computed instead.
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border)]" />
          <div className="h-64 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border)]" />
          <div className="h-72 col-span-full rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border)]" />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-[var(--radius-card)] border border-[var(--down)]/20 bg-[var(--down)]/10 p-6 text-center text-[var(--down)]">
          <AlertTriangle className="mx-auto h-6 w-6" />
          <h4 className="mt-2 text-sm font-bold">Failed to load financial analysis</h4>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Ensure audited statements have been ingested and seeded for this company.
          </p>
        </div>
      )}

      {!isLoading && !isError && ratios && scores && (
        <>
          {/* SECTION 1: QUALITY & FINANCIAL DISTRESS SCORES (ALTMAN Z & PIOTROSKI F) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1A: Altman Z-Score Card */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                    <h4 className="text-sm font-bold text-[var(--text-1)]">
                      Altman Z-Score (Bankruptcy Health)
                    </h4>
                  </div>
                  <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                    {altmanZ?.model === "BANKING_BYPASS"
                      ? "Bypassed for financial institution"
                      : "4-Factor Emerging Market / Non-Manufacturing Model"}
                  </p>
                </div>

                {/* Zone Badge */}
                {altmanZ?.is_applicable ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      altmanZ.zone === "SAFE"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : altmanZ.zone === "GREY"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        altmanZ.zone === "SAFE"
                          ? "bg-emerald-400"
                          : altmanZ.zone === "GREY"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    {altmanZ.zone} ZONE
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
                    BYPASS
                  </span>
                )}
              </div>

              {altmanZ?.is_applicable ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-extrabold text-[var(--text-1)] tabular-nums">
                      {altmanZ.score != null ? altmanZ.score.toFixed(2) : <MissingValue reason="Insufficient balance sheet facts" />}
                    </span>
                    <span className="text-xs text-[var(--text-2)]">
                      {altmanZ.zone === "SAFE" && "Safe Zone: Low 2-year insolvency probability (>2.90)"}
                      {altmanZ.zone === "GREY" && "Grey Zone: Ambiguous financial health (1.23 – 2.90)"}
                      {altmanZ.zone === "DISTRESS" && "Distress Zone: Elevated balance sheet risk (<1.23)"}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-2)] bg-[var(--bg-elevated)]/60 rounded-lg p-2.5 border border-white/5">
                    {altmanZ.interpretation}
                  </p>

                  {/* Components breakdown */}
                  {altmanZ.components && Object.keys(altmanZ.components).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)] text-xs">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[var(--text-3)]">Working Capital / Assets:</span>
                        <span className="font-mono font-medium text-[var(--text-1)]">
                          {formatRatio(altmanZ.components["working_capital_to_assets"])}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[var(--text-3)]">Retained Earnings / Assets:</span>
                        <span className="font-mono font-medium text-[var(--text-1)]">
                          {formatRatio(altmanZ.components["retained_earnings_to_assets"])}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-3)]">EBIT / Assets:</span>
                        <span className="font-mono font-medium text-[var(--text-1)]">
                          {formatRatio(altmanZ.components["ebit_to_assets"])}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-3)]">Book Equity / Liabilities:</span>
                        <span className="font-mono font-medium text-[var(--text-1)]">
                          {formatRatio(altmanZ.components["equity_to_liabilities"])}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-[var(--bg-elevated)] p-4 text-xs text-[var(--text-3)] space-y-2">
                  <p className="text-[var(--text-2)] font-medium">
                    {altmanZ?.interpretation}
                  </p>
                  <p className="text-[11px]">
                    Banks fund balance sheets with customer deposits rather than commercial debt. Applying corporate insolvency formulas to banks yields false distress classifications.
                  </p>
                </div>
              )}
            </div>

            {/* 1B: Piotroski F-Score Card */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-[var(--accent-2)]" />
                    <h4 className="text-sm font-bold text-[var(--text-1)]">
                      Piotroski 9-Factor F-Score
                    </h4>
                  </div>
                  <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                    Fundamental Quality & Financial Trend Indicator
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    piotroskiF?.rating === "VERY_STRONG"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : piotroskiF?.rating === "MODERATE"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {piotroskiF?.rating.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-extrabold text-[var(--text-1)] tabular-nums">
                  {piotroskiF?.score != null ? `${piotroskiF.score} / ${piotroskiF.max_score}` : <MissingValue reason="Insufficient multi-year facts" />}
                </span>
                <span className="text-xs text-[var(--text-2)]">
                  {piotroskiF?.summary}
                </span>
              </div>

              {/* 3 Pillar Summary Strip */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-[var(--bg-elevated)] p-2 border border-white/5">
                  <div className="text-[10px] text-[var(--text-3)] uppercase font-semibold">Profitability</div>
                  <div className="mt-1 font-mono font-bold text-[var(--text-1)]">
                    {piotroskiF?.profitability_score} / 4
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-elevated)] p-2 border border-white/5">
                  <div className="text-[10px] text-[var(--text-3)] uppercase font-semibold">Leverage</div>
                  <div className="mt-1 font-mono font-bold text-[var(--text-1)]">
                    {piotroskiF?.leverage_score} / 3
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-elevated)] p-2 border border-white/5">
                  <div className="text-[10px] text-[var(--text-3)] uppercase font-semibold">Efficiency</div>
                  <div className="mt-1 font-mono font-bold text-[var(--text-1)]">
                    {piotroskiF?.efficiency_score} / 2
                  </div>
                </div>
              </div>

              {/* Detailed Factors Toggle */}
              {piotroskiF?.factors && Object.keys(piotroskiF.factors).length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setShowPiotroskiFactors(!showPiotroskiFactors)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    <span>{showPiotroskiFactors ? "Hide Factor Breakdown" : "View 9-Factor Audit Breakdown"}</span>
                    {showPiotroskiFactors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showPiotroskiFactors && (
                    <div className="mt-3 space-y-1.5 text-xs max-h-56 overflow-y-auto pr-1">
                      {Object.entries(piotroskiF.factors).map(([key, item]) => {
                        const passed = item.score > 0;
                        return (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-2 rounded bg-[var(--bg-elevated)]/50 p-2 border border-white/5"
                          >
                            <div className="flex items-start gap-2">
                              {passed ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                              ) : (
                                <XCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                              )}
                              <span className="text-[var(--text-2)]">{item.description}</span>
                            </div>
                            <span
                              className={`font-mono font-bold text-xs ${
                                passed ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              +{item.score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: DUPONT 3-STAGE ROE DECOMPOSITION */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[var(--accent)]" />
                  <h4 className="text-base font-extrabold text-[var(--text-1)]">
                    3-Stage DuPont ROE Decomposition
                  </h4>
                </div>
                <p className="text-xs text-[var(--text-3)] mt-0.5">
                  Deconstructs Return on Equity into Operating Profitability, Asset Productivity, and Capital Structure
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[var(--text-3)]">Reported Return on Equity: </span>
                <span className="font-mono text-base font-extrabold text-[var(--accent)] tabular-nums ml-1">
                  {ratios.profitability.return_on_equity_pct != null
                    ? formatPercent(ratios.profitability.return_on_equity_pct)
                    : <MissingValue reason="Negative or zero equity" />}
                </span>
              </div>
            </div>

            {/* Formula Banner Pipeline */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Step 1: Net Margin */}
              <div className="rounded-xl border border-white/5 bg-[var(--bg-elevated)] p-4 relative">
                <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
                  1. Net Profit Margin
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold text-[var(--text-1)] tabular-nums">
                  {ratios.profitability.dupont.net_profit_margin_pct != null
                    ? formatPercent(ratios.profitability.dupont.net_profit_margin_pct)
                    : <MissingValue reason="Missing Revenue / PAT" />}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-2)]">
                  Operating pricing power & cost discipline (PAT ÷ Revenue)
                </p>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-base)] border border-white/10 text-xs font-bold text-[var(--accent)]">
                  ×
                </div>
              </div>

              {/* Step 2: Asset Turnover */}
              <div className="rounded-xl border border-white/5 bg-[var(--bg-elevated)] p-4 relative">
                <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
                  2. Asset Turnover
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold text-[var(--text-1)] tabular-nums">
                  {ratios.profitability.dupont.asset_turnover != null
                    ? formatRatio(ratios.profitability.dupont.asset_turnover)
                    : <MissingValue reason="Missing Total Assets" />}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-2)]">
                  Capital asset velocity (Revenue ÷ Total Assets)
                </p>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-base)] border border-white/10 text-xs font-bold text-[var(--accent)]">
                  ×
                </div>
              </div>

              {/* Step 3: Financial Leverage */}
              <div className="rounded-xl border border-white/5 bg-[var(--bg-elevated)] p-4 relative">
                <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider">
                  3. Equity Multiplier
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold text-[var(--text-1)] tabular-nums">
                  {ratios.profitability.dupont.financial_leverage != null
                    ? formatRatio(ratios.profitability.dupont.financial_leverage)
                    : <MissingValue reason="Missing Equity" />}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-2)]">
                  Balance sheet leverage ratio (Assets ÷ Total Equity)
                </p>
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-base)] border border-white/10 text-xs font-bold text-[var(--accent)]">
                  =
                </div>
              </div>

              {/* Step 4: Decomposed ROE */}
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                  Calculated ROE
                </div>
                <div className="mt-2 font-mono text-2xl font-extrabold text-[var(--accent)] tabular-nums">
                  {ratios.profitability.dupont.calculated_roe_pct != null
                    ? formatPercent(ratios.profitability.dupont.calculated_roe_pct)
                    : <MissingValue reason="Calculation unavailable" />}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-2)]">
                  Net Margin × Asset Turnover × Leverage
                </p>
              </div>
            </div>

            {/* DuPont Institutional Takeaway */}
            <div className="rounded-lg bg-[var(--bg-elevated)]/40 p-3 text-xs text-[var(--text-2)] border border-white/5">
              <span className="font-bold text-[var(--text-1)]">Analytical Takeaway: </span>
              {ratios.profitability.dupont.financial_leverage && ratios.profitability.dupont.financial_leverage > 3.0 ? (
                <span>
                  High financial leverage ({ratios.profitability.dupont.financial_leverage.toFixed(2)}x) is a substantial contributor to the reported ROE. Review debt serviceability and interest coverage ratios below.
                </span>
              ) : ratios.profitability.dupont.net_profit_margin_pct && ratios.profitability.dupont.net_profit_margin_pct > 15 ? (
                <span>
                  ROE is primarily driven by strong pricing power and healthy operating net margin ({ratios.profitability.dupont.net_profit_margin_pct.toFixed(1)}%), representing high fundamental earnings quality without excessive debt.
                </span>
              ) : (
                <span>
                  Balanced ROE composition across asset efficiency and margins.
                </span>
              )}
            </div>
          </div>

          {/* SECTION 3: COMPOUNDED GROWTH & RETURN METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 3A: Multi-Year CAGR & Growth */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--up)]" />
                <h4 className="text-sm font-bold text-[var(--text-1)]">
                  Compounded Growth (CAGR) & YoY Momentum
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-3)]">
                      <th className="pb-2 font-medium">Metric</th>
                      <th className="pb-2 text-right font-medium">YoY %</th>
                      <th className="pb-2 text-right font-medium">3Y CAGR</th>
                      <th className="pb-2 text-right font-medium">5Y CAGR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-[var(--text-2)]">Revenue / Income</td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.revenue_yoy_pct != null
                          ? formatPercent(ratios.growth.revenue_yoy_pct)
                          : <MissingValue reason="Insufficient YoY history" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--accent)]">
                        {ratios.growth.revenue_cagr_3y != null
                          ? formatPercent(ratios.growth.revenue_cagr_3y)
                          : <MissingValue reason="< 4 fiscal years of data" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.revenue_cagr_5y != null
                          ? formatPercent(ratios.growth.revenue_cagr_5y)
                          : <MissingValue reason="< 6 fiscal years of data" />}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-[var(--text-2)]">EBITDA / Operating</td>
                      <td className="py-2.5 text-right text-[var(--text-3)]">—</td>
                      <td className="py-2.5 text-right font-bold text-[var(--accent)]">
                        {ratios.growth.ebitda_cagr_3y != null
                          ? formatPercent(ratios.growth.ebitda_cagr_3y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.ebitda_cagr_5y != null
                          ? formatPercent(ratios.growth.ebitda_cagr_5y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-[var(--text-2)]">Net Profit (PAT)</td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.pat_yoy_pct != null
                          ? formatPercent(ratios.growth.pat_yoy_pct)
                          : <MissingValue reason="Insufficient YoY history" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--accent)]">
                        {ratios.growth.pat_cagr_3y != null
                          ? formatPercent(ratios.growth.pat_cagr_3y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.pat_cagr_5y != null
                          ? formatPercent(ratios.growth.pat_cagr_5y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-[var(--text-2)]">Earnings Per Share (EPS)</td>
                      <td className="py-2.5 text-right text-[var(--text-3)]">—</td>
                      <td className="py-2.5 text-right font-bold text-[var(--accent)]">
                        {ratios.growth.eps_cagr_3y != null
                          ? formatPercent(ratios.growth.eps_cagr_3y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                      <td className="py-2.5 text-right font-bold text-[var(--text-1)]">
                        {ratios.growth.eps_cagr_5y != null
                          ? formatPercent(ratios.growth.eps_cagr_5y)
                          : <MissingValue reason="Base year <= 0 or missing" />}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3B: Margins & Return on Capital */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-[var(--accent-2)]" />
                <h4 className="text-sm font-bold text-[var(--text-1)]">
                  Operating Margins & Capital Returns
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Operating Margin (EBIT %)</div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-1)]">
                    {ratios.profitability.operating_margin_pct != null
                      ? formatPercent(ratios.profitability.operating_margin_pct)
                      : <MissingValue reason="Missing EBIT or Revenue" />}
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">EBITDA Margin %</div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--text-1)]">
                    {ratios.profitability.ebitda_margin_pct != null
                      ? formatPercent(ratios.profitability.ebitda_margin_pct)
                      : <MissingValue reason="Missing EBITDA" />}
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Return on Capital (ROCE)</div>
                  <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                    {ratios.profitability.return_on_capital_employed_pct != null
                      ? formatPercent(ratios.profitability.return_on_capital_employed_pct)
                      : <MissingValue reason="Missing Capital Employed" />}
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Return on Assets (ROA)</div>
                  <div className="mt-1 font-mono text-lg font-bold text-[var(--accent)]">
                    {ratios.profitability.return_on_assets_pct != null
                      ? formatPercent(ratios.profitability.return_on_assets_pct)
                      : <MissingValue reason="Missing Assets" />}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text-3)]">
                ROCE measures pre-tax operating earnings against total capital employed (Equity + Debt). An institutional benchmark is ROCE &gt; 15%.
              </div>
            </div>
          </div>

          {/* SECTION 4: CAPITAL STRUCTURE & EFFICIENCY (OR BANKING REGULATORY METRICS) */}
          {isFinancialSector ? (
            /* 4A: Banking Metrics */
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-sky-400" />
                  <h4 className="text-sm font-bold text-[var(--text-1)]">
                    Banking & NBFC Operating Metrics
                  </h4>
                </div>
                <span className="text-[11px] text-[var(--text-3)]">
                  RBI Basel-III & Regulatory Mandates
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Net Interest Margin (NIM)</div>
                  <div className="mt-1 font-mono text-base font-bold text-[var(--text-1)]">
                    {ratios.banking.net_interest_margin_pct != null
                      ? formatPercent(ratios.banking.net_interest_margin_pct)
                      : <MissingValue reason="NII or Total Assets missing" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">NII ÷ Earning Assets</div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">CASA Deposit Ratio %</div>
                  <div className="mt-1 font-mono text-base font-bold text-sky-400">
                    {ratios.banking.casa_ratio_pct != null
                      ? formatPercent(ratios.banking.casa_ratio_pct)
                      : <MissingValue reason="CASA deposits not itemized" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">Low-cost funding franchise</div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Gross NPA %</div>
                  <div className="mt-1 font-mono text-base font-bold text-amber-400">
                    {ratios.banking.gross_npa_pct != null
                      ? formatPercent(ratios.banking.gross_npa_pct)
                      : <MissingValue reason="GNPA not reported in filing" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">Asset stress indicator</div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Net NPA %</div>
                  <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                    {ratios.banking.net_npa_pct != null
                      ? formatPercent(ratios.banking.net_npa_pct)
                      : <MissingValue reason="NNPA not reported" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">Net non-performing loans</div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Cost-to-Income %</div>
                  <div className="mt-1 font-mono text-base font-bold text-[var(--text-1)]">
                    {ratios.banking.cost_to_income_pct != null
                      ? formatPercent(ratios.banking.cost_to_income_pct)
                      : <MissingValue reason="Opex or Total Income missing" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">Operational efficiency</div>
                </div>

                <div className="rounded-lg bg-[var(--bg-elevated)] p-3 border border-white/5">
                  <div className="text-[11px] text-[var(--text-3)]">Capital Adequacy (CAR)</div>
                  <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                    {ratios.banking.capital_adequacy_ratio_pct != null
                      ? formatPercent(ratios.banking.capital_adequacy_ratio_pct)
                      : <MissingValue reason="CAR not reported" />}
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--text-3)]">RBI mandate: &ge; 11.5%</div>
                </div>
              </div>
            </div>
          ) : (
            /* 4B: Industrial Solvency & Cash Conversion Cycle */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Solvency */}
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-[var(--accent)]" />
                  <h4 className="text-sm font-bold text-[var(--text-1)]">
                    Solvency & Leverage Ratios
                  </h4>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-white/5">
                    <div>
                      <div className="font-semibold text-[var(--text-1)]">Debt to Equity (D/E)</div>
                      <div className="text-[11px] text-[var(--text-3)]">Conservative benchmark &lt; 0.50x</div>
                    </div>
                    <div className="font-mono text-base font-bold text-[var(--text-1)]">
                      {ratios.solvency.debt_to_equity != null
                        ? formatRatio(ratios.solvency.debt_to_equity)
                        : <MissingValue reason="Zero or negative equity" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-white/5">
                    <div>
                      <div className="font-semibold text-[var(--text-1)]">Interest Coverage Ratio (ICR)</div>
                      <div className="text-[11px] text-[var(--text-3)]">EBIT ÷ Finance Costs (&gt; 3.0x safe)</div>
                    </div>
                    <div className="font-mono text-base font-bold text-emerald-400">
                      {ratios.solvency.interest_coverage_ratio != null
                        ? formatRatio(ratios.solvency.interest_coverage_ratio)
                        : <MissingValue reason="Zero finance costs / Net Cash" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-white/5">
                    <div>
                      <div className="font-semibold text-[var(--text-1)]">Current Ratio</div>
                      <div className="text-[11px] text-[var(--text-3)]">Current Assets ÷ Current Liabilities</div>
                    </div>
                    <div className="font-mono text-base font-bold text-[var(--text-1)]">
                      {ratios.solvency.current_ratio != null
                        ? formatRatio(ratios.solvency.current_ratio)
                        : <MissingValue reason="Missing balance sheet lines" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-white/5">
                    <div>
                      <div className="font-semibold text-[var(--text-1)]">Quick Ratio (Acid Test)</div>
                      <div className="text-[11px] text-[var(--text-3)]">Excludes Inventories from Current Assets</div>
                    </div>
                    <div className="font-mono text-base font-bold text-[var(--text-1)]">
                      {ratios.solvency.quick_ratio != null
                        ? formatRatio(ratios.solvency.quick_ratio)
                        : <MissingValue reason="Missing balance sheet lines" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Conversion Cycle (Working Capital Efficiency) */}
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--accent-2)]" />
                    <h4 className="text-sm font-bold text-[var(--text-1)]">
                      Cash Conversion Cycle (CCC)
                    </h4>
                  </div>
                  <span className="font-mono text-sm font-extrabold text-[var(--accent-2)]">
                    {ratios.efficiency.cash_conversion_cycle_days != null
                      ? formatDays(ratios.efficiency.cash_conversion_cycle_days)
                      : <MissingValue reason="Working capital breakdown missing" />}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 rounded bg-[var(--bg-elevated)] border border-white/5">
                    <span className="text-[var(--text-3)]">(+) Inventory Days (DIO):</span>
                    <span className="font-mono font-medium text-[var(--text-1)]">
                      {ratios.efficiency.inventory_days != null
                        ? formatDays(ratios.efficiency.inventory_days)
                        : <MissingValue reason="No inventory reported" />}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-[var(--bg-elevated)] border border-white/5">
                    <span className="text-[var(--text-3)]">(+) Debtor Days (DSO):</span>
                    <span className="font-mono font-medium text-[var(--text-1)]">
                      {ratios.efficiency.debtor_days != null
                        ? formatDays(ratios.efficiency.debtor_days)
                        : <MissingValue reason="Receivables not reported" />}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-[var(--bg-elevated)] border border-white/5">
                    <span className="text-[var(--text-3)]">(-) Creditor Days (DPO):</span>
                    <span className="font-mono font-medium text-[var(--text-1)]">
                      {ratios.efficiency.creditor_days != null
                        ? formatDays(ratios.efficiency.creditor_days)
                        : <MissingValue reason="Payables not reported" />}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-[var(--bg-elevated)] border border-white/5">
                    <span className="text-[var(--text-3)]">(=) Working Capital Days:</span>
                    <span className="font-mono font-medium text-[var(--accent)]">
                      {ratios.efficiency.working_capital_days != null
                        ? formatDays(ratios.efficiency.working_capital_days)
                        : <MissingValue reason="Working capital not reported" />}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--text-3)] pt-1">
                  Formula: <span className="font-mono text-[var(--text-2)]">CCC = DIO + DSO - DPO</span>. A shorter or negative cycle indicates strong bargaining power with suppliers and prompt customer collections.
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: HISTORICAL RATIO PROGRESSION TREND */}
          {ratios.historical_trend && ratios.historical_trend.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-1)]">
                    Historical Financial Ratio Progression
                  </h4>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">
                    Year-on-year fundamental trajectory across audited fiscal filings
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-medium">
                      <th className="pb-2">Fiscal Period</th>
                      <th className="pb-2 text-right">Operating Margin</th>
                      <th className="pb-2 text-right">Net Profit Margin</th>
                      <th className="pb-2 text-right">ROE %</th>
                      <th className="pb-2 text-right">ROCE %</th>
                      {!isFinancialSector && (
                        <>
                          <th className="pb-2 text-right">Debt to Equity</th>
                          <th className="pb-2 text-right">Interest Cov.</th>
                          <th className="pb-2 text-right">CCC (Days)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {ratios.historical_trend.map((row) => (
                      <tr key={row.period_end} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 font-sans font-bold text-[var(--text-1)]">
                          {row.period_label}
                        </td>
                        <td className="py-2.5 text-right font-medium text-[var(--text-1)]">
                          {row.operating_margin_pct != null
                            ? formatPercent(row.operating_margin_pct)
                            : <MissingValue reason="Missing EBIT" />}
                        </td>
                        <td className="py-2.5 text-right font-medium text-[var(--text-1)]">
                          {row.net_profit_margin_pct != null
                            ? formatPercent(row.net_profit_margin_pct)
                            : <MissingValue reason="Missing PAT" />}
                        </td>
                        <td className="py-2.5 text-right font-bold text-[var(--accent)]">
                          {row.roe_pct != null
                            ? formatPercent(row.roe_pct)
                            : <MissingValue reason="Negative equity" />}
                        </td>
                        <td className="py-2.5 text-right font-bold text-emerald-400">
                          {row.roce_pct != null
                            ? formatPercent(row.roce_pct)
                            : <MissingValue reason="Missing ROCE" />}
                        </td>
                        {!isFinancialSector && (
                          <>
                            <td className="py-2.5 text-right text-[var(--text-1)]">
                              {row.debt_to_equity != null
                                ? formatRatio(row.debt_to_equity)
                                : <MissingValue reason="Zero debt or equity" />}
                            </td>
                            <td className="py-2.5 text-right text-[var(--text-1)]">
                              {row.interest_coverage != null
                                ? formatRatio(row.interest_coverage)
                                : <MissingValue reason="Zero interest expense" />}
                            </td>
                            <td className="py-2.5 text-right text-[var(--text-2)]">
                              {row.cash_conversion_cycle_days != null
                                ? formatDays(row.cash_conversion_cycle_days)
                                : <MissingValue reason="Incomplete WC lines" />}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
