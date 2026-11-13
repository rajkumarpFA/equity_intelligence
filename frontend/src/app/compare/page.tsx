"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/common/Header";
import { CompareView } from "@/components/comparison/CompareView";

function CompareContent() {
  const searchParams = useSearchParams();
  const rawIds = searchParams.get("ids") || searchParams.get("companies") || "1,2";
  const parsedIds = rawIds
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  const initialIds = parsedIds.length > 0 ? parsedIds : [1, 2];

  return <CompareView initialCompanyIds={initialIds} />;
}

export default function ComparePage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)]">
      <Header
        title="Competitor Analysis"
        subtitle="Multi-company side-by-side peer benchmarking matrix"
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Competitor Analysis", href: "/compare" },
        ]}
      />

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]" />
            }
          >
            <CompareContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
