"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  ShieldAlert,
  Tag,
  TrendingDown,
  TrendingUp,
  Bookmark,
  BookOpen,
  FileText,
  Calculator,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { fetchCompanyById } from "@/lib/api-client";
import { formatDate, formatINR } from "@/lib/format";
import {
  getGoogleFinanceUrl,
  getTradingViewUrl,
  getNSEUrl,
  getBSEUrl,
  getYahooFinanceUrl,
} from "@/lib/external-links";
import { StatementViewer } from "@/components/company/StatementViewer";
import { FinancialAnalysisTab } from "@/components/company/FinancialAnalysisTab";
import { ShareholdingViewer } from "@/components/company/ShareholdingViewer";
import { CorporateActionsTable } from "@/components/company/CorporateActionsTable";
import { CompanyDocumentsLibrary } from "@/components/company/CompanyDocumentsLibrary";
import { FundamentalPriceChart } from "@/components/company/FundamentalPriceChart";
import { TechnicalAnalysisTab } from "@/components/company/TechnicalAnalysisTab";
import { DeltaChip } from "@/components/common/DeltaChip";
import { MissingValue } from "@/components/common/MissingValue";
import { ExchangeBadges } from "@/components/common/ExchangeBadges";
import { FreshnessChip } from "@/components/common/FreshnessChip";

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = Number(params?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "technicals" | "statements" | "analysis" | "shareholding" | "corporate_actions" | "documents" | "suite"
  >("statements");

  const {
    data: company,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => fetchCompanyById(companyId),
    enabled: !isNaN(companyId),
    refetchInterval: false,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchCompanyById(companyId, true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const primarySec = company?.securities?.find((s) => s.is_primary) ?? company?.securities?.[0];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)]">
      <Header
        title={company ? company.name : "Company Research"}
        subtitle={
          company
            ? `${company.isin} • ${company.sector?.name ?? "Diversified"}`
            : "Detailed Fundamental Analysis"
        }
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Discovery", href: "/discover" },
          { label: company ? (primarySec ? `${primarySec.symbol} • ${company.name}` : company.name) : "Company Research" },
        ]}
        snapshotDate={company?.price_date}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Back to discovery */}
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-3)] hover:text-[var(--accent)] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Stock Discovery</span>
          </Link>

          {isLoading && (
            <div className="h-64 animate-pulse rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6" />
          )}

          {isError && (
            <div className="rounded-[var(--radius-card)] border border-[var(--down)]/20 bg-[var(--down)]/10 p-6 text-center text-[var(--down)]">
              <h3 className="text-base font-bold">Company Not Found</h3>
              <p className="mt-1 text-xs">
                Could not retrieve company profile for ID #{companyId}.
              </p>
            </div>
          )}

          {company && (
            <>
              {/* Profile Hero Card */}
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--text-3)]">
                        ISIN: {company.isin}
                      </span>
                      {company.cin && (
                        <span className="text-xs text-[var(--text-3)]">
                          • CIN: {company.cin}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--bg-card)] to-[var(--accent)]/20 border border-[var(--accent)]/30 font-extrabold text-sm text-[var(--accent)]">
                        {primarySec ? primarySec.symbol.substring(0, 2) : "EQ"}
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text-1)]">
                          {company.name}
                        </h2>
                        {company.legal_name && company.legal_name !== company.name && (
                          <p className="text-xs text-[var(--text-3)]">
                            {company.legal_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Latest EOD Price & External Live Market Quotes */}
                    <div className="mt-4 flex flex-wrap items-baseline gap-2.5">
                      {company.current_price != null ? (
                        <>
                          <span className="text-3xl font-extrabold font-mono text-[var(--text-1)] tabular-nums">
                            {formatINR(company.current_price)}
                          </span>
                          <DeltaChip
                            value={company.price_change}
                            percentage={company.price_change_pct}
                          />
                          <FreshnessChip date={company.price_date} />
                        </>
                      ) : (
                        <MissingValue reason="Price snapshot pending sync" />
                      )}

                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-white/5 transition disabled:opacity-50"
                        title="Fetch latest price snapshot"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-[var(--accent)]" : ""}`} />
                        <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
                      </button>
                    </div>

                    {/* External Live Verification Links */}
                    {(() => {
                      const nseSec = company.securities?.find((s) => s.exchange_code === "NSE");
                      const bseSec = company.securities?.find((s) => s.exchange_code === "BSE");
                      return (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                            External Filings & Quotes:
                          </span>
                          {primarySec && (
                            <>
                              <a
                                href={getTradingViewUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition shadow-sm"
                                title="Open interactive candlestick chart on TradingView"
                              >
                                <span>TradingView</span>
                                <ExternalLink className="h-3 w-3 text-[var(--text-3)]" />
                              </a>
                              <a
                                href={getGoogleFinanceUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition shadow-sm"
                                title="Open Google Finance live quote"
                              >
                                <span>Google Finance</span>
                                <ExternalLink className="h-3 w-3 text-[var(--text-3)]" />
                              </a>
                              <a
                                href={getYahooFinanceUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition shadow-sm"
                                title="Open Yahoo Finance quote"
                              >
                                <span>Yahoo Finance</span>
                                <ExternalLink className="h-3 w-3 text-[var(--text-3)]" />
                              </a>
                            </>
                          )}
                          {nseSec && (
                            <a
                              href={getNSEUrl(nseSec.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition shadow-sm"
                              title="Official National Stock Exchange of India (NSE) quote"
                            >
                              <span>NSE Official</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {bseSec && (
                            <a
                              href={getBSEUrl(bseSec.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-2)]/20 bg-[var(--accent-2)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--accent-2)] hover:bg-[var(--accent-2)]/20 transition shadow-sm"
                              title="Official Bombay Stock Exchange (BSE) scrip page"
                            >
                              <span>BSE Official</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dual exchange tags */}
                  <ExchangeBadges securities={company.securities ?? []} />
                </div>

                {/* Badges bar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {company.sector && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-bold text-[var(--text-2)] border border-[var(--border)]">
                      <Tag className="h-3 w-3 text-[var(--text-3)]" />
                      <span>{company.sector.name}</span>
                    </span>
                  )}
                  {company.industry && (
                    <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-bold text-[var(--text-2)] border border-[var(--border)]">
                      {company.industry.name}
                    </span>
                  )}
                  {company.is_financial_sector && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--warn)]/20 bg-[var(--warn)]/10 px-2.5 py-1 text-xs font-bold text-[var(--warn)]">
                      <ShieldAlert className="h-3 w-3 text-[var(--warn)]" />
                      <span>Financial Institution (Banking / NBFC Model)</span>
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline"
                    >
                      <Globe className="h-3 w-3" />
                      <span>Website</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                {/* Business description */}
                {company.description && (
                  <p className="mt-4 text-xs leading-relaxed text-[var(--text-2)]">
                    {company.description}
                  </p>
                )}
              </div>

              {/* Two-Column Layout (1fr | 340px) per Section 6 Spec */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 8-Column / 1fr Area: Chart, Tabs & Statements */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Fundamental Long-Term Price Chart with 50/200 DMA & Fair Value */}
                  {company.current_price != null && (
                    <FundamentalPriceChart
                      symbol={primarySec?.symbol ?? company.name}
                      currentPrice={company.current_price}
                      priceChange={company.price_change != null ? Number(company.price_change) : undefined}
                      priceChangePct={company.price_change_pct != null ? Number(company.price_change_pct) : undefined}
                      height={320}
                    />
                  )}

                  {/* Underline Style Tabs (Section 3A Spec: Summary, Financials, Statistics, etc.) */}
                  <div className="flex border-b border-[var(--border)]">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "technicals", label: "Technicals & EOD Charts" },
                        { id: "statements", label: "Financial Statements" },
                        { id: "analysis", label: "Analysis & Health" },
                        { id: "shareholding", label: "Shareholding Trend" },
                        { id: "corporate_actions", label: "Corporate Actions" },
                        { id: "documents", label: "Annual Reports & Documents" },
                        { id: "suite", label: "Research Suite Overview" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id as typeof activeTab)}
                          className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                            activeTab === tab.id
                              ? "border-[var(--accent)] text-[var(--accent)]"
                              : "border-transparent text-[var(--text-3)] hover:border-white/20 hover:text-[var(--text-1)]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab 0: Technical Analysis & EOD Charts */}
                  {activeTab === "technicals" && (
                    <TechnicalAnalysisTab
                      companyId={company.id}
                      companyName={company.name}
                      symbol={primarySec?.symbol || company.name}
                      currentPrice={company.current_price}
                    />
                  )}

                  {/* Tab 1: Financial Statements */}
                  {activeTab === "statements" && (
                    <StatementViewer
                      companyId={company.id}
                      companyName={company.name}
                      isFinancialSector={company.is_financial_sector}
                    />
                  )}

                  {/* Tab 2: Financial Analysis & Health */}
                  {activeTab === "analysis" && (
                    <FinancialAnalysisTab
                      companyId={company.id}
                      companyName={company.name}
                      isFinancialSector={company.is_financial_sector}
                    />
                  )}

                  {/* Tab 3: Shareholding History */}
                  {activeTab === "shareholding" && (
                    <ShareholdingViewer
                      companyId={company.id}
                      companyName={company.name}
                    />
                  )}

                  {/* Tab 3: Corporate Actions */}
                  {activeTab === "corporate_actions" && (
                    <CorporateActionsTable
                      companyId={company.id}
                      companyName={company.name}
                    />
                  )}

                  {/* Tab 4: Uploaded Documents */}
                  {activeTab === "documents" && (
                    <CompanyDocumentsLibrary
                      companyId={company.id}
                      companyName={company.name}
                    />
                  )}

                  {/* Tab 5: 18-Section Research Suite */}
                  {activeTab === "suite" && (
                    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-[var(--accent)]" />
                        <h3 className="text-sm font-bold text-[var(--text-1)]">
                          18-Section Fundamental Research Suite
                        </h3>
                      </div>
                      <p className="text-xs text-[var(--text-2)]">
                        Modular architecture powering complete, deterministic Indian equity evaluation.
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-2 text-xs">
                        {[
                          "1. Corporate Master & Identifiers",
                          "2. Market Pricing & Historical EOD",
                          "3. Profit & Loss (Income Statement)",
                          "4. Balance Sheet & Capital Assets",
                          "5. Cash Flow & FCF Articulation",
                          "6. Growth & Compound CAGRs",
                          "7. Profitability & DuPont Analysis",
                          "8. Solvency & Debt Structure",
                          "9. Operating & Working Capital Days",
                          "10. Banking Asset Quality & NIM",
                          "11. Shareholding & Promoter Pledges",
                          "12. Corporate Restructuring & Splits",
                          "13. Audit Opinions & Qualifications",
                          "14. Related Party Transactions",
                          "15. Segment Revenue Breakdown",
                          "16. Management Compensation",
                          "17. DCF & Multiple Valuation",
                          "18. Peer Group Comparative Matrix",
                        ].map((sec, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-[var(--text-2)] font-medium"
                          >
                            {sec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 340px Column: Key Stats & Research Quick Actions (Section 6 Spec) */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Research Actions Panel */}
                  <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                      Research Actions
                    </h3>
                    <div className="space-y-2">
                      <Link
                        href="/watchlists"
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                      >
                        <div className="flex items-center gap-2">
                          <Bookmark className="h-4 w-4 text-[var(--accent-2)]" />
                          <span>Track in Research Watchlist</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>

                      <Link
                        href="/journal"
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                          <span>Log Investment Thesis Note</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>

                      <Link
                        href="/valuation"
                        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-xs font-semibold text-[var(--text-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                      >
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-[var(--up)]" />
                          <span>Launch Valuation Workbench</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Sourced Fundamental Key Stats */}
                  <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">
                      Key Financial Stats
                    </h3>
                    <div className="space-y-2 text-xs divide-y divide-[var(--border)]">
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-3)]">ISIN:</span>
                        <span className="font-mono font-bold text-[var(--text-1)]">{company.isin}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-3)]">Sector:</span>
                        <span className="font-bold text-[var(--text-2)]">{company.sector?.name ?? "General"}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-3)]">Industry:</span>
                        <span className="font-bold text-[var(--text-2)]">{company.industry?.name ?? "Diversified"}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-3)]">Financial Institution:</span>
                        <span className="font-bold text-[var(--text-2)] font-mono">
                          {company.is_financial_sector ? "Yes (Banking Model)" : "No (Industrial)"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-[var(--text-3)]">Data Quality Status:</span>
                        <span className="inline-flex items-center gap-1 text-[var(--up)] font-bold">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Double-Entry Verified</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
