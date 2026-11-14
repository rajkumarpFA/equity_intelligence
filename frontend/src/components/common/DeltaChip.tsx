"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatPercent } from "@/lib/format";

interface DeltaChipProps {
  value?: number | string | null;
  percentage?: number | string | null;
  className?: string;
  showIcon?: boolean;
}

/**
 * DeltaChip Atom: Tinted pill, arrow + sign + %.
 * Color rule: Red/Green are reserved strictly for price/performance direction.
 */
export function DeltaChip({
  value,
  percentage,
  className = "",
  showIcon = true,
}: DeltaChipProps) {
  const rawDelta = percentage ?? value;
  if (rawDelta == null || rawDelta === "") return null;

  const delta = typeof rawDelta === "string" ? parseFloat(rawDelta) : rawDelta;
  if (isNaN(delta)) return null;

  const isUp = delta > 0;
  const isZero = delta === 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
        isZero
          ? "bg-[var(--track)] text-[var(--text-3)]"
          : isUp
          ? "bg-[var(--up)]/10 text-[var(--up)]"
          : "bg-[var(--down)]/10 text-[var(--down)]"
      } ${className}`}
    >
      {showIcon && (
        <>
          {isZero ? (
            <Minus className="h-3 w-3 shrink-0" />
          ) : isUp ? (
            <TrendingUp className="h-3 w-3 shrink-0" />
          ) : (
            <TrendingDown className="h-3 w-3 shrink-0" />
          )}
        </>
      )}
      <span>{formatPercent(delta)}</span>
    </span>
  );
}
