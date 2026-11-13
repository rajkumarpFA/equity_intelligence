import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ScreenerView } from "@/components/screener/ScreenerView";
import type { SavedScreen, ScreenResponse } from "@/types/screener";

const mockPresets: SavedScreen[] = [
  {
    id: 1001,
    name: "Buffett Moats",
    description: "High return on capital and low leverage",
    filter_expression: {
      conjunction: "AND",
      conditions: [
        { field: "roce", operator: ">=", value: 18.0 },
        { field: "debt_to_equity", operator: "<=", value: 0.5 },
      ],
    },
    sort_by: "roce",
    sort_direction: "desc",
    is_preset: true,
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  },
  {
    id: 1002,
    name: "High Growth Compounders",
    description: "High growth and returns",
    filter_expression: {
      conjunction: "AND",
      conditions: [
        { field: "revenue_cagr_3y", operator: ">=", value: 15.0 },
      ],
    },
    sort_by: "revenue_cagr_3y",
    sort_direction: "desc",
    is_preset: true,
    created_at: "2026-11-13T10:00:00Z",
    updated_at: "2026-11-13T10:00:00Z",
  },
];

const mockScreenResponse: ScreenResponse = {
  total_count: 2,
  page: 1,
  page_size: 25,
  total_pages: 1,
  applied_filter_count: 2,
  reporting_basis: "CONSOLIDATED",
  items: [
    {
      company_id: 1,
      company_name: "Titan Company Limited",
      isin: "INE280A01028",
      symbol: "TITAN",
      exchange: "NSE",
      sector_name: "Consumer Discretionary",
      is_financial_sector: false,
      current_price: 3250.0,
      market_cap_cr: 288000.0,
      pe_ratio: 38.5,
      pb_ratio: 11.2,
      roce_pct: 24.5,
      roe_pct: 28.2,
      debt_to_equity: 0.28,
      revenue_cagr_3y: 22.5,
      altman_z_score: 5.12,
      altman_zone: "SAFE",
      piotroski_f_score: 8,
      piotroski_rating: "VERY_STRONG",
    },
    {
      company_id: 2,
      company_name: "HDFC Bank Limited",
      isin: "INE040A01034",
      symbol: "HDFCBANK",
      exchange: "NSE",
      sector_name: "Financial Services",
      is_financial_sector: true,
      current_price: 1680.0,
      market_cap_cr: 1250000.0,
      pe_ratio: 18.5,
      pb_ratio: 2.6,
      roce_pct: null, // Bypassed
      roe_pct: 16.8,
      debt_to_equity: null, // Bypassed
      revenue_cagr_3y: 14.2,
      altman_z_score: null, // Bypassed
      altman_zone: "UNAVAILABLE",
      piotroski_f_score: 7,
      piotroski_rating: "MODERATE",
    },
  ],
};

vi.mock("@/lib/api-client", () => ({
  fetchPresetScreens: vi.fn(),
  fetchSavedScreens: vi.fn(),
  runScreen: vi.fn(),
  exportScreenCsv: vi.fn(),
  createSavedScreen: vi.fn(),
  deleteSavedScreen: vi.fn(),
}));

import {
  fetchPresetScreens,
  fetchSavedScreens,
  runScreen,
  exportScreenCsv,
} from "@/lib/api-client";

describe("ScreenerView Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ScreenerView />
      </QueryClientProvider>
    );
  };

  it("renders preset buttons and allows adding new conditions", async () => {
    vi.mocked(fetchPresetScreens).mockResolvedValue(mockPresets);
    vi.mocked(fetchSavedScreens).mockResolvedValue([]);
    vi.mocked(runScreen).mockResolvedValue(mockScreenResponse);

    renderComponent();

    // Verify presets
    expect(await screen.findByText("Buffett Moats")).toBeInTheDocument();
    expect(screen.getByText("High Growth Compounders")).toBeInTheDocument();

    // Verify filter builder
    expect(screen.getByText("Multi-Parameter Query Builder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Condition/i })).toBeInTheDocument();

    // Add condition
    const addBtn = screen.getByRole("button", { name: /Add Condition/i });
    fireEvent.click(addBtn);

    // Verify condition added (#3)
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders screened companies with metrics and sector bypass rules", async () => {
    vi.mocked(fetchPresetScreens).mockResolvedValue(mockPresets);
    vi.mocked(fetchSavedScreens).mockResolvedValue([]);
    vi.mocked(runScreen).mockResolvedValue(mockScreenResponse);

    renderComponent();

    // Wait for table to load
    expect(await screen.findByText("Titan Company Limited")).toBeInTheDocument();
    expect(screen.getByText("HDFC Bank Limited")).toBeInTheDocument();

    // Verify industrial company metrics
    expect(screen.getByText("₹3,250.00")).toBeInTheDocument();
    expect(screen.getByText("+24.50%")).toBeInTheDocument(); // ROCE
    expect(screen.getByText("+28.20%")).toBeInTheDocument(); // ROE
    expect(screen.getByText("0.28x")).toBeInTheDocument(); // D/E
    expect(screen.getByText("5.1")).toBeInTheDocument(); // Altman Z
    expect(screen.getByText("8 / 9")).toBeInTheDocument(); // Piotroski

    // Verify banking company bypasses
    expect(screen.getByText("N/A (Bank)")).toBeInTheDocument();
    expect(screen.getAllByText("BYPASS").length).toBeGreaterThan(0);
  });

  it("loads a preset and updates conditions", async () => {
    vi.mocked(fetchPresetScreens).mockResolvedValue(mockPresets);
    vi.mocked(fetchSavedScreens).mockResolvedValue([]);
    vi.mocked(runScreen).mockResolvedValue(mockScreenResponse);

    renderComponent();

    const presetBtn = await screen.findByText("High Growth Compounders");
    fireEvent.click(presetBtn);

    // Condition row should contain 3Y Revenue CAGR %
    expect(await screen.findByDisplayValue("15")).toBeInTheDocument();
  });

  it("renders export CSV button", async () => {
    vi.mocked(fetchPresetScreens).mockResolvedValue(mockPresets);
    vi.mocked(fetchSavedScreens).mockResolvedValue([]);
    vi.mocked(runScreen).mockResolvedValue(mockScreenResponse);

    renderComponent();

    expect(await screen.findByRole("button", { name: /Export CSV/i })).toBeInTheDocument();
  });
});
