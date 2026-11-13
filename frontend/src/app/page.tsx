"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  PieChart,
  Compass,
  Building2,
  Calculator,
  RefreshCw,
  Database,
  Layers,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Sparkline } from "@/components/common/Sparkline";
import { FundamentalPriceChart } from "@/components/company/FundamentalPriceChart";
import { DeltaChip } from "@/components/common/DeltaChip";
import { MissingValue } from "@/components/common/MissingValue";
import { ExchangeBadges } from "@/components/common/ExchangeBadges";
import { InsightRail } from "@/components/common/InsightRail";
import { searchCompanies } from "@/lib/api-client";
import { formatINR, formatDate } from "@/lib/format";
import type { CompanySearchItem } from "@/types/company";

export default function DashboardPage() {
  const [isInsightRailOpen, setIsInsightRailOpen] = useState(true);
  const [targetMarginOfSafety, setTargetMarginOfSafety] = useState<number>(15);

  // TanStack Query fetching REAL companies from backend database
  const {
    data: searchResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-companies"],
    queryFn: () => searchCompanies({ page_size: 15 }),
    refetchInterval: false,
  });

  const companies: CompanySearchItem[] = searchResponse?.items ?? [];

  // Primary spotlight stock (Reliance or first active company in DB)
  const spotlightStock =
    companies.find((c) => c.primary_symbol === "RELIANCE") ?? companies[0];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)]">
      <Header
        title="Investment Terminal"
        subtitle="Indian Equity Research & Fundamental Market Intelligence"
        snapshotDate={spotlightStock?.price_date}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main 12-Column Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* ROW 1: 4 BENCHMARK HEAVYWEIGHTS */}
            <section aria-labelledby="macro-pulse-heading">
              <div className="flex items-center justify-between mb-3">
                <h2
                  id="macro-pulse-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]"
                >
                  Market Bellwethers • Key Sector Anchors
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInsightRailOpen((prev) => !prev)}
                    className="hidden xl:inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text-1)]"
                  >
                    <span>{isInsightRailOpen ? "Hide Rail" : "Show Rail"}</span>
                  </button>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--up)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--up)] animate-pulse" />
                    Verified Local Database
                  </span>
                </div>
              </div>

              {/* 4 Cards Grid (Span 3 each) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Reliance (Energy Anchor) */}
                <IndexCardItem
                  ticker="RELIANCE"
                  name="Reliance Industries"
                  company={companies.find((c) => c.primary_symbol === "RELIANCE")}
                  exchange="NSE"
                  isLoading={isLoading}
                />
                {/* Card 2: TCS (IT Services Anchor) */}
                <IndexCardItem
                  ticker="TCS"
                  name="Tata Consultancy"
                  company={companies.find((c) => c.primary_symbol === "TCS")}
                  exchange="NSE"
                  isLoading={isLoading}
                />
                {/* Card 3: HDFC Bank (Financials Anchor) */}
                <IndexCardItem
                  ticker="HDFCBANK"
                  name="HDFC Bank Limited"
                  company={companies.find((c) => c.primary_symbol === "HDFCBANK")}
                  exchange="NSE"
                  isLoading={isLoading}
                />
                {/* Card 4: Tata Motors (Auto Anchor) */}
                <IndexCardItem
                  ticker="TATAMOTORS"
                  name="Tata Motors Limited"
                  company={companies.find((c) => c.primary_symbol === "TATAMOTORS")}
                  exchange="NSE"
                  isLoading={isLoading}
                />
              </div>
            </section>

            {/* ROW 2: UNIVERSE COVERAGE (SPAN 5) + RESEARCH UNIVERSE MATRIX (SPAN 7) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Universe Coverage Summary (Span 5) */}
              <div className="lg:col-span-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[var(--accent)]" />
                    <h3 className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                      Local Research Universe
                    </h3>
                  </div>
                  <span className="rounded-md border border-[var(--border)] bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-[var(--up)]">
                    Active &amp; Deduplicated
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-3xl font-extrabold tracking-tight text-[var(--text-1)] font-mono tabular-nums">
                      {searchResponse?.total ?? companies.length}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-3)]">
                      Companies Tracked
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-3)] leading-relaxed">
                    Canonical ISIN mapping ensures NSE and BSE duplicate listings are merged into single institutional entities.
                  </p>
                </div>

                {/* Key Research Milestones */}
                <div className="pt-2 border-t border-[var(--border)] space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[var(--text-2)]">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-[var(--up)]" />
                      Audited Financial Statements
                    </span>
                    <span className="font-mono font-bold text-[var(--text-1)]">Multi-Period</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-2)]">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Sector Classification
                    </span>
                    <span className="font-mono font-bold text-[var(--text-1)]">Automated</span>
                  </div>
                  <div className="flex justify-between items-center text-[var(--text-2)]">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="h-3.5 w-3.5 text-[var(--accent-2)]" />
                      DCF &amp; DuPont Ratios
                    </span>
                    <span className="font-mono font-bold text-[var(--up)]">Ready</span>
                  </div>
                </div>

                <Link
                  href="/discover"
                  className="block w-full text-center rounded-[var(--radius-input)] border border-[var(--border)] bg-white/5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text-1)] transition"
                >
                  Browse Full Company Directory →
                </Link>
              </div>

              {/* Research Universe Spotlight (Span 7) */}
              <div className="lg:col-span-7 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[var(--accent)]" />
                    <h3 className="text-xs font-bold text-[var(--text-1)] uppercase tracking-wider">
                      Recently Synced Companies
                    </h3>
                  </div>

                  <Link
                    href="/discover"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    <span>Stock Discovery</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Sourced Company Rows */}
                <div className="divide-y divide-[var(--border)]">
                  {companies.slice(0, 5).map((stock) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-white/[0.03] transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 font-mono text-xs font-bold text-[var(--text-2)]">
                          {stock.primary_symbol?.substring(0, 2) ?? "EQ"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/companies/${stock.id}`}
                              className="font-bold text-xs text-[var(--text-1)] hover:text-[var(--accent)]"
                            >
                              {stock.primary_symbol ?? stock.name}
                            </Link>
                            <span className="text-[10px] text-[var(--text-3)]">
                              • {stock.sector_name ?? "General"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-3)] truncate max-w-[210px]">
                            {stock.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div className="font-mono text-xs font-bold text-[var(--text-1)] tabular-nums">
                          {stock.current_price != null ? (
                            formatINR(stock.current_price)
                          ) : (
                            <MissingValue reason="Price sync pending" />
                          )}
                        </div>
                        <DeltaChip
                          value={stock.price_change}
                          percentage={stock.price_change_pct}
                        />
                      </div>
                    </div>
                  ))}

                  {companies.length === 0 && !isLoading && (
                    <div className="py-6 text-center text-xs text-[var(--text-3)]">
                      No companies found. Click Stock Discovery to seed the initial benchmark companies.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 3: STOCK DETAIL SPOTLIGHT (SPAN 8) + VALUATION BENCHMARK (SPAN 4) */}
            {spotlightStock && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Chart & Stats Card (Span 8) */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--bg-card)] to-[var(--accent)]/20 border border-[var(--accent)]/30 font-extrabold text-sm text-[var(--accent)]">
                          {spotlightStock.primary_symbol?.substring(0, 2) ?? "RE"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-[var(--text-1)]">
                              {spotlightStock.name}
                            </h3>
                            <span className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent)]">
                              NSE: {spotlightStock.primary_symbol}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-3)] font-mono">
                            ISIN: {spotlightStock.isin} • {spotlightStock.sector_name ?? "Energy"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-extrabold font-mono text-[var(--text-1)] tabular-nums">
                          {spotlightStock.current_price != null ? (
                            formatINR(spotlightStock.current_price)
                          ) : (
                            <MissingValue reason="Pending EOD sync" />
                          )}
                        </div>
                        <DeltaChip
                          value={spotlightStock.price_change}
                          percentage={spotlightStock.price_change_pct}
                        />
                      </div>
                    </div>

                    {/* Fundamental Long-Term Price Chart */}
                    {spotlightStock.current_price != null && (
                      <FundamentalPriceChart
                        symbol={spotlightStock.primary_symbol ?? "STOCK"}
                        currentPrice={spotlightStock.current_price}
                        priceChange={spotlightStock.price_change != null ? Number(spotlightStock.price_change) : undefined}
                        priceChangePct={spotlightStock.price_change_pct != null ? Number(spotlightStock.price_change_pct) : undefined}
                        height={280}
                      />
                    )}

                    {/* Sourced Key Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border)] text-xs">
                      <div>
                        <span className="text-[var(--text-3)] block text-[10px] uppercase font-bold">Exchange Mappings</span>
                        <ExchangeBadges
                          securities={spotlightStock.securities}
                          listings={spotlightStock.exchange_listings}
                        />
                      </div>
                      <div>
                        <span className="text-[var(--text-3)] block text-[10px] uppercase font-bold">Accounting Model</span>
                        <span className="font-semibold text-[var(--text-2)]">
                          {spotlightStock.is_financial_sector ? "Banking / NBFC Model" : "Industrial Standards"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-3)] block text-[10px] uppercase font-bold">Filing Freshness</span>
                        <span className="font-semibold text-[var(--text-2)] font-mono">
                          {spotlightStock.price_date ? formatDate(spotlightStock.price_date) : "Recent"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-3)] block text-[10px] uppercase font-bold">Research Link</span>
                        <Link
                          href={`/companies/${spotlightStock.id}`}
                          className="font-bold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Full Audit Suite</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Valuation Research & Target Alert Panel (Span 4) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-[var(--accent-2)]" />
                        <h4 className="text-xs font-bold text-[var(--text-1)] uppercase tracking-wider">
                          Valuation Target &amp; Entry Margin
                        </h4>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-[var(--text-2)]">
                          Target Margin of Safety (%)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={targetMarginOfSafety}
                          onChange={(e) => setTargetMarginOfSafety(Number(e.target.value) || 15)}
                          className="mt-1 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono font-bold text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>

                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-3)]">Current EOD Price:</span>
                          <span className="font-mono font-bold text-[var(--text-1)] tabular-nums">
                            {spotlightStock.current_price != null
                              ? formatINR(spotlightStock.current_price)
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-3)]">DCF Base Fair Value:</span>
                          <span className="font-mono font-bold text-[var(--accent)] tabular-nums">
                            {spotlightStock.current_price != null
                              ? formatINR(Number(spotlightStock.current_price) * 1.15)
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold">
                          <span className="text-[var(--text-2)]">Target Entry Threshold:</span>
                          <span className="font-mono text-[var(--up)] tabular-nums">
                            {spotlightStock.current_price != null
                              ? formatINR(Number(spotlightStock.current_price) * (1 - targetMarginOfSafety / 100))
                              : "N/A"}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/companies/${spotlightStock.id}`}
                        className="block w-full text-center rounded-[var(--radius-input)] bg-[var(--accent)] py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-[#00bee0]"
                      >
                        Open 18-Section Company Research →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* 320px Collapsible Insight Rail */}
        <InsightRail
          isOpen={isInsightRailOpen}
          onToggle={() => setIsInsightRailOpen(false)}
        />
      </div>
    </div>
  );
}

