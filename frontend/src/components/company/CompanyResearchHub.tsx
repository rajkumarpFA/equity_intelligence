"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  Users,
  ShieldCheck,
  BarChart3,
  ExternalLink,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Clock,
  Landmark,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import {
  searchCompanies,
  fetchSectors,
  seedBenchmarkUniverse,
} from "@/lib/api-client";
import { formatINR } from "@/lib/format";
import { DeltaChip } from "@/components/common/DeltaChip";
import { MissingValue } from "@/components/common/MissingValue";
import { ExchangeBadges } from "@/components/common/ExchangeBadges";
import { FreshnessChip } from "@/components/common/FreshnessChip";
import type { CompanySearchItem, SectorRead } from "@/types/company";

const BENCHMARK_EQUITIES = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "Technology" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", isBank: true },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Automotive" },
  { symbol: "SUZLON", name: "Suzlon Energy", sector: "Energy" },
  { symbol: "TANLA", name: "Tanla Platforms", sector: "Technology" },
  { symbol: "TATATECH", name: "Tata Technologies", sector: "Technology" },
];

export function CompanyResearchHub() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<number | undefined>(undefined);
  const [selectedExchange, setSelectedExchange] = useState<string>("");
  const [sectorFilterType, setSectorFilterType] = useState<"ALL" | "INDUSTRIAL" | "FINANCIAL">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);

  // Fetch sector taxonomy
  const { data: sectors } = useQuery<SectorRead[]>({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch companies matching search/filters
  const {
    data: searchResults,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["companies-hub", searchTerm, selectedSector, selectedExchange, page],
    queryFn: () =>
      searchCompanies({
        q: searchTerm || undefined,
        sector_id: selectedSector,
        exchange: selectedExchange || undefined,
        page,
        page_size: 24,
      }),
    staleTime: 60 * 1000,
  });

  // Seed benchmark universe mutation if database is empty
  const seedMutation = useMutation({
    mutationFn: seedBenchmarkUniverse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-hub"] });
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
  });

  // Client-side filtering for Industrial vs Financial Sector if requested
  const filteredItems = useMemo(() => {
    if (!searchResults?.items) return [];
    if (sectorFilterType === "ALL") return searchResults.items;
    if (sectorFilterType === "FINANCIAL") {
      return searchResults.items.filter((item) => item.is_financial_sector);
    }
    return searchResults.items.filter((item) => !item.is_financial_sector);
  }, [searchResults?.items, sectorFilterType]);

  const handleBenchmarkClick = (symbol: string) => {
    setSearchTerm(symbol);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedSector(undefined);
    setSelectedExchange("");
    setSectorFilterType("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. Hero Search & Institutional Dossier Quick Launcher */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30">
                <Building2 className="h-3.5 w-3.5" />
              </span>
              Company Research Suite
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-1)] sm:text-3xl">
              Fundamental Equities Dossiers
            </h1>
            <p className="mt-1.5 text-xs text-[var(--text-2)] leading-relaxed sm:text-sm">
              Explore audited financial statements, DuPont 3-stage ROE pipelines, Altman Z &amp; Piotroski F scores, EOD technical indicators, and source filing traceability across Indian equities.
            </p>
          </div>

          {/* Quick Seed Action if Universe is Sparse */}
          {searchResults && searchResults.total === 0 && (
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-bold text-[var(--bg-base)] shadow-lg hover:brightness-110 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {seedMutation.isPending ? "Seeding..." : "Seed Benchmark Universe"}
              </button>
            </div>
          )}
        </div>

        {/* Benchmark Equities One-Click Pills */}
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--text-3)] flex items-center gap-1 mr-1">
              <Clock className="h-3 w-3" /> Benchmark Equities:
            </span>
            {BENCHMARK_EQUITIES.map((eq) => (
              <button
                key={eq.symbol}
                type="button"
                onClick={() => handleBenchmarkClick(eq.symbol)}
                className={`rounded-full border px-3 py-1 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  searchTerm === eq.symbol
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-2)] hover:border-[var(--accent)]/40 hover:text-white"
                }`}
              >
                <span>{eq.symbol}</span>
                <span className="text-[10px] text-[var(--text-3)] font-sans font-normal">
                  {eq.sector}
                </span>
                {eq.isBank && (
                  <span className="rounded bg-amber-500/10 px-1 text-[9px] text-amber-400 border border-amber-500/20 font-sans">
                    Bank
                  </span>
                )}
              </button>
            ))}
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-[var(--accent)] hover:underline ml-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. 18-Section Research Suite Architectural Capability Overview */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-2)]">
            <Layers className="h-4 w-4 text-[var(--accent)]" />
            <span>Integrated 18-Section Research Dossier Architecture:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <FileText className="h-3 w-3 text-sky-400" /> Audited Statements (BS / PL / CF)
            </span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-400" /> DuPont 3-Stage ROE
            </span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-amber-400" /> Altman Z &amp; Piotroski F
            </span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-purple-400" /> EOD Technical Indicators
            </span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <Landmark className="h-3 w-3 text-blue-400" /> Banking Regulatory Isolation
            </span>
            <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-[var(--text-2)] flex items-center gap-1">
              <Users className="h-3 w-3 text-yellow-400" /> Shareholding &amp; Corporate Actions
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Search Bar, Filters & View Mode Controls */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Search company by symbol, name, or ISIN (e.g. RELIANCE, TCS, INE002A01018)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] pl-10 pr-4 py-2 text-xs text-white placeholder-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none transition"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sector Dropdown */}
          <select
            value={selectedSector ?? ""}
            onChange={(e) => {
              setSelectedSector(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none"
            aria-label="Filter by Sector"
          >
            <option value="">All Sectors ({sectors?.length || 0})</option>
            {sectors?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Exchange Filter Toggle */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setSelectedExchange("");
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 transition ${
                selectedExchange === ""
                  ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              All Listings
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedExchange("NSE");
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 transition ${
                selectedExchange === "NSE"
                  ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
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
              className={`rounded-lg px-2.5 py-1 transition ${
                selectedExchange === "BSE"
                  ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              BSE
            </button>
          </div>

          {/* Accounting Sector Type: Industrial vs Banking */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSectorFilterType("ALL")}
              className={`rounded-lg px-2.5 py-1 transition ${
                sectorFilterType === "ALL"
                  ? "bg-white/10 text-white font-bold"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setSectorFilterType("INDUSTRIAL")}
              className={`rounded-lg px-2.5 py-1 transition ${
                sectorFilterType === "INDUSTRIAL"
                  ? "bg-white/10 text-white font-bold"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              Industrial
            </button>
            <button
              type="button"
              onClick={() => setSectorFilterType("FINANCIAL")}
              className={`rounded-lg px-2.5 py-1 transition ${
                sectorFilterType === "FINANCIAL"
                  ? "bg-amber-500/20 text-amber-400 font-bold"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              Banks &amp; NBFCs
            </button>
          </div>

          {/* Grid vs Table View Switcher */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
              className={`rounded-lg p-1.5 transition ${
                viewMode === "grid"
                  ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Dense Matrix View"
              className={`rounded-lg p-1.5 transition ${
                viewMode === "table"
                  ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Company Research Directory Results */}
      {/* ------------------------------------------------------------- */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">
          Failed to load company research directory.
          <div className="mt-2 text-xs text-[var(--text-3)] font-mono">
            {error instanceof Error ? error.message : "Network error"}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-[var(--text-3)] opacity-40" />
          <h3 className="mt-3 text-base font-bold text-[var(--text-1)]">
            No companies match your search filters
          </h3>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            Try adjusting your search query, clearing sector filters, or seed the benchmark universe.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-2 text-xs font-bold text-[var(--text-2)] hover:text-white transition"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--bg-base)] hover:brightness-110 transition"
            >
              {seedMutation.isPending ? "Seeding..." : "Seed Benchmark Equities"}
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* ----------------------------------------------------------- */
        /* Card Grid View (Rich Institutional Dossiers)               */
        /* ----------------------------------------------------------- */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const primarySec =
              item.securities.find((s) => s.is_primary) ?? item.securities[0];
            const symbol = item.primary_symbol || primarySec?.symbol || "N/A";
            const price = item.current_price != null ? Number(item.current_price) : null;
            const deltaPct = item.price_change_pct != null ? Number(item.price_change_pct) : null;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-all hover:border-[var(--accent)]/40 hover:shadow-lg"
              >
                <div>
                  {/* Header Row: Symbol, Badges & Sector Indicator */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/companies/${item.id}`}
                          className="text-base font-extrabold tracking-tight text-white hover:text-[var(--accent)] transition"
                        >
                          {symbol}
                        </Link>
                        {item.is_financial_sector ? (
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                            Bank / NBFC
                          </span>
                        ) : (
                          <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                            Industrial
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-0.5 text-xs text-[var(--text-2)] font-medium truncate max-w-[220px]"
                        title={item.name}
                      >
                        {item.name}
                      </div>
                    </div>

                    {/* Dual Exchange Badges */}
                    <div className="flex items-center gap-1">
                      {item.exchange_listings.includes("NSE") && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                          NSE
                        </span>
                      )}
                      {item.exchange_listings.includes("BSE") && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">
                          BSE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ISIN & Sector Pill */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-3)] font-mono">
                    <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5 text-[var(--text-3)]">
                      {item.isin}
                    </span>
                    <span className="text-[var(--text-2)] truncate max-w-[140px]">
                      {item.sector_name || "Diversified"}
                    </span>
                  </div>

                  {/* Price & Change Row */}
                  <div className="mt-4 flex items-baseline justify-between border-t border-[var(--border)] pt-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                        Latest EOD Price
                      </div>
                      <div className="font-mono text-lg font-bold text-white tabular-nums">
                        {price !== null ? formatINR(price) : <MissingValue reason="EOD Quote Missing" />}
                      </div>
                    </div>
                    <div>
                      {deltaPct !== null ? (
                        <DeltaChip percentage={deltaPct} />
                      ) : (
                        <span className="text-[11px] text-[var(--text-3)] font-mono">--</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Dossier Sub-Links & Main CTA */}
                <div className="mt-5 border-t border-[var(--border)] pt-4 space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-3)] font-semibold">
                    <Link
                      href={`/companies/${item.id}?tab=statements`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      Statements
                    </Link>
                    <span>•</span>
                    <Link
                      href={`/companies/${item.id}?tab=analysis`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      Analysis
                    </Link>
                    <span>•</span>
                    <Link
                      href={`/companies/${item.id}?tab=technicals`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      Technicals
                    </Link>
                    <span>•</span>
                    <Link
                      href={`/compare?ids=${item.id}`}
                      className="hover:text-[var(--accent)] transition"
                    >
                      Compare
                    </Link>
                  </div>

                  {/* Main Full Dossier Button */}
                  <Link
                    href={`/companies/${item.id}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg-base)] transition shadow-sm"
                  >
                    Open 18-Section Dossier
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ----------------------------------------------------------- */
        /* Dense Institutional Table View                             */
        /* ----------------------------------------------------------- */
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/80 text-[var(--text-2)] font-bold">
                <th className="p-3.5 min-w-[140px]">COMPANY</th>
                <th className="p-3.5 min-w-[120px]">ISIN</th>
                <th className="p-3.5 min-w-[140px]">SECTOR / INDUSTRY</th>
                <th className="p-3.5 text-center min-w-[100px]">EXCHANGES</th>
                <th className="p-3.5 text-right min-w-[100px]">PRICE</th>
                <th className="p-3.5 text-right min-w-[90px]">1D CHANGE</th>
                <th className="p-3.5 text-center min-w-[100px]">GOVERNANCE</th>
                <th className="p-3.5 text-right min-w-[180px]">RESEARCH ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredItems.map((item) => {
                const primarySec =
                  item.securities.find((s) => s.is_primary) ?? item.securities[0];
                const symbol = item.primary_symbol || primarySec?.symbol || "N/A";
                const price = item.current_price != null ? Number(item.current_price) : null;
                const deltaPct = item.price_change_pct != null ? Number(item.price_change_pct) : null;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.02] transition"
                  >
                    <td className="p-3.5">
                      <Link
                        href={`/companies/${item.id}`}
                        className="font-extrabold text-white hover:text-[var(--accent)] transition"
                      >
                        {symbol}
                      </Link>
                      <div className="text-[11px] text-[var(--text-3)] truncate max-w-[180px]">
                        {item.name}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[var(--text-3)] text-[11px]">
                      {item.isin}
                    </td>
                    <td className="p-3.5 text-[var(--text-2)]">
                      <div>{item.sector_name || "Diversified"}</div>
                      <div className="text-[10px] text-[var(--text-3)] truncate max-w-[160px]">
                        {item.industry_name || "--"}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {item.exchange_listings.map((ex) => (
                          <span
                            key={ex}
                            className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white"
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-white">
                      {price !== null ? formatINR(price) : <MissingValue reason="Missing" />}
                    </td>
                    <td className="p-3.5 text-right">
                      {deltaPct !== null ? (
                        <DeltaChip percentage={deltaPct} />
                      ) : (
                        <span className="text-[11px] text-[var(--text-3)] font-mono">--</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.is_financial_sector ? (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 font-semibold border border-amber-500/20">
                          Bank / NBFC
                        </span>
                      ) : (
                        <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400 font-semibold border border-sky-500/20">
                          Industrial
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/companies/${item.id}`}
                          className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg-base)] transition"
                        >
                          Dossier ›
                        </Link>
                        <Link
                          href={`/compare?ids=${item.id}`}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs font-bold text-[var(--text-2)] hover:text-white transition"
                        >
                          Compare
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. Pagination Bar */}
      {/* ------------------------------------------------------------- */}
      {searchResults && searchResults.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--text-3)]">
          <span>
            Showing page <span className="font-bold text-white">{searchResults.page}</span> of{" "}
            <span className="font-bold text-white">{searchResults.total_pages}</span> (
            {searchResults.total} total companies)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold text-[var(--text-2)] hover:text-white transition disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(searchResults.total_pages, p + 1))}
              disabled={page >= searchResults.total_pages}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold text-[var(--text-2)] hover:text-white transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
