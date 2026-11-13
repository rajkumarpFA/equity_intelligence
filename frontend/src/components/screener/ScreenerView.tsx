"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  ChevronDown,
  Download,
  Filter,
  Layers,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import {
  runScreen,
  exportScreenCsv,
  fetchPresetScreens,
  fetchSavedScreens,
  createSavedScreen,
  deleteSavedScreen,
} from "@/lib/api-client";
import {
  FilterCondition,
  FilterExpression,
  FilterOperator,
  MetricDefinition,
  SavedScreen,
  ScreenedCompanyItem,
  ScreenRequest,
} from "@/types/screener";
import { formatCrores, formatINR, formatNumber, formatPercent, formatRatio } from "@/lib/format";
import { MissingValue } from "@/components/common/MissingValue";

const AVAILABLE_METRICS: MetricDefinition[] = [
  // Valuation
  { field: "market_cap", label: "Market Cap (₹ Cr)", category: "Valuation", defaultOperator: ">=", defaultValue: 1000, unit: "Cr" },
  { field: "pe", label: "P/E Ratio", category: "Valuation", defaultOperator: "<=", defaultValue: 25, unit: "x" },
  { field: "pb", label: "P/B Ratio", category: "Valuation", defaultOperator: "<=", defaultValue: 3.0, unit: "x" },
  { field: "ev_ebitda", label: "EV / EBITDA", category: "Valuation", defaultOperator: "<=", defaultValue: 15, unit: "x" },

  // Profitability & Returns
  { field: "roce", label: "ROCE % (Return on Capital)", category: "Profitability", defaultOperator: ">=", defaultValue: 15, unit: "%", isIndustrialOnly: true },
  { field: "roe", label: "ROE % (Return on Equity)", category: "Profitability", defaultOperator: ">=", defaultValue: 15, unit: "%" },
  { field: "roa", label: "ROA % (Return on Assets)", category: "Profitability", defaultOperator: ">=", defaultValue: 10, unit: "%" },
  { field: "operating_margin", label: "Operating Margin %", category: "Profitability", defaultOperator: ">=", defaultValue: 12, unit: "%" },
  { field: "net_margin", label: "Net Profit Margin %", category: "Profitability", defaultOperator: ">=", defaultValue: 8, unit: "%" },

  // Solvency & Leverage
  { field: "debt_to_equity", label: "Debt to Equity (D/E)", category: "Solvency", defaultOperator: "<=", defaultValue: 0.5, unit: "x", isIndustrialOnly: true },
  { field: "interest_coverage", label: "Interest Coverage Ratio", category: "Solvency", defaultOperator: ">=", defaultValue: 5.0, unit: "x", isIndustrialOnly: true },
  { field: "current_ratio", label: "Current Ratio", category: "Solvency", defaultOperator: ">=", defaultValue: 1.33, unit: "x", isIndustrialOnly: true },

  // Growth
  { field: "revenue_cagr_3y", label: "3Y Revenue CAGR %", category: "Growth", defaultOperator: ">=", defaultValue: 12, unit: "%" },
  { field: "pat_cagr_3y", label: "3Y PAT CAGR %", category: "Growth", defaultOperator: ">=", defaultValue: 12, unit: "%" },
  { field: "revenue_cagr_5y", label: "5Y Revenue CAGR %", category: "Growth", defaultOperator: ">=", defaultValue: 10, unit: "%" },
  { field: "revenue_yoy_pct", label: "YoY Revenue Growth %", category: "Growth", defaultOperator: ">=", defaultValue: 10, unit: "%" },

  // Quality & Distress Scores
  { field: "altman", label: "Altman Z-Score", category: "Quality", defaultOperator: ">=", defaultValue: 2.9, unit: "", isIndustrialOnly: true },
  { field: "piotroski", label: "Piotroski F-Score (0-9)", category: "Quality", defaultOperator: ">=", defaultValue: 7, unit: "Pts" },

  // Efficiency
  { field: "ccc", label: "Cash Conversion Cycle (Days)", category: "Solvency", defaultOperator: "<=", defaultValue: 90, unit: "Days", isIndustrialOnly: true },

  // Banking & Regulatory
  { field: "nim", label: "Net Interest Margin (NIM %)", category: "Banking", defaultOperator: ">=", defaultValue: 3.5, unit: "%", isBankingOnly: true },
  { field: "casa", label: "CASA Deposit Ratio %", category: "Banking", defaultOperator: ">=", defaultValue: 35.0, unit: "%", isBankingOnly: true },
  { field: "npa", label: "Gross NPA %", category: "Banking", defaultOperator: "<=", defaultValue: 2.0, unit: "%", isBankingOnly: true },
  { field: "car", label: "Capital Adequacy (CAR %)", category: "Banking", defaultOperator: ">=", defaultValue: 14.0, unit: "%", isBankingOnly: true },
];

