"use client";

import {
  FileText,
  ShieldCheck,
  Hash,
  Download,
  Calendar,
  Layers,
  X,
  ExternalLink,
} from "lucide-react";
import type { FactProvenanceDetail } from "@/types/financials";
import { getDocumentDownloadUrl } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { ValidationBadge } from "@/components/common/ValidationBadge";

interface SourceTraceabilityDrawerProps {
  fact: FactProvenanceDetail | null;
  periodLabel: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SourceTraceabilityDrawer({
  fact,
  periodLabel,
  isOpen,
  onClose,
}: SourceTraceabilityDrawerProps) {
  if (!isOpen || !fact) return null;

  const downloadUrl = fact.source_document_id
    ? getDocumentDownloadUrl(fact.source_document_id)
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
          <div className="flex h-full flex-col overflow-y-scroll p-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--accent)]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)]">
                    {fact.metric_code}
                  </span>
                  {fact.is_restated && (
                    <span className="rounded bg-[var(--accent-2)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--accent-2)]">
                      Restated Filing
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 text-base font-bold text-[var(--text-1)]">
                  {fact.metric_name}
                </h3>
                <p className="text-xs text-[var(--text-3)]">
                  Period: <span className="font-semibold text-[var(--text-2)]">{periodLabel}</span> • Category: {fact.category}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Fact Values Comparison */}
            <div className="mt-5 space-y-4">
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
                  Normalized Metric Value
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-[var(--text-1)] font-mono tabular-nums">
                    {fact.formatted_value || `₹${fact.value} ${fact.unit}`}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-3)]">
                    ({fact.unit})
                  </span>
                </div>
              </div>

              {/* Provenance Traceability Grid */}
              <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
                <h4 className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-1)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--up)]" />
                  <span>Audit &amp; Source Provenance</span>
                </h4>

                <div className="mt-3 divide-y divide-[var(--border)] text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-[var(--text-3)]">Raw As-Filed Value:</span>
                    <span className="font-mono font-bold text-[var(--text-1)]">
                      {fact.raw_value ?? "Not reported"}
                    </span>
                  </div>

                  <div className="flex justify-between py-2">
                    <span className="text-[var(--text-3)]">Raw As-Filed Label:</span>
                    <span className="font-medium text-[var(--text-2)] text-right max-w-[220px]">
                      {fact.raw_label ?? fact.metric_name}
                    </span>
                  </div>

                  <div className="flex justify-between py-2">
                    <span className="text-[var(--text-3)]">Currency / Unit:</span>
                    <span className="font-medium text-[var(--text-2)] font-mono">
                      {fact.currency} • {fact.unit}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 items-center">
                    <span className="text-[var(--text-3)]">Validation Status:</span>
                    <ValidationBadge status={fact.validation_status} />
                  </div>

                  {fact.line_number != null && (
                    <div className="flex justify-between py-2">
                      <span className="text-[var(--text-3)]">Report Line / Page:</span>
                      <span className="font-mono font-medium text-[var(--text-1)]">
                        Page #{fact.line_number}
                      </span>
                    </div>
                  )}

                  {fact.extraction_timestamp && (
                    <div className="flex justify-between py-2">
                      <span className="text-[var(--text-3)]">Extraction Timestamp:</span>
                      <span className="text-[var(--text-2)] font-mono">
                        {formatDate(fact.extraction_timestamp)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Source Document File Card */}
              {fact.source_document_name ? (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-[var(--accent)]" />
                    <div className="flex-1 min-w-0">
                      <h5 className="truncate text-xs font-bold text-[var(--text-1)]">
                        {fact.source_document_name}
                      </h5>
                      {fact.source_document_hash && (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-3)]">
                          SHA-256: {fact.source_document_hash}
                        </p>
                      )}
                    </div>
                  </div>

                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-input)] bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-[#00bee0] transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download / Open Source Filing</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center text-xs text-[var(--text-3)]">
                  <p>Derived from official exchange filings &amp; structured XBRL statements.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-white/5 py-2 text-xs font-bold text-[var(--text-2)] hover:bg-white/10 hover:text-[var(--text-1)] transition"
              >
                Close Provenance Drawer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
