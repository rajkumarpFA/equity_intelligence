import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatchlistView } from "@/components/watchlist/WatchlistView";
import * as apiClient from "@/lib/api-client";
import type { Watchlist } from "@/types/workflow";

vi.mock("@/lib/api-client", () => ({
  fetchWatchlists: vi.fn(),
  createWatchlist: vi.fn(),
  deleteWatchlist: vi.fn(),
  addWatchlistItem: vi.fn(),
  updateWatchlistItem: vi.fn(),
  removeWatchlistItem: vi.fn(),
  fetchCompanySearch: vi.fn(),
}));

const mockWatchlists: Watchlist[] = [
  {
    id: 1,
    name: "High Conviction Growth",
    description: "Core compounders with >20% ROCE",
    color: "#00d992",
    items_count: 2,
    created_at: "2026-11-12T10:00:00Z",
    updated_at: "2026-11-12T10:00:00Z",
    items: [
      {
        id: 101,
        watchlist_id: 1,
        company_id: 1,
        symbol: "RELIANCE",
        company_name: "Reliance Industries Limited",
        sector_name: "Energy",
        is_financial_sector: false,
        current_price: 1336.3,
        price_change_pct: 1.25,
        target_entry_price: 1300.0,
        target_exit_price: 1750.0,
        distance_to_entry_pct: 2.79,
        conviction: 5,
        thesis_summary: "Dominant conglomerate with energy transition tailwinds",
        notes: "Accumulate on dips below ₹1300",
        added_at: "2026-11-12T10:00:00Z",
      },
      {
        id: 102,
        watchlist_id: 1,
        company_id: 3,
        symbol: "HDFCBANK",
        company_name: "HDFC Bank Limited",
        sector_name: "Financials",
        is_financial_sector: true,
        current_price: 1520.0,
        price_change_pct: -0.45,
        target_entry_price: 1550.0,
        target_exit_price: 2100.0,
        distance_to_entry_pct: -1.94, // In Buy Zone!
        conviction: 4,
        thesis_summary: "Merger synergies and loan book normalization",
        notes: "Currently below entry trigger",
        added_at: "2026-11-12T10:00:00Z",
      },
    ],
  },
];

describe("WatchlistView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchWatchlists).mockResolvedValue(mockWatchlists);
  });

  it("renders watchlist title and lists active items", async () => {
    render(<WatchlistView />);

    expect(screen.getByText(/PHASE 13 • PORTFOLIO WORKFLOWS/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("High Conviction Growth")[0]).toBeInTheDocument();
      expect(screen.getByText("RELIANCE")).toBeInTheDocument();
      expect(screen.getByText("HDFCBANK")).toBeInTheDocument();
      expect(screen.getByText("BANK")).toBeInTheDocument();
    });
  });

  it("highlights stock in buy zone with green badge", async () => {
    render(<WatchlistView />);

    await waitFor(() => {
      expect(screen.getByText(/🎯 IN BUY ZONE \(-1.9%\)/i)).toBeInTheDocument();
    });
  });

  it("filters items to buy zone only when toggle clicked", async () => {
    render(<WatchlistView />);

    await waitFor(() => {
      expect(screen.getByText("RELIANCE")).toBeInTheDocument();
      expect(screen.getByText("HDFCBANK")).toBeInTheDocument();
    });

    const buyZoneCheckbox = screen.getByLabelText(/In Buy Zone Only/i);
    fireEvent.click(buyZoneCheckbox);

    // HDFCBANK is in buy zone, RELIANCE is not
    expect(screen.getByText("HDFCBANK")).toBeInTheDocument();
    expect(screen.queryByText("RELIANCE")).not.toBeInTheDocument();
  });
});
