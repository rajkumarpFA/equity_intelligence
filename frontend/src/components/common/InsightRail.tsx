"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Star,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Sparkline } from "./Sparkline";
import { formatINR } from "@/lib/format";

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  trend: number[];
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    price: 1339.7,
    changePct: 0.32,
    trend: [1325, 1330, 1328, 1335, 1339.7],
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy",
    price: 4120.5,
    changePct: 2.15,
    trend: [3980, 4010, 4050, 4080, 4120.5],
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    price: 1720.8,
    changePct: -1.25,
    trend: [1755, 1740, 1748, 1730, 1720.8],
  },
];

interface InsightRailProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Section 3 & 3A: 320px Insight Rail
 * Positioned on the right of the 12-column grid. Collapsible, own scroll container.
 * Modules: Watchlist with sparklines, Valuation Prediction, and Equity Sector Progress.
 */
export function InsightRail({ isOpen, onToggle }: InsightRailProps) {
  if (!isOpen) return null;

  return (
    <aside
      className="hidden xl:flex w-[320px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-card)]/90 backdrop-blur-md overflow-y-auto p-4 space-y-6"
      aria-label="Insight Rail"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text-1)]">
            Market Insight
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1 text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)] transition"
          title="Collapse Insight Rail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Module 1: Watchlist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            Active Watchlist
          </span>
          <Link
            href="/watchlists"
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
          >
            Manage ›
          </Link>
        </div>

        <div className="space-y-2">
          {DEFAULT_WATCHLIST.map((item) => (
            <div
              key={item.symbol}
              className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/60 hover:border-white/20 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-[10px] font-bold text-[var(--text-2)]">
                  {item.symbol.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-[var(--text-1)]">
                      {item.symbol}
                    </span>
                    <Star className="h-2.5 w-2.5 text-[var(--accent-2)] fill-[var(--accent-2)]" />
                  </div>
                  <span className="block text-[10px] text-[var(--text-3)] truncate max-w-[90px]">
                    {item.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-right">
                <div className="w-14">
                  <Sparkline
                    data={item.trend}
                    width={55}
                    height={18}
                    isPositive={item.changePct >= 0}
                    color={item.changePct >= 0 ? "var(--up)" : "var(--down)"}
                    showGradient={false}
                  />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-[var(--text-1)] block tabular-nums">
                    {formatINR(item.price)}
                  </span>
                  <span
                    className={`text-[10px] font-bold block tabular-nums ${
                      item.changePct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                    }`}
                  >
                    {item.changePct >= 0 ? `+${item.changePct}%` : `${item.changePct}%`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module 2: Valuation Prediction / Research Anchor */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-2)]" />
            <span className="text-xs font-bold text-[var(--text-1)]">
              Valuation Anchor
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-3)]">RELIANCE</span>
        </div>

        <p className="text-[11px] text-[var(--text-2)] leading-relaxed">
          Base-case DCF fair-value estimate indicates an entry margin of safety of{" "}
          <strong className="text-[var(--up)] font-mono">+12.4%</strong> vs EOD close.
        </p>

        <div className="pt-2 border-t border-[var(--border)] flex justify-between items-center text-[10px] text-[var(--text-3)] font-mono">
          <span>Formula: 2-Stage FCFE</span>
          <Link href="/valuation" className="text-[var(--accent)] font-semibold hover:underline">
            Workbench ›
          </Link>
        </div>
      </div>

      {/* Module 3: Sectors & Universe Coverage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            Sector Coverage
          </span>
          <Link
            href="/discover"
            className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
          >
            Explore ›
          </Link>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--text-1)] block">Technology Services</span>
              <span className="text-[10px] text-[var(--text-3)]">TCS, Infosys</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--accent)]">2 Companies</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--text-1)] block">Energy &amp; Power</span>
              <span className="text-[10px] text-[var(--text-3)]">Reliance, Suzlon</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--accent)]">2 Companies</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--text-1)] block">Banking &amp; Financials</span>
              <span className="text-[10px] text-[var(--text-3)]">HDFC Bank</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--accent-2)]">1 Institution</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--text-1)] block">Automotive &amp; Mobility</span>
              <span className="text-[10px] text-[var(--text-3)]">Tata Motors, Tata Tech</span>
            </div>
            <span className="font-mono text-[11px] font-bold text-[var(--accent)]">2 Companies</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
