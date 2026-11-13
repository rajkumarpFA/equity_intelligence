import React, { Suspense } from "react";
import { Header } from "@/components/common/Header";
import { CompanyResearchHub } from "@/components/company/CompanyResearchHub";

export default function CompaniesPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-1)]">
      <Header
        title="Company Research"
        subtitle="18-section fundamental research & audit provenance across Indian equities"
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Company Research" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
                <span className="text-xs font-mono text-[var(--text-3)] animate-pulse">
                  Loading company research hub...
                </span>
              </div>
            }
          >
            <CompanyResearchHub />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
