"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { fetchCompanyById } from "@/lib/api-client";
import { formatDate, formatINR } from "@/lib/formatters";
import {
  getGoogleFinanceUrl,
  getTradingViewUrl,
  getNSEUrl,
  getBSEUrl,
  getYahooFinanceUrl,
} from "@/lib/external-links";

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = Number(params?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title={company ? company.name : "Company Research"}
        subtitle={
          company
            ? `${company.isin} • ${company.sector?.name ?? "Diversified"}`
            : "Detailed Fundamental Analysis"
        }
      />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Back to discovery */}
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Stock Discovery</span>
          </Link>

          {isLoading && (
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" />
          )}

          {isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <h3 className="text-base font-semibold">Company Not Found</h3>
              <p className="mt-1 text-xs">
                Could not retrieve company profile for ID #{companyId}.
              </p>
            </div>
          )}

          {company && (
            <>
              {/* Profile Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                        ISIN: {company.isin}
                      </span>
                      {company.cin && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          • CIN: {company.cin}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {company.name}
                    </h2>
                    {company.legal_name && company.legal_name !== company.name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {company.legal_name}
                      </p>
                    )}

                    {/* Latest EOD Price & External Live Market Quotes */}
                    <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                      {company.current_price != null ? (
                        <>
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                            {formatINR(company.current_price)}
                          </span>
                          {company.price_change_pct != null && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                company.price_change_pct >= 0
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              }`}
                            >
                              {company.price_change_pct >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              <span>
                                {company.price_change != null
                                  ? company.price_change >= 0
                                    ? `+₹${company.price_change}`
                                    : `-₹${Math.abs(company.price_change)}`
                                  : ""}
                                {" "}({company.price_change_pct >= 0 ? `+${company.price_change_pct}` : `${company.price_change_pct}`}%)
                              </span>
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            EOD / Delayed Snapshot {company.price_date ? `• As of ${formatDate(company.price_date)}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          Price snapshot pending sync
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                        title="Fetch latest price from provider"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
                        <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
                      </button>
                    </div>

                    {/* External Live Verification Links */}
                    {(() => {
                      const primarySec = company.securities.find((s) => s.is_primary) ?? company.securities[0];
                      const nseSec = company.securities.find((s) => s.exchange_code === "NSE");
                      const bseSec = company.securities.find((s) => s.exchange_code === "BSE");
                      return (
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Live Quotes & Charts:
                          </span>
                          {primarySec && (
                            <>
                              <a
                                href={getTradingViewUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-indigo-400 transition shadow-sm"
                                title="Open interactive candlestick chart on TradingView"
                              >
                                <span>TradingView</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                              <a
                                href={getGoogleFinanceUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-indigo-400 transition shadow-sm"
                                title="Open Google Finance live quote"
                              >
                                <span>Google Finance</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                              <a
                                href={getYahooFinanceUrl(primarySec.symbol, primarySec.exchange_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-indigo-400 transition shadow-sm"
                                title="Open Yahoo Finance quote"
                              >
                                <span>Yahoo Finance</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                            </>
                          )}
                          {nseSec && (
                            <a
                              href={getNSEUrl(nseSec.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 transition shadow-sm"
                              title="Official National Stock Exchange of India (NSE) quote"
                            >
                              <span>NSE Official</span>
                              <ExternalLink className="h-3 w-3 text-blue-500" />
                            </a>
                          )}
                          {bseSec && (
                            <a
                              href={getBSEUrl(bseSec.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50/60 px-2 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300 transition shadow-sm"
                              title="Official Bombay Stock Exchange (BSE) scrip page"
                            >
                              <span>BSE Official</span>
                              <ExternalLink className="h-3 w-3 text-orange-500" />
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dual exchange tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    {company.securities.map((sec) => (
                      <div
                        key={sec.id}
                        className={`rounded-lg px-3 py-1.5 text-xs font-mono font-bold ${
                          sec.exchange_code === "NSE"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                        }`}
                      >
                        {sec.exchange_code}: {sec.symbol}
                        {sec.is_primary && " (Primary)"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges bar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {company.sector && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <Tag className="h-3 w-3 text-slate-400" />
                      <span>{company.sector.name}</span>
                    </span>
                  )}
                  {company.industry && (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {company.industry.name}
                    </span>
                  )}
                  {company.is_financial_sector && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      <ShieldAlert className="h-3 w-3 text-amber-600" />
                      <span>Financial Institution (Banking / NBFC Model)</span>
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      <Globe className="h-3 w-3" />
                      <span>Website</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                {/* Business description */}
                {company.description && (
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {company.description}
                  </p>
                )}
              </div>

              {/* Research Sections Preview (Phase 7 Roadmap integration) */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    18-Section Fundamental Research Suite
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Financial statements (annual/quarterly, standalone/consolidated), financial ratio analysis, DCF valuation, and source provenance will load directly as data pipelines ingest verified disclosures.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {[
                    "Historical Price Chart",
                    "Income Statement",
                    "Balance Sheet",
                    "Cash Flow Statement",
                    "Financial Ratios",
                    "Growth Analysis",
                    "Profitability Analysis",
                    "Financial Health",
                    "Shareholding Pattern",
                    "Corporate Actions",
                    "Peer Comparison",
                    "DCF Valuation",
                  ].map((secTitle) => (
                    <div
                      key={secTitle}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                    >
                      {secTitle}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
