"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Layers,
  Calendar,
  Filter,
  Info,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
} from "lucide-react";
import type {
  FactProvenanceDetail,
  FinancialStatementMatrixResponse,
  AvailablePeriodsResponse,
} from "@/types/financials";
import {
  fetchCompanyStatements,
  fetchAvailableStatementPeriods,
  seedCompanyFinancials,
} from "@/lib/api-client";
import { SourceTraceabilityDrawer } from "./SourceTraceabilityDrawer";
import { MissingValue } from "@/components/common/MissingValue";

interface StatementViewerProps {
  companyId: number;
  companyName: string;
  isFinancialSector?: boolean;
}

export function StatementViewer({
  companyId,
  companyName,
  isFinancialSector = false,
}: StatementViewerProps) {
  const queryClient = useQueryClient();

  const [statementType, setStatementType] = useState<
    "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW"
  >("INCOME_STATEMENT");
  const [reportingBasis, setReportingBasis] = useState<"CONSOLIDATED" | "STANDALONE">("CONSOLIDATED");
  const [periodType, setPeriodType] = useState<"ANNUAL" | "QUARTERLY">("ANNUAL");

  // Selected cell for provenance drawer
  const [selectedFact, setSelectedFact] = useState<FactProvenanceDetail | null>(null);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Available periods query
  const { data: available } = useQuery<AvailablePeriodsResponse>({
    queryKey: ["statement-available-periods", companyId],
    queryFn: () => fetchAvailableStatementPeriods(companyId),
    enabled: !!companyId,
  });

  // Statement matrix query
  const {
    data: matrix,
    isLoading,
    isError,
    refetch,
  } = useQuery<FinancialStatementMatrixResponse>({
    queryKey: ["company-statements", companyId, statementType, reportingBasis, periodType],
    queryFn: () => fetchCompanyStatements(companyId, statementType, reportingBasis, periodType),
    enabled: !!companyId,
  });

  // Seed sample financials mutation
  const seedMutation = useMutation({
    mutationFn: () => seedCompanyFinancials(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-statements", companyId] });
      queryClient.invalidateQueries({ queryKey: ["statement-available-periods", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-corporate-actions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-shareholding", companyId] });
      refetch();
    },
  });

  const handleCellClick = (fact: FactProvenanceDetail | null, periodLabel: string) => {
    if (!fact) return;
    setSelectedFact(fact);
    setSelectedPeriodLabel(periodLabel);
    setIsDrawerOpen(true);
  };

  const formatCellValue = (val: number | string | null | undefined, unit: string) => {
    if (val == null || val === "") return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    if (unit === "PERCENTAGE") return `${num.toFixed(2)}%`;
    if (unit === "PER_SHARE") return `₹${num.toFixed(2)}`;
    // Absolute crores
    if (num < 0) {
      return `(₹${Math.abs(num).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasData = matrix && matrix.periods.length > 0 && matrix.rows.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Operational Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Statement Type Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-white/[0.08] dark:bg-[#131b2e]">
            {[
              { id: "INCOME_STATEMENT", label: "Profit & Loss (P&L)" },
              { id: "BALANCE_SHEET", label: "Balance Sheet" },
              { id: "CASH_FLOW", label: "Cash Flow" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setStatementType(tab.id as "INCOME_STATEMENT" | "BALANCE_SHEET" | "CASH_FLOW")
                }
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  statementType === tab.id
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Basis and Period Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Reporting Basis: Consolidated vs Standalone */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">Basis:</span>
              <div className="inline-flex rounded-xl border border-slate-200/80 p-0.5 dark:border-white/[0.08] dark:bg-[#131b2e]">
                <button
                  type="button"
                  onClick={() => setReportingBasis("CONSOLIDATED")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    reportingBasis === "CONSOLIDATED"
                      ? "bg-slate-900 text-white dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Consolidated
                </button>
                <button
                  type="button"
                  onClick={() => setReportingBasis("STANDALONE")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    reportingBasis === "STANDALONE"
                      ? "bg-slate-900 text-white dark:bg-[#00D3F3] dark:text-slate-950 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Standalone
                </button>
              </div>
            </div>

            {/* Period Type: Annual vs Quarterly */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">Period:</span>
              <div className="inline-flex rounded-xl border border-slate-200/80 p-0.5 dark:border-white/[0.08] dark:bg-[#131b2e]">
                <button
                  type="button"
                  onClick={() => setPeriodType("ANNUAL")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    periodType === "ANNUAL"
                      ? "bg-[#00D3F3] text-slate-950 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Annual (10Y/5Y)
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodType("QUARTERLY")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    periodType === "QUARTERLY"
                      ? "bg-[#00D3F3] text-slate-950 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend / Info bar */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              All statement aggregates standardized in{" "}
              <strong className="text-slate-700 dark:text-white font-mono">₹ Crores</strong> (Per-share metrics in{" "}
              <strong className="text-slate-700 dark:text-white font-mono">INR</strong>).
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-[#00E676]">
              <CheckCircle2 className="h-3 w-3" />
              <span>Double-entry verified</span>
            </span>
          </div>
          <span className="italic text-[#00D3F3]">Click any cell to open verified source filing provenance</span>
        </div>
      </div>

      {/* Main Table View */}
      {isLoading && (
        <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Could not load financial statements for {companyName}.
        </div>
      )}

      {!isLoading && !isError && !hasData && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-400" />
          <h4 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
            No {reportingBasis.toLowerCase()} {periodType.toLowerCase()} statements found
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Upload audited financial statement CSVs in Data Management, or seed verified benchmark
            statements for this company to test the multi-period analytical matrix.
          </p>

          <button
            type="button"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {seedMutation.isPending ? "Seeding Audited Financials..." : "Seed Verified Multi-Year Financials"}
            </span>
          </button>
        </div>
      )}

      {!isLoading && !isError && hasData && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Financial Statements Matrix">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/60">
                  <th className="sticky left-0 z-10 bg-[var(--bg-card)]/95 py-3.5 pl-6 pr-4 font-bold text-[var(--text-1)] backdrop-blur min-w-[260px]">
                    Financial Line Item
                  </th>
                  {matrix.periods.map((period) => (
                    <th
                      key={period.statement_id}
                      className="py-3.5 px-4 text-right font-mono font-bold text-[var(--text-1)] min-w-[120px]"
                    >
                      <div className="flex flex-col items-end">
                        <span>{period.display_label}</span>
                        <span className="text-[10px] font-normal text-[var(--text-3)]">
                          {period.is_audited ? "Audited" : "Unaudited"}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {matrix.rows.map((row) => {
                  const isMajorHeader =
                    row.metric_code === "REVENUE" ||
                    row.metric_code === "TOTAL_INCOME" ||
                    row.metric_code === "EBITDA" ||
                    row.metric_code === "PAT" ||
                    row.metric_code === "TOTAL_EQUITY" ||
                    row.metric_code === "TOTAL_ASSETS" ||
                    row.metric_code === "OPERATING_CASH_FLOW";

                  return (
                    <tr
                      key={row.metric_code}
                      className={`hover:bg-[var(--accent)]/5 transition ${
                        isMajorHeader ? "bg-white/[0.02] font-semibold" : ""
                      }`}
                    >
                      {/* Metric Name */}
                      <td className="sticky left-0 z-10 bg-[var(--bg-card)] py-3 pl-6 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-1)]">
                            {row.metric_name}
                          </span>
                          {row.unit === "PER_SHARE" && (
                            <span className="rounded bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-[var(--text-3)] border border-[var(--border)]">
                              ₹
                            </span>
                          )}
                          {row.unit === "PERCENTAGE" && (
                            <span className="rounded bg-white/5 px-1.5 py-0.2 font-mono text-[9px] text-[var(--text-3)] border border-[var(--border)]">
                              %
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Period Values (Strict Data Integrity: NULL != 0, MissingValue Atom) */}
                      {matrix.periods.map((period) => {
                        const val = row.values[period.display_label];
                        const factDetail = row.details[period.display_label];

                        return (
                          <td
                            key={period.statement_id}
                            onClick={() => handleCellClick(factDetail, period.display_label)}
                            className={`py-3 px-4 text-right font-mono tabular-nums transition ${
                              factDetail
                                ? "cursor-pointer hover:bg-[var(--accent)]/10 group"
                                : ""
                            }`}
                            title={
                              factDetail
                                ? `Click to inspect source filing for ${row.metric_name} (${period.display_label})`
                                : `Not reported in ${period.display_label} filing`
                            }
                          >
                            {val != null ? (
                              <span
                                className={`inline-block ${
                                  val < 0
                                    ? "text-[var(--down)] font-medium"
                                    : "text-[var(--text-1)]"
                                } ${factDetail ? "group-hover:text-[var(--accent)]" : ""}`}
                              >
                                {formatCellValue(val, row.unit)}
                              </span>
                            ) : (
                              <MissingValue reason={`Not reported in ${period.display_label} filing`} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provenance Drawer */}
      <SourceTraceabilityDrawer
        fact={selectedFact}
        periodLabel={selectedPeriodLabel}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
