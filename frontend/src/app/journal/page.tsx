import React, { Suspense } from "react";
import { JournalView } from "@/components/journal/JournalView";

export const metadata = {
  title: "Investment Journal | Equity Intelligence",
  description: "Document investment rationale, thesis milestones, catalysts, and review notes.",
};

export default function JournalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
          <div className="font-mono text-sm text-mute animate-pulse">
            Loading Investment Journal...
          </div>
        </div>
      }
    >
      <JournalView />
    </Suspense>
  );
}
