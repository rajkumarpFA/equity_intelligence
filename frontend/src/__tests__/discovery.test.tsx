import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockDiscoveryView } from "@/components/discovery/StockDiscoveryView";
import { QueryProvider } from "@/components/common/QueryProvider";
import * as apiClient from "@/lib/api-client";

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("StockDiscoveryView", () => {
  it("renders search bar, exchange toggles, and company search results with dual listing badges", async () => {
    vi.spyOn(apiClient, "fetchSectors").mockResolvedValue([
      { id: 1, name: "Energy & Petrochemicals" },
      { id: 2, name: "Information Technology" },
    ]);

    vi.spyOn(apiClient, "searchCompanies").mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 15,
      total_pages: 1,
      items: [
        {
          id: 1,
          name: "Reliance Industries Limited",
          isin: "INE002A01018",
          cin: "L17110MH1973PLC019786",
          sector_name: "Energy & Petrochemicals",
          industry_name: "Refineries",
          is_financial_sector: false,
          status: "ACTIVE",
          primary_symbol: "RELIANCE",
          exchange_listings: ["NSE", "BSE"],
          current_price: 1339.7,
          price_change: 4.3,
          price_change_pct: 0.32,
          price_date: "2026-11-12",
          securities: [
            {
              id: 101,
              exchange_code: "NSE",
              exchange_name: "National Stock Exchange",
              symbol: "RELIANCE",
              series: "EQ",
              is_primary: true,
              is_active: true,
              lot_size: 1,
            },
            {
              id: 102,
              exchange_code: "BSE",
              exchange_name: "Bombay Stock Exchange",
              symbol: "500325",
              series: "EQ",
              is_primary: false,
              is_active: true,
              lot_size: 1,
            },
          ],
        },
      ],
    });

    render(
      <QueryProvider client={createTestClient()}>
        <StockDiscoveryView />
      </QueryProvider>
    );

    // Verify search input
    expect(
      screen.getByPlaceholderText(/Search by company name, symbol/i)
    ).toBeInTheDocument();

    // Verify company rendered
    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
      expect(screen.getByText("INE002A01018")).toBeInTheDocument();
      expect(screen.getByText("Dual Listed")).toBeInTheDocument();
      expect(screen.getByText("NSE: RELIANCE")).toBeInTheDocument();
      expect(screen.getByText("BSE: 500325")).toBeInTheDocument();
    });
  });
});
