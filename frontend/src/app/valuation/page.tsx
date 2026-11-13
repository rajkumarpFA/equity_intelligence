import React, { Suspense } from "react";
import { ValuationWorkbench } from "@/components/valuation/ValuationWorkbench";

export const metadata = {
  title: "Valuation Workbench | Equity Intelligence",
  description: "DCF scenario modeling, Reverse DCF, historical multiples bands, DDM, and Graham valuation.",
};

export default function ValuationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
          <div className="font-mono text-sm text-mute animate-pulse">
            Loading Valuation Workbench...
          </div>
        </div>
      }
    >
      <ValuationWorkbench />
    </Suspense>
  );
}
