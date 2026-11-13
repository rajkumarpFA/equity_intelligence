"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Plus,
  X,
  Download,
  Share2,
  Trash2,
  Sparkles,
  Trophy,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Activity,
  CheckCircle2,
} from "lucide-react";
import {
  compareCompanies,
  exportComparisonCsv,
  fetchCompanyPeers,
  searchCompanies,
} from "@/lib/api-client";
import { formatINR, formatPercent, formatNumber } from "@/lib/format";
import { MissingValue } from "@/components/common/MissingValue";
import { DeltaChip } from "@/components/common/DeltaChip";
import { ExchangeBadges } from "@/components/common/ExchangeBadges";
import type { CompanyComparisonResponse, PeerSummaryItem } from "@/types/comparison";

interface CompareViewProps {
  initialCompanyIds?: number[];
}

export function CompareView({ initialCompanyIds = [1, 2] }: CompareViewProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialCompanyIds);
  const [reportingBasis, setReportingBasis] = useState<"CONSOLIDATED" | "STANDALONE">("CONSOLIDATED");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Available companies for adding
  const { data: searchResults } = useQuery({
    queryKey: ["compare-search", searchQuery],
    queryFn: () => searchCompanies({ q: searchQuery, page_size: 10 }),
    enabled: isSearchOpen,
    staleTime: 60 * 1000,
  });

  // Query comparison data
  const {
    data: comparison,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CompanyComparisonResponse>({
    queryKey: ["comparison", selectedIds, reportingBasis],
    queryFn: () =>
      compareCompanies({
        company_ids: selectedIds,
        reporting_basis: reportingBasis,
      }),
    enabled: selectedIds.length > 0,
    staleTime: 60 * 1000,
  });

  // Query peers for the primary company (first in selected list)
  const primaryCompanyId = selectedIds[0];
  const { data: peersData } = useQuery({
    queryKey: ["peers", primaryCompanyId],
    queryFn: () => fetchCompanyPeers(primaryCompanyId),
    enabled: Boolean(primaryCompanyId),
    staleTime: 120 * 1000,
  });

  const handleAddCompany = (id: number) => {
    if (!selectedIds.includes(id) && selectedIds.length < 8) {
      setSelectedIds([...selectedIds, id]);
    }
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleRemoveCompany = (id: number) => {
    if (selectedIds.length > 1) {
      setSelectedIds(selectedIds.filter((cid) => cid !== id));
    }
  };

  const handleAddAllSectorPeers = () => {
    if (!peersData || !peersData.peers) return;
    const newIds = [...selectedIds];
    for (const p of peersData.peers) {
      if (!newIds.includes(p.id) && newIds.length < 6) {
        newIds.push(p.id);
      }
    }
    setSelectedIds(newIds);
  };

  const handleExportCsv = async () => {
    if (selectedIds.length === 0) return;
    setIsExporting(true);
    try {
      const blob = await exportComparisonCsv({
        company_ids: selectedIds,
        reporting_basis: reportingBasis,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `competitor_comparison_${reportingBasis.toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredMetrics = useMemo(() => {
    if (!comparison) return [];
    if (activeCategory === "All") return comparison.metrics;
    return comparison.metrics.filter((m) => m.category === activeCategory);
  }, [comparison, activeCategory]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. Header & Active Company Selection Strip */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-bold">
                <Users className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-[var(--text-1)]">
                Side-by-Side Competitor Benchmarking
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              Compare financial growth, return profiles, capital structure, and valuation multiples across sector peers.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Standalone / Consolidated Toggle */}
            <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setReportingBasis("CONSOLIDATED")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  reportingBasis === "CONSOLIDATED"
                    ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                }`}
              >
                Consolidated
              </button>
              <button
                type="button"
                onClick={() => setReportingBasis("STANDALONE")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  reportingBasis === "STANDALONE"
                    ? "bg-[var(--accent)] text-[var(--bg-base)] font-bold shadow-sm"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                }`}
              >
                Standalone
              </button>
            </div>

            {/* Quick Add Sector Peers */}
            {peersData && peersData.peers.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllSectorPeers}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                title={`Add peers from ${peersData.sector}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Add {peersData.sector} Peers
              </button>
            )}

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-xs font-bold text-[var(--text-2)] hover:text-[var(--text-1)] transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Selected Company Chips & Add Dropdown */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-xs font-semibold text-[var(--text-3)] mr-1">
            Compared Cohort ({selectedIds.length}/8):
          </span>

          {comparison?.companies.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--text-1)]"
            >
              <Link
                href={`/companies/${c.id}`}
                className="hover:text-[var(--accent)] transition"
              >
                {c.symbol}
              </Link>
              <span className="text-[10px] text-[var(--text-3)] font-normal truncate max-w-[100px]">
                {c.name}
              </span>
              {selectedIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveCompany(c.id)}
                  className="rounded-full p-0.5 text-[var(--text-3)] hover:bg-white/20 hover:text-white transition"
                  aria-label={`Remove ${c.symbol}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add Company Trigger / Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--text-3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Company
            </button>

            {isSearchOpen && (
              <div className="absolute left-0 top-9 z-50 w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl">
                <input
                  type="text"
                  placeholder="Search stock by symbol or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs text-white placeholder-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none"
                />
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {searchResults?.items
                    ?.filter((item) => !selectedIds.includes(item.id))
                    .map((item) => {
                      const sec = item.securities?.[0];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddCompany(item.id)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-white/10 transition"
                        >
                          <div>
                            <span className="font-bold text-white">{sec?.symbol || item.name}</span>
                            <div className="text-[10px] text-[var(--text-3)] truncate max-w-[180px]">
                              {item.name}
                            </div>
                          </div>
                          <span className="text-[10px] text-[var(--accent)] font-mono">
                            {sec?.exchange_code || "NSE"}
                          </span>
                        </button>
                      );
                    })}
                  {searchResults?.items?.length === 0 && (
                    <div className="py-2 text-center text-xs text-[var(--text-3)]">
                      No matching companies found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Comparative Strength Radar / Relative Scores (5 Dimensions) */}
      {/* ------------------------------------------------------------- */}
      {comparison && comparison.radar_scores.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--accent)]" /> 5-Pillar Relative Scorecard (0 - 100)
            </h3>
            <span className="text-[11px] text-[var(--text-3)]">
              Higher score indicates stronger fundamentals or better relative valuation
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              { key: "growth", label: "Growth Trajectory", icon: TrendingUp },
              { key: "profitability", label: "Profitability & Returns", icon: Trophy },
              { key: "financial_health", label: "Financial Health", icon: ShieldCheck },
              { key: "operating_efficiency", label: "Operating Efficiency", icon: Activity },
              { key: "valuation_attractiveness", label: "Valuation Value", icon: Layers },
            ].map((pillar) => (
              <div
                key={pillar.key}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 space-y-2"
              >
                <div className="text-xs font-bold text-[var(--text-2)] flex items-center gap-1.5">
                  <pillar.icon className="h-3.5 w-3.5 text-[var(--accent)]" /> {pillar.label}
                </div>
                <div className="space-y-1.5 pt-1">
                  {comparison.radar_scores.map((score) => {
                    const val = score[pillar.key as keyof typeof score] as number;
                    return (
                      <div key={score.company_id} className="text-xs">
                        <div className="flex justify-between text-[11px] font-mono mb-0.5">
                          <span className="text-[var(--text-1)] font-semibold">{score.symbol}</span>
                          <span className="text-[var(--accent)] font-bold">{val.toFixed(0)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, val))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Category Filter Tabs */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] pb-2">
        <button
          type="button"
          onClick={() => setActiveCategory("All")}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition shrink-0 ${
            activeCategory === "All"
              ? "bg-[var(--accent)] text-[var(--bg-base)]"
              : "border border-[var(--border)] text-[var(--text-3)] hover:text-white"
          }`}
        >
          All Categories ({comparison?.metrics.length || 0})
        </button>
        {comparison?.categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition shrink-0 ${
              activeCategory === cat
                ? "bg-[var(--accent)] text-[var(--bg-base)]"
                : "border border-[var(--border)] text-[var(--text-3)] hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Side-by-Side Comparison Matrix Table */}
      {/* ------------------------------------------------------------- */}
      {isLoading ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3 text-sm text-[var(--text-3)] font-mono">
            <Activity className="h-5 w-5 animate-spin text-[var(--accent)]" />
            Loading side-by-side competitor analysis...
          </div>
        </div>
      ) : isError || !comparison ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">
          Failed to load comparison data.
          <div className="mt-2 text-xs text-[var(--text-3)] font-mono">
            {error instanceof Error ? error.message : "Error generating peer comparison"}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
          <table className="w-full text-left text-xs border-collapse">
            {/* Table Header: Sticky Columns */}
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/80">
                <th className="p-4 font-bold text-[var(--text-2)] min-w-[240px] sticky left-0 bg-[var(--bg-elevated)] z-20">
                  METRIC SPECIFICATION
                </th>
                <th className="p-4 font-mono text-center font-bold text-[var(--text-3)] min-w-[110px]">
                  PEER AVG
                </th>
                {comparison.companies.map((c) => (
                  <th
                    key={c.id}
                    className="p-4 min-w-[190px] border-l border-[var(--border)] text-left"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/companies/${c.id}`}
                        className="text-sm font-extrabold text-white hover:text-[var(--accent)] transition flex items-center gap-1"
                      >
                        {c.symbol}
                        <ArrowRight className="h-3 w-3 opacity-60" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompany(c.id)}
                        className="text-[var(--text-3)] hover:text-red-400 p-1"
                        title="Remove from comparison"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--text-3)] truncate max-w-[170px]">
                      {c.name}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">
                        {c.current_price ? formatINR(c.current_price) : "N/A"}
                      </span>
                      {c.price_change_pct != null && (
                        <DeltaChip percentage={c.price_change_pct} />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-3)] font-mono">
                      <span>{c.sector}</span>
                      {c.is_financial_sector && (
                        <span className="rounded bg-amber-500/10 px-1 text-amber-400 border border-amber-500/20">
                          Bank
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: Metrics grouped by Category */}
            <tbody className="divide-y divide-[var(--border)]">
              {filteredMetrics.map((row) => (
                <tr
                  key={row.metric_key}
                  className="hover:bg-white/[0.02] transition"
                >
                  {/* Left Metric Info Header */}
                  <td className="p-4 sticky left-0 bg-[var(--bg-card)] z-10">
                    <div className="font-semibold text-[var(--text-1)]">
                      {row.metric_name}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-3)] font-mono mt-0.5">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/5">
                        {row.unit}
                      </span>
                      <span>{row.category}</span>
                      {row.is_industrial_only && (
                        <span className="text-amber-400">Industrial Only</span>
                      )}
                      {row.is_banking_only && (
                        <span className="text-blue-400">Banking Only</span>
                      )}
                    </div>
                  </td>

                  {/* Peer Cohort Average */}
                  <td className="p-4 text-center font-mono text-[var(--text-2)] font-semibold border-l border-[var(--border)]">
                    {row.peer_average !== null && row.peer_average !== undefined ? (
                      row.unit === "₹ Cr" ? (
                        formatINR(row.peer_average) + " Cr"
                      ) : row.unit === "₹" ? (
                        formatINR(row.peer_average)
                      ) : row.unit === "%" ? (
                        `${row.peer_average.toFixed(2)}%`
                      ) : row.unit === "x" ? (
                        `${row.peer_average.toFixed(2)}x`
                      ) : row.unit === "Days" ? (
                        `${row.peer_average.toFixed(0)} d`
                      ) : (
                        row.peer_average.toFixed(1)
                      )
                    ) : (
                      <span className="text-[var(--text-3)]">—</span>
                    )}
                  </td>

                  {/* Company Metric Columns */}
                  {comparison.companies.map((c) => {
                    const cell = row.values[c.id];
                    return (
                      <td
                        key={c.id}
                        className={`p-4 border-l border-[var(--border)] font-mono ${
                          cell?.is_leader
                            ? "bg-[var(--accent)]/[0.03]"
                            : ""
                        }`}
                      >
                        {cell ? (
                          cell.bypass_reason ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                              {cell.bypass_reason === "BANKING_BYPASS"
                                ? "Banking Bypass"
                                : "N/A (Industrial)"}
                            </span>
                          ) : cell.raw_value !== null && cell.raw_value !== undefined ? (
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`font-bold tabular-nums ${
                                  cell.is_leader
                                    ? "text-[var(--accent)] font-extrabold"
                                    : cell.is_laggard
                                    ? "text-[var(--text-3)]"
                                    : "text-white"
                                }`}
                              >
                                {cell.formatted_value}
                              </span>
                              {cell.is_leader && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent)] border border-[var(--accent)]/30"
                                  title="Best in Cohort"
                                >
                                  <Trophy className="h-2.5 w-2.5" /> Best
                                </span>
                              )}
                            </div>
                          ) : (
                            <MissingValue reason="Not reported in filing" />
                          )
                        ) : (
                          <MissingValue reason="N/A" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
