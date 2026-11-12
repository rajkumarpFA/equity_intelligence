import { Header } from "@/components/common/Header";
import {
  Compass,
  Filter,
  Building2,
  BarChart3,
  Calculator,
  Eye,
  Database,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const quickLinks = [
    {
      title: "Stock Discovery",
      desc: "Search canonical NSE & BSE companies and explore sectors.",
      href: "/discover",
      icon: Compass,
      color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      title: "Stock Screener",
      desc: "Custom fundamental filters across growth, health, and valuation.",
      href: "/screener",
      icon: Filter,
      color: "text-purple-600 bg-purple-50 border-purple-100",
    },
    {
      title: "Company Research",
      desc: "In-depth 18-section financial statements and audit provenance.",
      href: "/companies",
      icon: Building2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      title: "Competitor Analysis",
      desc: "Direct multi-company peer comparison matrix.",
      href: "/compare",
      icon: BarChart3,
      color: "text-amber-600 bg-amber-50 border-amber-100",
    },
    {
      title: "Valuation Workbench",
      desc: "DCF scenario models, relative multiples, and margin of safety.",
      href: "/valuation",
      icon: Calculator,
      color: "text-rose-600 bg-rose-50 border-rose-100",
    },
    {
      title: "Watchlists & Journal",
      desc: "Track investment theses, entry rationale, and review dates.",
      href: "/watchlists",
      icon: Eye,
      color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Investment Intelligence Dashboard"
        subtitle="Indian Equity Research & Fundamental Analysis"
      />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Welcome banner */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6 shadow-sm transition-colors dark:border-indigo-950/60 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/40">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome to Equity Intelligence
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              A private, deterministic equity research platform for Indian NSE and BSE markets.
              All valuations, ratios, and screener logic run on genuine historical statements with strict source provenance.
            </p>
          </div>

          {/* Quick modules grid */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Research Modules
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border ${item.color} dark:bg-slate-800 dark:border-slate-700`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-300" />
                    </div>
                    <h4 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Platform Status & Data Integrity Banner */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Data Pipeline &amp; Provider Independence
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Core models are provider-agnostic. Official exchange filings, Upstox adapters, and local document ingestion run through the Data Integrity Engine.
                </p>
              </div>
              <Link
                href="/data-management"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Database className="h-3.5 w-3.5" />
                <span>Manage Data</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
