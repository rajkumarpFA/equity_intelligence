"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  Compass,
  Database,
  Eye,
  Filter,
  LayoutDashboard,
  Settings,
  TrendingUp,
  HelpCircle,
  Mail,
  User,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Stock Discovery", href: "/discover", icon: Compass },
  { name: "Stock Screener", href: "/screener", icon: Filter },
  { name: "Company Research", href: "/companies", icon: Building2 },
  { name: "Competitor Analysis", href: "/compare", icon: BarChart3 },
  { name: "Valuation Workbench", href: "/valuation", icon: Calculator },
  { name: "Watchlists", href: "/watchlists", icon: Eye },
  { name: "Investment Journal", href: "/journal", icon: BookOpen },
  { name: "Data Management", href: "/data-management", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-card)] transition-colors select-none"
      aria-label="Primary Navigation"
    >
      {/* Brand Header with Sambucus & Gold/Sky Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--bg-card)] via-[#172554] to-[var(--accent)] p-0.5 shadow-sm ring-1 ring-white/10">
          <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[var(--bg-card)] text-[var(--accent)]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-2)] opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-2)]"></span>
          </span>
        </div>
        <div>
          <span className="block text-sm font-bold tracking-tight text-[var(--text-1)]">
            Equity Intelligence
          </span>
          <span className="block text-[11px] font-medium text-[var(--text-3)]">
            NSE &amp; BSE Research Terminal
          </span>
        </div>
      </div>

      {/* Nav items: stacked, active = sky icon inside circular ring */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.name}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30 font-bold"
                  : "text-[var(--text-2)] hover:bg-white/5 hover:text-[var(--text-1)]"
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--bg-base)] shadow-sm"
                    : "text-[var(--text-3)] group-hover:text-[var(--text-1)] group-hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </div>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pinned Bottom Utilities */}
      <div className="border-t border-[var(--border)] p-3 space-y-2">
        <div className="flex items-center justify-around py-1">
          <Link
            href="/settings"
            title="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)] transition"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <a
            href="mailto:support@equityintelligence.local"
            title="Support"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)] transition"
          >
            <Mail className="h-4 w-4" />
          </a>
          <button
            type="button"
            title="Help & Manual"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] hover:bg-white/5 hover:text-[var(--text-1)] transition"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <div
            title="Personal Analyst"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg-base)] font-mono text-[10px] font-bold"
          >
            PA
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-2 text-[11px] text-[var(--text-3)] text-center">
          <span className="font-semibold text-[var(--text-2)]">Personal Research Mode</span>
          <p className="text-[10px] text-[var(--text-3)] mt-0.5">Deterministic Analysis • No Broker Execution</p>
        </div>
      </div>
    </aside>
  );
}
