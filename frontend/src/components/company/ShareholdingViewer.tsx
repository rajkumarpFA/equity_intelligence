"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, AlertTriangle, ShieldCheck } from "lucide-react";
import type { ShareholdingPatternDetail } from "@/types/financials";
import { fetchCompanyShareholding } from "@/lib/api-client";

interface ShareholdingViewerProps {
  companyId: number;
  companyName: string;
}

export function ShareholdingViewer({
  companyId,
  companyName,
}: ShareholdingViewerProps) {
  const {
    data: patterns,
    isLoading,
    isError,
  } = useQuery<ShareholdingPatternDetail[]>({
    queryKey: ["company-shareholding", companyId],
    queryFn: () => fetchCompanyShareholding(companyId),
    enabled: !!companyId,
  });

  const latest = patterns && patterns.length > 0 ? patterns[0] : null;

  return (
    <div className="space-y-6">
      {/* Overview Summary Cards */}
      {latest && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Promoter Holding
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#00D3F3]">
                {Number(latest.promoter_pct).toFixed(2)}%
              </span>
            </div>
            {Number(latest.promoter_pledged_pct) > 0 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-[#F43F5E]">
                <AlertTriangle className="h-3 w-3" />
                <span>{Number(latest.promoter_pledged_pct).toFixed(2)}% Pledged</span>
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-[#00E676]">
                <ShieldCheck className="h-3 w-3" />
                <span>0% Pledged</span>
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              FII (Foreign Inst.)
            </span>
            <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-[#00E676]">
              {Number(latest.fii_pct).toFixed(2)}%
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">Global institutional capital</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              DII (Domestic Inst.)
            </span>
            <div className="mt-1 text-2xl font-extrabold text-[#FDC700]">
              {Number(latest.dii_pct).toFixed(2)}%
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">Mutual funds &amp; insurance</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Public &amp; Others
            </span>
            <div className="mt-1 text-2xl font-extrabold text-sky-500 dark:text-[#00D3F3]">
              {Number(latest.public_pct).toFixed(2)}%
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">Retail &amp; non-institutional</span>
          </div>
        </div>
      )}

      {/* Historical Breakdown Table & Visual Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#101828]">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Quarterly Shareholding Trend
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Quarter-on-quarter ownership movement across promoters, institutions, and retail investors.
        </p>

        {isLoading && (
          <div className="mt-4 h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        )}

        {isError && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Could not load shareholding history for {companyName}.
          </div>
        )}

        {!isLoading && !isError && (!patterns || patterns.length === 0) && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No shareholding data recorded for {companyName}.
          </div>
        )}

        {!isLoading && !isError && patterns && patterns.length > 0 && (
          <div className="mt-5 space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="h-3 w-3 rounded-sm bg-indigo-600" /> Promoter
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="h-3 w-3 rounded-sm bg-emerald-500" /> FII
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="h-3 w-3 rounded-sm bg-amber-500" /> DII
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="h-3 w-3 rounded-sm bg-sky-400" /> Public
              </span>
            </div>

            {/* Visual Stacked Progress Bars */}
            <div className="space-y-3">
              {patterns.map((p) => {
                const prom = Number(p.promoter_pct) || 0;
                const fii = Number(p.fii_pct) || 0;
                const dii = Number(p.dii_pct) || 0;
                const pub = Number(p.public_pct) || 0;

                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {p.period_label || p.period_end}
                      </span>
                      <span className="text-slate-500">
                        Promoter: {prom.toFixed(1)}% • FII: {fii.toFixed(1)}% • DII: {dii.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        style={{ width: `${prom}%` }}
                        className="bg-indigo-600 transition-all"
                        title={`Promoter: ${prom.toFixed(2)}%`}
                      />
                      <div
                        style={{ width: `${fii}%` }}
                        className="bg-emerald-500 transition-all"
                        title={`FII: ${fii.toFixed(2)}%`}
                      />
                      <div
                        style={{ width: `${dii}%` }}
                        className="bg-amber-500 transition-all"
                        title={`DII: ${dii.toFixed(2)}%`}
                      />
                      <div
                        style={{ width: `${pub}%` }}
                        className="bg-sky-400 transition-all"
                        title={`Public: ${pub.toFixed(2)}%`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Table */}
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Promoter %</th>
                    <th className="py-3 px-4 text-right">Pledged %</th>
                    <th className="py-3 px-4 text-right">FII %</th>
                    <th className="py-3 px-4 text-right">DII %</th>
                    <th className="py-3 px-4 text-right">Public %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {patterns.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition font-mono"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {p.period_label || p.period_end}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {Number(p.promoter_pct).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        {Number(p.promoter_pledged_pct) > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {Number(p.promoter_pledged_pct).toFixed(2)}%
                          </span>
                        ) : (
                          "0.00%"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {Number(p.fii_pct).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                        {Number(p.dii_pct).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {Number(p.public_pct).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
