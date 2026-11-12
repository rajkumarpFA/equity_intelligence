"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { fetchSystemHealth } from "@/lib/api-client";

export function HealthIndicator() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchSystemHealth,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
        <span>Checking backend...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700"
        role="status"
        aria-live="polite"
        title={error instanceof Error ? error.message : "Backend unreachable"}
      >
        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
        <span>API Offline</span>
      </div>
    );
  }

  const healthy = data.status === "healthy" && data.database.connected;

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        healthy
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
      role="status"
      aria-live="polite"
    >
      {healthy ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Activity className="h-3.5 w-3.5 text-amber-600" />
      )}
      <span>
        {healthy
          ? `API & DB Healthy (${data.database.latency_ms ?? "—"} ms)`
          : "API Degraded (DB Disconnected)"}
      </span>
    </div>
  );
}
