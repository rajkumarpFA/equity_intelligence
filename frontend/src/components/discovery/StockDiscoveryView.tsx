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
import { formatINR } from "@/lib/formatters";
import { getTradingViewUrl, getGoogleFinanceUrl } from "@/lib/external-links";
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
      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Search Input */}
          <div className="relative md:col-span-6">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by company name, symbol (RELIANCE, 500325), or ISIN..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-800"
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
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
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
            <div className="grid grid-cols-3 w-full rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedExchange("");
                  setPage(1);
                }}
                className={`rounded-md py-1 text-xs font-semibold transition ${
                  selectedExchange === ""
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
                className={`rounded-md py-1 text-xs font-semibold transition ${
                  selectedExchange === "NSE"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
                className={`rounded-md py-1 text-xs font-semibold transition ${
                  selectedExchange === "BSE"
                    ? "bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
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
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isLoading ? "Searching companies..." : `${searchResults?.total ?? 0} Listed Companies Found`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Canonical records unify multi-exchange listings (NSE and BSE) via verified ISIN codes.
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
              className="w-52 rounded-lg border border-slate-200 bg-white py-1 px-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 shadow-sm"
            />
            <button
              type="submit"
              disabled={isAddingStock || !quickAddSymbol.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${seedMutation.isPending ? "animate-spin text-indigo-500" : ""}`} />
              <span>Seed Benchmarks</span>
            </button>
          )}
        </div>
      </div>

      {addStockError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {addStockError}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <h4 className="mt-2 text-sm font-semibold">Unable to fetch company listings</h4>
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : "Backend service unavailable"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && searchResults?.items.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 transition"
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
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${seedMutation.isPending ? "animate-spin text-indigo-500" : ""}`} />
              <span>Load Official Benchmark Companies</span>
            </button>
          </div>
        </div>
      )}

      {/* Company Cards Grid */}
      {!isLoading && !isError && searchResults && searchResults.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {searchResults.items.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {searchResults && searchResults.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {searchResults.page} of {searchResults.total_pages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= searchResults.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
  const isDualListed = company.exchange_listings.includes("NSE") && company.exchange_listings.includes("BSE");
  const primarySec = company.securities.find((s) => s.is_primary) ?? company.securities[0];
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

  return (
    <div className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div>
        {/* Top Header: ISIN and Dual-Listing Indicator */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400" title="International Securities Identification Number">
            {company.isin}
          </span>
          {isDualListed ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              title="Canonical company with separate verified NSE and BSE security mappings"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Dual Listed</span>
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {company.exchange_listings.join(", ")}
            </span>
          )}
        </div>

        {/* Company Name */}
        <Link
          href={`/companies/${company.id}`}
          className="mt-2.5 block text-base font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400"
        >
          {company.name}
        </Link>

        {/* Sector & Industry */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {company.sector_name && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Tag className="h-3 w-3 text-slate-400" />
              <span>{company.sector_name}</span>
            </span>
          )}
          {company.industry_name && (
            <span className="truncate text-slate-500 dark:text-slate-400">
              • {company.industry_name}
            </span>
          )}
        </div>

        {/* Accounting Model Alert for Financial Institutions */}
        {company.is_financial_sector && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>Banking / Financial Model</span>
          </div>
        )}

        {/* Latest Market Price with isolated single-stock refresh */}
        <div className="mt-3.5 flex items-baseline justify-between rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                Latest EOD Price
              </span>
              <button
                type="button"
                onClick={handleRefreshSinglePrice}
                disabled={isRefreshing}
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                title={`Refresh latest price for ${company.name}`}
              >
                <RefreshCw className={`h-2.5 w-2.5 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
              </button>
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {priceData.price != null ? formatINR(priceData.price) : "Pending EOD"}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {priceData.changePct != null && (
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${
                  Number(priceData.changePct) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {Number(priceData.changePct) >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>
                  {priceData.change != null ? (Number(priceData.change) >= 0 ? `+${priceData.change}` : `${priceData.change}`) : ""}
                  {" "}({Number(priceData.changePct) >= 0 ? `+${priceData.changePct}` : `${priceData.changePct}`}%)
                </span>
              </div>
            )}
            {primarySec && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                <a
                  href={getTradingViewUrl(primarySec.symbol, primarySec.exchange_code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition"
                  title="View live chart on TradingView"
                  onClick={(e) => e.stopPropagation()}
                >
                  TV ↗
                </a>
                <span>•</span>
                <a
                  href={getGoogleFinanceUrl(primarySec.symbol, primarySec.exchange_code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition"
                  title="View quote on Google Finance"
                  onClick={(e) => e.stopPropagation()}
                >
                  GFin ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Exchange Listings & Research CTA */}
      <div className="mt-5 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {company.securities.map((sec) => (
              <span
                key={sec.id}
                className={`rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${
                  sec.exchange_code === "NSE"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    : "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                }`}
                title={`${sec.exchange_name} (${sec.series})`}
              >
                {sec.exchange_code}: {sec.symbol}
              </span>
            ))}
          </div>

          <Link
            href={`/companies/${company.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <span>Research</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
