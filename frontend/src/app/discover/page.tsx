import { Header } from "@/components/common/Header";
import { StockDiscoveryView } from "@/components/discovery/StockDiscoveryView";

export default function DiscoverPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Stock Discovery"
        subtitle="Search Indian equities across canonical NSE &amp; BSE records"
      />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-6xl">
          <StockDiscoveryView />
        </div>
      </main>
    </div>
  );
}