export function ScreenerView() {
  const queryClient = useQueryClient();

  // State: Filter conditions
  const [conjunction, setConjunction] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: "roce", operator: ">=", value: 15.0 },
    { field: "debt_to_equity", operator: "<=", value: 0.5 },
  ]);
  const [includeFinancials, setIncludeFinancials] = useState<boolean>(true);
  const [reportingBasis, setReportingBasis] = useState<"CONSOLIDATED" | "STANDALONE">("CONSOLIDATED");

  // State: Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>("market_cap");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // State: Save screen dialog
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveScreenName, setSaveScreenName] = useState("");
  const [saveScreenDesc, setSaveScreenDesc] = useState("");
  const [activePresetId, setActivePresetId] = useState<number | null>(null);

  // 1. Fetch Presets
  const presetsQuery = useQuery({
    queryKey: ["screener-presets"],
    queryFn: fetchPresetScreens,
    staleTime: 60 * 60 * 1000,
  });

  // 2. Fetch User Saved Screens
  const savedScreensQuery = useQuery({
    queryKey: ["screener-saved"],
    queryFn: fetchSavedScreens,
  });

  // 3. Current Screener Execution Request
  const currentRequest: ScreenRequest = {
    filter_expression: {
      conjunction,
      conditions,
    },
    sort_by: sortBy,
    sort_direction: sortDirection,
    page,
    page_size: pageSize,
    include_financials: includeFinancials,
    reporting_basis: reportingBasis,
  };

  // 4. Run Screen Query
  const screenQuery = useQuery({
    queryKey: [
      "screener-run",
      conjunction,
      conditions,
      includeFinancials,
      reportingBasis,
      sortBy,
      sortDirection,
      page,
      pageSize,
    ],
    queryFn: () => runScreen(currentRequest),
    staleTime: 30 * 1000,
  });

  // Handler: Add condition
  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: "roce", operator: ">=", value: 15.0 },
    ]);
  };

  // Handler: Remove condition
  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  // Handler: Update condition
  const handleUpdateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...updates };
    setConditions(updated);
  };

  // Handler: Load Preset
  const handleLoadPreset = (preset: SavedScreen) => {
    setActivePresetId(preset.id);
    setConjunction(preset.filter_expression.conjunction || "AND");
    setConditions(preset.filter_expression.conditions || []);
    setSortBy(preset.sort_by || "market_cap");
    setSortDirection(preset.sort_direction || "desc");
    setPage(1);
  };

  // Handler: Save screen mutation
  const saveScreenMutation = useMutation({
    mutationFn: createSavedScreen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screener-saved"] });
      setIsSaveModalOpen(false);
      setSaveScreenName("");
      setSaveScreenDesc("");
    },
  });

  // Handler: Delete saved screen mutation
  const deleteScreenMutation = useMutation({
    mutationFn: deleteSavedScreen,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screener-saved"] });
    },
  });

  // Handler: Export CSV
  const handleExportCsv = async () => {
    try {
      const blob = await exportScreenCsv(currentRequest);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screener_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export CSV failed", err);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setActivePresetId(null);
    setConjunction("AND");
    setConditions([]);
    setSortBy("market_cap");
    setSortDirection("desc");
    setPage(1);
  };

  const results = screenQuery.data;
  const isLoading = screenQuery.isLoading;

  return (
    <div className="space-y-6" data-testid="screener-view">
      {/* 1. INSTITUTIONAL PRESET SCREENS BAR */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-1)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <span>Institutional Preset Screens</span>
          </div>

          {/* User Saved Screens Dropdown */}
          {savedScreensQuery.data && savedScreensQuery.data.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-3)]">Saved Screens:</span>
              <select
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const screen = savedScreensQuery.data.find((s) => s.id === id);
                  if (screen) handleLoadPreset(screen);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Load a saved screen...
                </option>
                {savedScreensQuery.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Presets Pills Row */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {presetsQuery.data?.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleLoadPreset(preset)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition border ${
                  isActive
                    ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] shadow-sm"
                    : "bg-[var(--bg-elevated)] border-white/5 text-[var(--text-2)] hover:border-white/20 hover:text-[var(--text-1)]"
                }`}
                title={preset.description || ""}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. INTERACTIVE FILTER BUILDER CARD */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-1)]">
              Multi-Parameter Query Builder
            </h3>
            {/* Conjunction Toggle */}
            <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs ml-2">
              <button
                type="button"
                onClick={() => setConjunction("AND")}
                className={`rounded-md px-2.5 py-0.5 font-bold transition ${
                  conjunction === "AND"
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                }`}
              >
                ALL (AND)
              </button>
              <button
                type="button"
                onClick={() => setConjunction("OR")}
                className={`rounded-md px-2.5 py-0.5 font-bold transition ${
                  conjunction === "OR"
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                }`}
              >
                ANY (OR)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reporting Basis */}
            <select
              value={reportingBasis}
              onChange={(e) => setReportingBasis(e.target.value as "CONSOLIDATED" | "STANDALONE")}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-2)] focus:outline-none"
            >
              <option value="CONSOLIDATED">Consolidated Basis</option>
              <option value="STANDALONE">Standalone Basis</option>
            </select>

            {/* Financial Sector Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-2)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFinancials}
                onChange={(e) => setIncludeFinancials(e.target.checked)}
                className="rounded border-[var(--border)] bg-[var(--bg-input)] text-[var(--accent)] focus:ring-0"
              />
              <span>Include Financials / Banks</span>
            </label>
          </div>
        </div>

        {/* Condition Rows */}
        {conditions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-[var(--text-3)]">
            No filter criteria applied. Showing all companies in the local database. Click &ldquo;+ Add Condition&rdquo; or select a preset screen above.
          </div>
        ) : (
          <div className="space-y-2.5">
            {conditions.map((cond, idx) => {
              const def: MetricDefinition = AVAILABLE_METRICS.find((m) => m.field === cond.field) || {
                field: cond.field,
                label: cond.field,
                category: "General",
                defaultOperator: ">=",
                defaultValue: 0,
                unit: "",
                isIndustrialOnly: false,
                isBankingOnly: false,
              };
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2.5 rounded-lg bg-[var(--bg-elevated)]/60 p-2.5 border border-white/5 text-xs"
                >
                  <span className="font-mono text-[11px] text-[var(--text-3)] w-5">
                    #{idx + 1}
                  </span>

                  {/* Metric Select */}
                  <select
                    value={cond.field}
                    onChange={(e) => {
                      const newField = e.target.value;
                      const metricDef = AVAILABLE_METRICS.find((m) => m.field === newField);
                      handleUpdateCondition(idx, {
                        field: newField,
                        operator: metricDef?.defaultOperator || ">=",
                        value: metricDef?.defaultValue ?? 0,
                      });
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] min-w-[200px]"
                  >
                    {AVAILABLE_METRICS.map((m) => (
                      <option key={m.field} value={m.field}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      handleUpdateCondition(idx, { operator: e.target.value as FilterOperator })
                    }
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-mono font-bold text-[var(--accent)] focus:outline-none"
                  >
                    <option value=">=">&gt;= (At least)</option>
                    <option value="<=">&lt;= (At most)</option>
                    <option value=">">&gt; (Greater than)</option>
                    <option value="<">&lt; (Less than)</option>
                    <option value="==">== (Exactly)</option>
                    <option value="!=">!= (Not equal)</option>
                    <option value="between">between (Range)</option>
                  </select>

                  {/* Target Value Input */}
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="any"
                      value={cond.value as number}
                      onChange={(e) =>
                        handleUpdateCondition(idx, { value: parseFloat(e.target.value) || 0 })
                      }
                      className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    {def.unit && (
                      <span className="ml-1.5 text-[11px] font-mono text-[var(--text-3)]">
                        {def.unit}
                      </span>
                    )}
                  </div>

                  {/* Second Value for between */}
                  {cond.operator === "between" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-3)]">and</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Max"
                        value={(cond.second_value as number) ?? ""}
                        onChange={(e) =>
                          handleUpdateCondition(idx, {
                            second_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                  )}

                  {/* Industrial / Banking Indicator */}
                  {def.isIndustrialOnly && (
                    <span className="text-[10px] text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      Non-Financial Only
                    </span>
                  )}
                  {def.isBankingOnly && (
                    <span className="text-[10px] text-sky-400/80 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">
                      Banking Only
                    </span>
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(idx)}
                    className="ml-auto text-[var(--text-3)] hover:text-rose-400 transition p-1"
                    title="Remove filter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Builder Toolbar Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] transition"
            >
              <Plus className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Add Condition</span>
            </button>

            {conditions.length > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[var(--text-3)] hover:text-[var(--text-1)] px-2 transition"
              >
                Reset All
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save Screen Button */}
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] transition"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Save Screen</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] transition"
              title="Download results as CSV"
            >
              <Download className="h-3.5 w-3.5 text-[var(--accent-2)]" />
              <span>Export CSV</span>
            </button>

            {/* Run / Refetch Screen */}
            <button
              type="button"
              onClick={() => screenQuery.refetch()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-black hover:opacity-90 transition shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Execute Screen</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. RESULTS STATUS & METRIC SUMMARY BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-1)]">
            {results?.total_count ?? 0}
          </span>
          <span className="text-[var(--text-3)]">
            companies matching filter criteria ({results?.applied_filter_count ?? 0} active conditions)
          </span>
        </div>

        {/* Sort By Selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-3)]">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-1)] focus:outline-none"
          >
            <option value="market_cap">Market Cap</option>
            <option value="roce">ROCE %</option>
            <option value="roe">ROE %</option>
            <option value="pe">P/E Ratio</option>
            <option value="revenue_cagr_3y">3Y Revenue CAGR</option>
            <option value="debt_to_equity">Debt to Equity</option>
            <option value="altman">Altman Z-Score</option>
            <option value="piotroski">Piotroski F-Score</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1 text-[var(--text-2)] hover:text-[var(--text-1)]"
            title={`Toggle Sort Direction (${sortDirection.toUpperCase()})`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4. RESULTS TABLE */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 text-[var(--text-3)] font-semibold">
                <th className="py-3 px-4">Company & Symbol</th>
                <th className="py-3 px-3">Sector</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">Market Cap</th>
                <th className="py-3 px-3 text-right">P/E</th>
                <th className="py-3 px-3 text-right">P/B</th>
                <th className="py-3 px-3 text-right">ROCE %</th>
                <th className="py-3 px-3 text-right">ROE %</th>
                <th className="py-3 px-3 text-right">D/E</th>
                <th className="py-3 px-3 text-right">3Y Rev CAGR</th>
                <th className="py-3 px-3 text-center">Altman Z</th>
                <th className="py-3 px-3 text-center">Piotroski F</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {isLoading && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-xs text-[var(--text-3)]">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[var(--accent)] mb-2" />
                    <span>Evaluating screener query across equity universe...</span>
                  </td>
                </tr>
              )}

              {!isLoading && results && results.items.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-xs text-[var(--text-3)]">
                    <Filter className="mx-auto h-6 w-6 text-[var(--text-3)] mb-2" />
                    <p className="font-bold text-[var(--text-2)]">No Companies Matched</p>
                    <p className="mt-1">
                      Try relaxing your filter conditions or switching conjunction to &ldquo;ANY (OR)&rdquo;.
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                results?.items.map((item) => (
                  <tr
                    key={item.company_id}
                    className="hover:bg-white/[0.02] transition cursor-pointer"
                  >
                    {/* Company & Symbol */}
                    <td className="py-3 px-4 font-sans">
                      <Link
                        href={`/companies/${item.company_id}`}
                        className="group block"
                      >
                        <div className="font-bold text-[var(--text-1)] group-hover:text-[var(--accent)] transition">
                          {item.company_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] font-mono mt-0.5">
                          <span>{item.symbol}</span>
                          <span>•</span>
                          <span className="rounded bg-white/5 px-1 py-0.2 text-[10px]">
                            {item.exchange}
                          </span>
                          {item.is_financial_sector && (
                            <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 text-[10px]">
                              FIN
                            </span>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Sector */}
                    <td className="py-3 px-3 font-sans text-[var(--text-2)] text-[11px]">
                      {item.sector_name}
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3 text-right font-bold text-[var(--text-1)]">
                      {item.current_price != null ? (
                        formatINR(item.current_price)
                      ) : (
                        <MissingValue reason="No EOD quote available" />
                      )}
                    </td>

                    {/* Market Cap */}
                    <td className="py-3 px-3 text-right font-medium text-[var(--text-1)]">
                      {item.market_cap_cr != null ? (
                        formatCrores(item.market_cap_cr, true)
                      ) : (
                        <MissingValue reason="Shares or price missing" />
                      )}
                    </td>

                    {/* P/E */}
                    <td className="py-3 px-3 text-right text-[var(--text-1)]">
                      {item.pe_ratio != null ? (
                        formatRatio(item.pe_ratio)
                      ) : (
                        <MissingValue reason="Earnings <= 0 or missing" />
                      )}
                    </td>

                    {/* P/B */}
                    <td className="py-3 px-3 text-right text-[var(--text-1)]">
                      {item.pb_ratio != null ? (
                        formatRatio(item.pb_ratio)
                      ) : (
                        <MissingValue reason="Book equity missing" />
                      )}
                    </td>

                    {/* ROCE % */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {item.roce_pct != null ? (
                        formatPercent(item.roce_pct)
                      ) : item.is_financial_sector ? (
                        <span className="text-[10px] text-sky-400">N/A (Bank)</span>
                      ) : (
                        <MissingValue reason="Missing ROCE facts" />
                      )}
                    </td>

                    {/* ROE % */}
                    <td className="py-3 px-3 text-right font-bold text-[var(--accent)]">
                      {item.roe_pct != null ? (
                        formatPercent(item.roe_pct)
                      ) : (
                        <MissingValue reason="Negative equity" />
                      )}
                    </td>

                    {/* Debt to Equity */}
                    <td className="py-3 px-3 text-right text-[var(--text-1)]">
                      {item.debt_to_equity != null ? (
                        formatRatio(item.debt_to_equity)
                      ) : item.is_financial_sector ? (
                        <span className="text-[10px] text-sky-400 font-sans">BYPASS</span>
                      ) : (
                        <MissingValue reason="Zero debt or equity" />
                      )}
                    </td>

                    {/* 3Y Sales CAGR */}
                    <td className="py-3 px-3 text-right text-[var(--text-1)]">
                      {item.revenue_cagr_3y != null ? (
                        formatPercent(item.revenue_cagr_3y)
                      ) : (
                        <MissingValue reason="< 4 fiscal years" />
                      )}
                    </td>

                    {/* Altman Z-Score */}
                    <td className="py-3 px-3 text-center">
                      {item.altman_z_score != null ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.altman_zone === "SAFE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : item.altman_zone === "GREY"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {item.altman_z_score.toFixed(1)}
                        </span>
                      ) : item.is_financial_sector ? (
                        <span className="text-[10px] text-sky-400 font-sans">BYPASS</span>
                      ) : (
                        <MissingValue reason="Balance sheet facts missing" />
                      )}
                    </td>

                    {/* Piotroski F-Score */}
                    <td className="py-3 px-3 text-center">
                      {item.piotroski_f_score != null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.piotroski_f_score >= 8
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : item.piotroski_f_score >= 5
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {item.piotroski_f_score} / 9
                        </span>
                      ) : (
                        <MissingValue reason="Insufficient statement history" />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* 5. PAGINATION CONTROLS */}
        {results && results.total_pages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--bg-elevated)]/30 text-xs">
            <span className="text-[var(--text-3)]">
              Page {results.page} of {results.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(results.total_pages, p + 1))}
                disabled={page >= results.total_pages}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. SAVE SCREEN MODAL */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-[var(--accent)]" />
                <h4 className="text-sm font-bold text-[var(--text-1)]">
                  Save Screener Query
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-2)] mb-1">
                  Screen Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. High ROCE Low Debt Compounders"
                  value={saveScreenName}
                  onChange={(e) => setSaveScreenName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-2)] mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Screens companies generating > 20% return on capital with negligible balance sheet debt."
                  value={saveScreenDesc}
                  onChange={(e) => setSaveScreenDesc(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="rounded bg-[var(--bg-card)] p-2.5 text-[11px] text-[var(--text-3)]">
                Will persist {conditions.length} active conditions ({conjunction} logic) sorted by {sortBy}.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!saveScreenName.trim() || saveScreenMutation.isPending}
                onClick={() =>
                  saveScreenMutation.mutate({
                    name: saveScreenName.trim(),
                    description: saveScreenDesc.trim() || undefined,
                    filter_expression: {
                      conjunction,
                      conditions,
                    },
                    sort_by: sortBy,
                    sort_direction: sortDirection,
                  })
                }
                className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-black hover:opacity-90 disabled:opacity-50"
              >
                {saveScreenMutation.isPending ? "Saving..." : "Save Query"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
