import React, { Suspense } from "react";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";

export const metadata = {
  title: "Portfolio Analytics | Equity Intelligence",
  description: "Track Indian equity portfolios, tax-compliant FIFO cost basis, ACT/365 XIRR, and NIFTY 50 benchmark regression.",
};

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-8">
          <div className="font-mono text-xs text-[var(--text-2)] animate-pulse">
            Loading Portfolio Analytics...
          </div>
        </div>
      }
    >
      <PortfolioDashboard />
    </Suspense>
  );
}
