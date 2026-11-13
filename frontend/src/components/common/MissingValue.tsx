"use client";

import React, { useState } from "react";

interface MissingValueProps {
  reason?: string;
  className?: string;
}

/**
 * Data-Integrity Rule 1: NULL != 0.
 * Strictly renders "N/A" in muted text-3 (#6B7280) with hover tooltip explaining the explicit reason.
 * Never renders "0", a blank string, or an unreasoned dash.
 */
export function MissingValue({
  reason = "Not reported in official filing",
  className = "",
}: MissingValueProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className={`relative inline-flex items-center cursor-help select-none font-mono text-[var(--text-3)] text-xs font-medium ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={reason}
      data-testid="missing-value"
    >
      <span>N/A</span>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap rounded-md bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-sans font-medium text-[var(--text-2)] shadow-xl border border-[var(--border)] ring-1 ring-white/10 pointer-events-none">
          {reason}
        </span>
      )}
    </span>
  );
}
