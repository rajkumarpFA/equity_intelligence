import React, { Suspense } from "react";
import { WatchlistView } from "@/components/watchlist/WatchlistView";

export const metadata = {
  title: "Watchlists | Equity Intelligence",
  description: "Curated equity monitoring, target entry/exit pricing, and conviction tracking.",
};

export default function WatchlistsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
          <div className="font-mono text-sm text-mute animate-pulse">
            Loading Watchlists...
          </div>
        </div>
      }
    >
      <WatchlistView />
    </Suspense>
  );
}
