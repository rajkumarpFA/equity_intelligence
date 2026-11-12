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
      className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900"
      aria-label="Primary Navigation"
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <span className="block text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Equity Intelligence
          </span>
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            NSE &amp; BSE Research
          </span>
        </div>
      </div>

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
              className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <p className="font-semibold text-slate-900 dark:text-slate-200">Personal Research Mode</p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            No broker execution • Deterministic analysis
          </p>
        </div>
      </div>
    </aside>
  );
}
