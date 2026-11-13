"use client";

import React from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

interface FreshnessChipProps {
  date?: string | null;
  stalenessThresholdDays?: number;
  className?: string;
}

/**
 * Data Freshness Chip:
 * Displays "EOD as of [date]" with amber "Stale" chip if older than threshold.
 */
export function FreshnessChip({
  date,
  stalenessThresholdDays = 5,
  className = "",
}: FreshnessChipProps) {
  if (!date) return null;

  const snapshotDate = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = diffDays > stalenessThresholdDays;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-[var(--text-2)] border border-[var(--border)]">
        <Clock className="h-3 w-3 text-[var(--text-3)]" />
        <span>EOD as of {formatDate(date)}</span>
      </span>

      {isStale && (
        <span
          className="inline-flex items-center gap-1 rounded-md bg-[var(--warn)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warn)] border border-[var(--warn)]/20"
          title={`Data is ${diffDays} days old`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>Stale ({diffDays}d)</span>
        </span>
      )}
    </div>
  );
}
