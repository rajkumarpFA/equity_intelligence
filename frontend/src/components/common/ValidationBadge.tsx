"use client";

import React from "react";
import { CheckCircle2, ShieldCheck, AlertCircle, HelpCircle } from "lucide-react";

export type ValidationStatus =
  | "VERIFIED"
  | "PASSED"
  | "CROSS_CHECKED"
  | "NEEDS_REVIEW"
  | "WARNING"
  | "UNVERIFIED"
  | "UNCHECKED"
  | "FAILED";

interface ValidationBadgeProps {
  status: ValidationStatus | string;
  className?: string;
  showIconOnly?: boolean;
}

/**
 * Data-Integrity Rule 4: Validation badge per fact.
 * VERIFIED (green check) · CROSS_CHECKED (sky) · NEEDS_REVIEW (amber) · UNVERIFIED (gray).
 * Uses Icon + Text, never color alone (WCAG compliance).
 */
export function ValidationBadge({
  status,
  className = "",
  showIconOnly = false,
}: ValidationBadgeProps) {
  const norm = status?.toUpperCase() ?? "UNVERIFIED";

  switch (norm) {
    case "VERIFIED":
    case "PASSED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--up)] bg-[var(--up)]/10 border border-[var(--up)]/20 ${className}`}
          title="Fact double-entry verified against primary filings"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {!showIconOnly && <span>Verified</span>}
        </span>
      );

    case "CROSS_CHECKED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 ${className}`}
          title="Fact cross-checked across multi-provider sources"
        >
          <ShieldCheck className="h-3 w-3 shrink-0" />
          {!showIconOnly && <span>Cross-Checked</span>}
        </span>
      );

    case "NEEDS_REVIEW":
    case "WARNING":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warn)] bg-[var(--warn)]/10 border border-[var(--warn)]/20 ${className}`}
          title="Fact flagged for review or restatement divergence"
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          {!showIconOnly && <span>Needs Review</span>}
        </span>
      );

    case "FAILED":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--down)] bg-[var(--down)]/10 border border-[var(--down)]/20 ${className}`}
          title="Accounting identity check failed"
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          {!showIconOnly && <span>Failed Identity</span>}
        </span>
      );

    case "UNVERIFIED":
    case "UNCHECKED":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-3)] bg-white/5 border border-white/10 ${className}`}
          title="Unverified raw ingestion line item"
        >
          <HelpCircle className="h-3 w-3 shrink-0" />
          {!showIconOnly && <span>Unverified</span>}
        </span>
      );
  }
}
