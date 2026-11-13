"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, Plus, Loader2, Database, X, Bell, FileText } from "lucide-react";
import { HealthIndicator } from "@/components/common/HealthIndicator";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { FreshnessChip } from "@/components/common/FreshnessChip";
import { lookupAndAddCompany } from "@/lib/api-client";
import Link from "next/link";

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  snapshotDate?: string | null;
}

export function Header({ title, subtitle, breadcrumb, snapshotDate }: HeaderProps) {
  const router = useRouter();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddSymbol, setQuickAddSymbol] = useState("");
  const [quickAddExchange, setQuickAddExchange] = useState<"NSE" | "BSE">("NSE");
  const [isAdding, setIsAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddSymbol.trim() || isAdding) return;
    setIsAdding(true);
    setQuickAddError(null);

    try {
      const added = await lookupAndAddCompany(quickAddSymbol.trim().toUpperCase(), quickAddExchange);
      setIsQuickAddOpen(false);
      setQuickAddSymbol("");
      router.push(`/companies/${added.id}`);
    } catch (err: unknown) {
      setQuickAddError(err instanceof Error ? err.message : "Failed to lookup/add company");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)]/90 px-6 backdrop-blur-md transition-colors">
        {/* Left: Breadcrumb or Title */}
        <div className="flex items-center gap-3">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav className="flex items-center gap-2 text-xs text-[var(--text-3)]" aria-label="Breadcrumb">
              {breadcrumb.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[var(--text-1)] transition"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-[var(--text-1)]">
                      {crumb.label}
                    </span>
                  )}
                  {idx < breadcrumb.length - 1 && <span className="opacity-40">/</span>}
                </div>
              ))}
            </nav>
          ) : (
            <div>
              <h1 className="text-base font-bold tracking-tight text-[var(--text-1)]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-[var(--text-3)]">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Center: Global Search Pill (Section 3 Spec: Full radius, ~340-480px, border only) */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <Link
            href="/discover"
            className="group flex w-full items-center justify-between rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--bg-input)] px-4 py-1.5 text-xs text-[var(--text-3)] transition hover:border-white/20"
          >
            <div className="flex items-center gap-2.5">
              <Search className="h-3.5 w-3.5 text-[var(--text-3)] group-hover:text-[var(--text-1)]" />
              <span className="group-hover:text-[var(--text-2)]">Search companies, ISIN, symbols...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--border)] bg-white/5 px-1.5 text-[10px] font-mono font-semibold text-[var(--text-3)]">
              ⌘K
            </kbd>
          </Link>
        </div>

        {/* Right Cluster: Freshness Chip, Database Link, Health Dot, Avatar */}
        <div className="flex items-center gap-3">
          {/* Freshness Chip */}
          <FreshnessChip date={snapshotDate ?? "2026-11-12"} />

          <Link
            href="/data-management"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)] transition"
            title="Data Management & Uploads"
          >
            <Database className="h-4 w-4" />
          </Link>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* API Health Dot (Green/Amber/Red) */}
          <HealthIndicator />

          {/* User Avatar */}
          <div
            title="Active Researcher"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--bg-elevated)] to-[var(--accent)]/30 border border-[var(--border)] text-[10px] font-bold font-mono text-[var(--text-1)]"
          >
            EQ
          </div>
        </div>
      </header>

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-2)]/15 text-[var(--accent-2)]">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-1)]">
                  On-Demand Stock Lookup &amp; Add
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="rounded-lg p-1 text-[var(--text-3)] hover:bg-white/10 hover:text-[var(--text-1)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)]">
                  Trading Symbol or Scrip Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. INFY, ITC, SBIN, 500325"
                  value={quickAddSymbol}
                  onChange={(e) => setQuickAddSymbol(e.target.value)}
                  className="mt-1.5 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-1)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-2)]">
                  Target Exchange
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickAddExchange("NSE")}
                    className={`rounded-[var(--radius-input)] border px-3 py-1.5 text-xs font-bold transition ${
                      quickAddExchange === "NSE"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] bg-white/5 text-[var(--text-3)]"
                    }`}
                  >
                    NSE (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddExchange("BSE")}
                    className={`rounded-[var(--radius-input)] border px-3 py-1.5 text-xs font-bold transition ${
                      quickAddExchange === "BSE"
                        ? "border-[var(--accent-2)] bg-[var(--accent-2)]/10 text-[var(--accent-2)]"
                        : "border-[var(--border)] bg-white/5 text-[var(--text-3)]"
                    }`}
                  >
                    BSE
                  </button>
                </div>
              </div>

              {quickAddError && (
                <div className="rounded-[var(--radius-input)] border border-[var(--down)]/20 bg-[var(--down)]/10 p-2.5 text-xs font-medium text-[var(--down)]">
                  {quickAddError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="rounded-[var(--radius-input)] px-3 py-2 text-xs font-semibold text-[var(--text-3)] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || !quickAddSymbol.trim()}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] bg-[var(--accent)] px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition hover:bg-[#00bee0] disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Resolving Master...</span>
                    </>
                  ) : (
                    <span>Add to Research</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
