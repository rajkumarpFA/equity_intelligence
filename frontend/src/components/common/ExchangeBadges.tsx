"use client";

import React from "react";

interface SecuritySummary {
  id?: number;
  exchange_code: string;
  symbol: string;
  is_primary?: boolean;
}

interface ExchangeBadgesProps {
  securities?: SecuritySummary[];
  listings?: string[];
  primarySymbol?: string;
  className?: string;
}

/**
 * ExchangeBadges Molecule:
 * NSE and BSE exchange code pills for deduplicated company records.
 */
export function ExchangeBadges({
  securities,
  listings,
  primarySymbol,
  className = "",
}: ExchangeBadgesProps) {
  if (securities && securities.length > 0) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {securities.map((sec) => (
          <span
            key={sec.id ?? `${sec.exchange_code}-${sec.symbol}`}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-bold border ${
              sec.exchange_code === "NSE"
                ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/25"
                : "bg-[var(--accent-2)]/10 text-[var(--accent-2)] border-[var(--accent-2)]/25"
            }`}
          >
            {sec.exchange_code}: {sec.symbol}
            {sec.is_primary && " (Primary)"}
          </span>
        ))}
      </div>
    );
  }

  if (listings && listings.length > 0) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {listings.map((ex) => (
          <span
            key={ex}
            className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-bold border ${
              ex === "NSE"
                ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/25"
                : "bg-[var(--accent-2)]/10 text-[var(--accent-2)] border-[var(--accent-2)]/25"
            }`}
          >
            {ex}
            {primarySymbol ? `: ${primarySymbol}` : ""}
          </span>
        ))}
      </div>
    );
  }

  return null;
}
