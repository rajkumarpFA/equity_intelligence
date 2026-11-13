"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Building2,
  Tag,
  Filter,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { searchCompanies, fetchSectors, seedBenchmarkUniverse, lookupAndAddCompany, fetchCompanyById } from "@/lib/api-client";
import { formatINR } from "@/lib/format";
import { getTradingViewUrl, getGoogleFinanceUrl } from "@/lib/external-links";
import { Sparkline } from "@/components/common/Sparkline";
import { DeltaChip } from "@/components/common/DeltaChip";
import { MissingValue } from "@/components/common/MissingValue";
import type { CompanySearchItem } from "@/types/company";

export function StockDiscoveryView() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<number | undefined>(undefined);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [page, setPage] = useState(1);
  const [quickAddSymbol, setQuickAddSymbol] = useState("");
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [addStockError, setAddStockError] = useState<string | null>(null);

  const { data: sectors } = useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
  });

  const {
    data: searchResults,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["companies-search", searchTerm, selectedSector, selectedExchange, page],
    queryFn: () =>
      searchCompanies({
        q: searchTerm || undefined,
        sector_id: selectedSector,
        exchange: selectedExchange || undefined,
        page,
        page_size: 15,
      }),
    refetchInterval: false,
  });

  const handleAddStock = async (symbolToAdd: string) => {
    if (!symbolToAdd.trim()) return;
    setIsAddingStock(true);
    setAddStockError(null);
    try {
      await lookupAndAddCompany(symbolToAdd.trim(), selectedExchange || "NSE");
      await queryClient.invalidateQueries({ queryKey: ["companies-search"] });
      setSearchTerm(symbolToAdd.trim().toUpperCase());
      setQuickAddSymbol("");
    } catch (err) {
      setAddStockError(err instanceof Error ? err.message : "Failed to import company from exchange");
    } finally {
      setIsAddingStock(false);
    }
  };

  const seedMutation = useMutation({
    mutationFn: seedBenchmarkUniverse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-search"] });
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar (Mockup Sambucus Theme) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors dark:border-white/[0.08] dark:bg-[#101828]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Search Input */}
          <div className="relative md:col-span-6">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by company name, symbol (RELIANCE, 500325), or ISIN..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-[#00D3F3] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00D3F3] dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-[#131b2e]"
            />
          </div>

          {/* Sector Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedSector ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSector(val ? Number(val) : undefined);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-[#00D3F3] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00D3F3] dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-100 dark:focus:bg-[#131b2e]"
            >
              <option value="">All Sectors</option>
              {sectors?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Exchange Filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <div className="grid grid-cols-3 w-full rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-white/[0.08] dark:bg-[#131b2e]">
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange("");
                  setPage(1);
                }}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  selectedExchange === ""
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange("NSE");
                  setPage(1);
                }}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  selectedExchange === "NSE"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                NSE
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange("BSE");
                  setPage(1);
                }}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  selectedExchange === "BSE"
                    ? "bg-white text-orange-600 shadow-sm dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                BSE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header with Counts & Quick Add Stock */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {isLoading ? "Searching companies..." : `${searchResults?.total ?? 0} Listed Companies Found`}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Canonical records unify multi-exchange listings (NSE &amp; BSE) via verified ISIN codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Import Stock input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddStock(quickAddSymbol);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={quickAddSymbol}
              onChange={(e) => setQuickAddSymbol(e.target.value.toUpperCase())}
              placeholder="Add symbol (e.g. INFY, ITC, SBIN)..."
              className="w-52 rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-mono font-semibold text-slate-900 placeholder-slate-400 focus:border-[#00D3F3] focus:outline-none dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-100 dark:placeholder-slate-500 shadow-sm"
            />
            <button
              type="submit"
              disabled={isAddingStock || !quickAddSymbol.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#00D3F3] px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-[#00bee0] disabled:opacity-40 transition"
              title="Add any stock from exchange master"
            >
              {isAddingStock ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              <span>Add Stock</span>
            </button>
          </form>

          {searchResults?.total === 0 && !isLoading && (
            <button
              type="button"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#131b2e] px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${seedMutation.isPending ? "animate-spin text-[#00D3F3]" : ""}`} />
              <span>Seed Benchmarks</span>
            </button>
          )}
        </div>
      </div>

      {addStockError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-500">
          {addStockError}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-[#101828]"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-500">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <h4 className="mt-2 text-sm font-bold">Unable to fetch company listings</h4>
          <p className="mt-1 text-xs">
            {error instanceof Error ? error.message : "Backend service unavailable"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && searchResults?.items.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-white/[0.08] dark:bg-[#101828]">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
            {searchTerm
              ? `No local company found for "${searchTerm}"`
              : "No listed companies match your filters"}
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchTerm
              ? `Would you like to look up and add "${searchTerm.toUpperCase()}" directly from the exchange master into your database?`
              : "Try adjusting your query, clear the sector filter, or seed the initial benchmark companies."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {searchTerm && (
              <button
                type="button"
                onClick={() => handleAddStock(searchTerm)}
                disabled={isAddingStock}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00D3F3] px-4 py-2 text-xs font-bold text-slate-950 shadow hover:bg-[#00bee0] disabled:opacity-50 transition"
              >
                {isAddingStock ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>
                  {isAddingStock
                    ? `Importing ${searchTerm.toUpperCase()}...`
                    : `Look up & Add "${searchTerm.toUpperCase()}" to Database`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#131b2e] px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${seedMutation.isPending ? "animate-spin text-[#00D3F3]" : ""}`} />
              <span>Load Official Benchmark Companies</span>
            </button>
          </div>
        </div>
      )}

      {/* Company Cards Grid (Mockup Sambucus Cards) */}
      {!isLoading && !isError && searchResults && searchResults.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {searchResults.items.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {searchResults && searchResults.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-white/[0.08]">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {searchResults.page} of {searchResults.total_pages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-300 dark:hover:bg-white/5"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= searchResults.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-[#131b2e] dark:text-slate-300 dark:hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyCard({ company }: { company: CompanySearchItem }) {
  const isDualListed = company.exchange_listings?.includes("NSE") && company.exchange_listings?.includes("BSE");
  const primarySec = company.securities?.find((s) => s.is_primary) ?? company.securities?.[0];
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [priceData, setPriceData] = useState({
    price: company.current_price,
    change: company.price_change,
    changePct: company.price_change_pct,
  });

  const handleRefreshSinglePrice = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      const updated = await fetchCompanyById(company.id, true);
      setPriceData({
        price: updated.current_price,
        change: updated.price_change,
        changePct: updated.price_change_pct,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentPriceNum = priceData.price != null && priceData.price !== "" ? Number(priceData.price) : 100;

  // Mini sparkline trend simulation
  const dummyTrend = [
    currentPriceNum * 0.97,
    currentPriceNum * 0.98,
    currentPriceNum * 0.975,
    currentPriceNum * 0.99,
    currentPriceNum * 0.985,
    currentPriceNum,
  ];

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-white/[0.08] dark:bg-[#101828] dark:hover:border-white/[0.18]">
      <div>
        {/* Top Header: ISIN and Dual-Listing Indicator */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400" title="International Securities Identification Number">
            {company.isin}
          </span>
          {isDualListed ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-[#00E676]"
              title="Canonical company with separate verified NSE and BSE security mappings"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Dual Listed</span>
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-400">
              {company.exchange_listings.join(", ")}
            </span>
          )}
        </div>

        {/* Company Name & Initials Avatar (Mockup Style) */}
        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-extrabold text-xs text-slate-800 ring-1 ring-black/5 dark:bg-[#131b2e] dark:text-[#00D3F3] dark:ring-white/10">
            {company.primary_symbol ? company.primary_symbol.substring(0, 2) : "EQ"}
          </div>
          <div>
            <Link
              href={`/companies/${company.id}`}
              className="block text-sm font-bold text-slate-900 group-hover:text-[#00D3F3] dark:text-white transition"
            >
              {company.name}
            </Link>
            {/* Sector & Industry */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {company.sector_name && (
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {company.sector_name}
                </span>
              )}
              {company.industry_name && (
                <span>• {company.industry_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Accounting Model Alert for Financial Institutions */}
        {company.is_financial_sector && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
            <ShieldCheck className="h-3 w-3" />
            <span>Banking / Financial Model</span>
          </div>
        )}

        {/* Latest Market Price with isolated single-stock refresh and Mini Sparkline */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-[#131b2e]/60">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                Latest EOD
              </span>
              <button
                type="button"
                onClick={handleRefreshSinglePrice}
                disabled={isRefreshing}
                className="text-slate-400 hover:text-[#00D3F3] transition"
                title={`Refresh latest price for ${company.name}`}
              >
                <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin text-[#00D3F3]" : ""}`} />
              </button>
            </div>
            <div className="text-base font-extrabold font-mono text-[var(--text-1)] tabular-nums">
              {priceData.price != null ? (
                formatINR(priceData.price)
              ) : (
                <MissingValue reason="EOD price sync pending" />
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <DeltaChip
              value={priceData.change}
              percentage={priceData.changePct}
            />
            <div className="w-16 h-5">
              <Sparkline
                data={dummyTrend}
                width={65}
                height={20}
                isPositive={Number(priceData.changePct ?? 0) >= 0}
                color={Number(priceData.changePct ?? 0) >= 0 ? "#00E676" : "#F43F5E"}
                showGradient={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Exchange Listings & Research CTA */}
      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {company.securities.map((sec) => (
              <span
                key={sec.id}
                className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-bold ${
                  sec.exchange_code === "NSE"
                    ? "bg-blue-500/10 text-blue-600 dark:text-[#00D3F3]"
                    : "bg-orange-500/10 text-orange-600 dark:text-[#FDC700]"
                }`}
                title={`${sec.exchange_name} (${sec.series})`}
              >
                {sec.exchange_code}: {sec.symbol}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {primarySec && (
              <a
                href={getTradingViewUrl(primarySec.symbol, primarySec.exchange_code)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-slate-400 hover:text-[#00D3F3] transition"
                title="View live interactive chart on TradingView"
                onClick={(e) => e.stopPropagation()}
              >
                TV ↗
              </a>
            )}
            <Link
              href={`/companies/${company.id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#00D3F3] hover:underline"
            >
              <span>Research</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