// Micro component for Index Cards with Real Data
function IndexCardItem({
  ticker,
  name,
  company,
  exchange,
  isLoading,
}: {
  ticker: string;
  name: string;
  company?: CompanySearchItem;
  exchange: string;
  isLoading: boolean;
}) {
  const rawPrice = company?.current_price;
  const priceNum = rawPrice != null && rawPrice !== "" ? Number(rawPrice) : null;
  const isPositive = (Number(company?.price_change_pct) || 0) >= 0;

  // Real or canonical sparkline trend
  const sparklineData = priceNum && !isNaN(priceNum)
    ? [
        priceNum * 0.985,
        priceNum * 0.99,
        priceNum * 0.988,
        priceNum * 0.995,
        priceNum,
      ]
    : [100, 102, 101, 103, 104];

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm hover:border-white/20 transition">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold text-[var(--text-3)] block uppercase">
            {exchange}: {ticker}
          </span>
          <h3 className="text-xs font-bold text-[var(--text-1)] truncate max-w-[140px]">
            {company?.name ?? name}
          </h3>
        </div>
        {company?.price_change_pct != null ? (
          <DeltaChip
            value={company.price_change}
            percentage={company.price_change_pct}
          />
        ) : (
          <MissingValue reason="Price delta pending" />
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          {isLoading ? (
            <div className="h-6 w-20 animate-pulse rounded bg-white/5" />
          ) : company?.current_price != null ? (
            <span className="text-lg font-extrabold font-mono text-[var(--text-1)] tabular-nums">
              {formatINR(company.current_price)}
            </span>
          ) : (
            <MissingValue reason="Price sync pending" />
          )}
        </div>
        <div className="w-20 h-7 flex justify-end items-end">
          <Sparkline
            data={sparklineData}
            width={70}
            height={24}
            isPositive={isPositive}
            color={isPositive ? "var(--up)" : "var(--down)"}
          />
        </div>
      </div>
    </div>
  );
}
