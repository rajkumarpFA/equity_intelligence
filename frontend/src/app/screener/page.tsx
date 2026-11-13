"use client";

import { Header } from "@/components/common/Header";
import { ScreenerView } from "@/components/screener/ScreenerView";

export default function ScreenerPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)]">
      <Header
        title="Stock Screener"
        subtitle="Multi-parameter equity filtering with institutional presets & AST compiler"
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Screener", href: "/screener" },
        ]}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <ScreenerView />
        </div>
      </main>
    </div>
  );
}
