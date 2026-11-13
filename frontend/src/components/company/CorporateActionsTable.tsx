"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Calendar, DollarSign, Layers, Split, TrendingUp } from "lucide-react";
import type { CorporateActionDetail } from "@/types/financials";
import { fetchCompanyCorporateActions } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { MissingValue } from "@/components/common/MissingValue";

interface CorporateActionsTableProps {
  companyId: number;
  companyName: string;
}

export function CorporateActionsTable({
  companyId,
  companyName,
}: CorporateActionsTableProps) {
  const {
    data: actions,
    isLoading,
    isError,
  } = useQuery<CorporateActionDetail[]>({
    queryKey: ["company-corporate-actions", companyId],
    queryFn: () => fetchCompanyCorporateActions(companyId),
    enabled: !!companyId,
  });

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "DIVIDEND":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <DollarSign className="h-3 w-3" />
            <span>Dividend</span>
          </span>
        );
      case "SPLIT":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
            <Split className="h-3 w-3" />
            <span>Stock Split</span>
          </span>
        );
      case "BONUS":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Award className="h-3 w-3" />
            <span>Bonus Issue</span>
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {actionType}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Corporate Actions &amp; Capital Adjustments
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Historical record of dividends, stock splits, and bonus issues with exact multiplier tracking.
        </p>

        {isLoading && (
          <div className="mt-4 h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
        )}

        {isError && (
          <div className="mt-4 rounded-xl bg-rose-500/10 p-4 text-xs text-rose-500">
            Could not retrieve corporate actions for {companyName}.
          </div>
        )}

        {!isLoading && !isError && (!actions || actions.length === 0) && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            No corporate actions recorded for {companyName}.
          </div>
        )}

        {!isLoading && !isError && actions && actions.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-white/[0.08]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/[0.08] dark:bg-[#131b2e] dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Ex-Date</th>
                  <th className="py-3 px-4">Record Date</th>
                  <th className="py-3 px-4 text-right">Details</th>
                  <th className="py-3 px-4">Notes & Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {actions.map((act) => (
                  <tr
                    key={act.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4">{getActionBadge(act.action_type)}</td>
                    <td className="py-3 px-4 font-mono text-[var(--text-2)]">
                      {act.ex_date ? formatDate(act.ex_date) : <MissingValue reason="Ex-date not specified" />}
                    </td>
                    <td className="py-3 px-4 font-mono text-[var(--text-3)]">
                      {act.record_date ? formatDate(act.record_date) : <MissingValue reason="Record date not announced" />}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--text-1)]">
                      {act.action_type === "DIVIDEND" && act.dividend_amount != null && (
                        <span>₹{Number(act.dividend_amount).toFixed(2)} / share</span>
                      )}
                      {act.action_type === "SPLIT" && act.ratio_numerator && act.ratio_denominator && (
                        <span>
                          {act.ratio_numerator}:{act.ratio_denominator}
                        </span>
                      )}
                      {act.action_type === "BONUS" && act.ratio_numerator && act.ratio_denominator && (
                        <span>
                          {act.ratio_numerator}:{act.ratio_denominator}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-3)]">
                      {act.action_summary || act.notes || <MissingValue reason="No notes filed" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
