import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompareView } from "@/components/comparison/CompareView";
import * as apiClient from "@/lib/api-client";
import type { CompanyComparisonResponse, CompanyPeersResponse } from "@/types/comparison";

vi.mock("@/lib/api-client", () => ({
  compareCompanies: vi.fn(),
  exportComparisonCsv: vi.fn(),
  fetchCompanyPeers: vi.fn(),
  searchCompanies: vi.fn(),
}));

const mockComparisonResponse: CompanyComparisonResponse = {
  reporting_basis: "CONSOLIDATED",
  companies_count: 2,
  companies: [
    {
      id: 1,
      name: "Reliance Industries Limited",
      symbol: "RELIANCE",
      exchange: "NSE",
      isin: "INE002A01018",
      sector: "Energy",
      industry: "Oil & Gas Refining",
      is_financial_sector: false,
      current_price: 1336.3,
      price_change_pct: 1.25,
      market_cap_cr: 1950000.0,
    },
    {
      id: 2,
      name: "Tata Consultancy Services Limited",
      symbol: "TCS",
      exchange: "NSE",
      isin: "INE467B01029",
      sector: "Technology",
      industry: "IT Services",
      is_financial_sector: false,
      current_price: 4120.0,
      price_change_pct: 0.85,
      market_cap_cr: 1450000.0,
    },
    {
      id: 3,
      name: "HDFC Bank Limited",
      symbol: "HDFCBANK",
      exchange: "NSE",
      isin: "INE040A01034",
      sector: "Financials",
      industry: "Commercial Banking",
      is_financial_sector: true,
      current_price: 1720.5,
      price_change_pct: 1.1,
      market_cap_cr: 1250000.0,
    },
  ],
  categories: [
    "Valuation & Market",
    "Growth Trajectory",
    "Profitability & Returns",
    "Solvency & Capital Structure",
    "Banking & Regulatory",
  ],
  metrics: [
    {
      category: "Valuation & Market",
      metric_key: "pe_ratio",
      metric_name: "Price to Earnings (P/E)",
      unit: "x",
      higher_is_better: false,
      is_industrial_only: false,
      is_banking_only: false,
      values: {
        1: { raw_value: 24.5, formatted_value: "24.50x", is_leader: false, is_laggard: false },
        2: { raw_value: 28.2, formatted_value: "28.20x", is_leader: false, is_laggard: true },
        3: { raw_value: 18.4, formatted_value: "18.40x", is_leader: true, is_laggard: false },
      },
      peer_average: 23.7,
    },
    {
      category: "Profitability & Returns",
      metric_key: "roce",
      metric_name: "Return on Capital Employed (ROCE)",
      unit: "%",
      higher_is_better: true,
      is_industrial_only: true,
      is_banking_only: false,
      values: {
        1: { raw_value: 14.8, formatted_value: "14.80%", is_leader: false, is_laggard: true },
        2: { raw_value: 48.2, formatted_value: "48.20%", is_leader: true, is_laggard: false },
        3: { raw_value: null, formatted_value: "Banking Bypass", is_leader: false, is_laggard: false, bypass_reason: "BANKING_BYPASS" },
      },
      peer_average: 31.5,
    },
    {
      category: "Solvency & Capital Structure",
      metric_key: "debt_to_equity",
      metric_name: "Debt to Equity (D/E)",
      unit: "x",
      higher_is_better: false,
      is_industrial_only: true,
      is_banking_only: false,
      values: {
        1: { raw_value: 0.38, formatted_value: "0.38x", is_leader: false, is_laggard: true },
        2: { raw_value: 0.05, formatted_value: "0.05x", is_leader: true, is_laggard: false },
        3: { raw_value: null, formatted_value: "Banking Bypass", is_leader: false, is_laggard: false, bypass_reason: "BANKING_BYPASS" },
      },
      peer_average: 0.22,
    },
    {
      category: "Banking & Regulatory",
      metric_key: "nim",
      metric_name: "Net Interest Margin (NIM)",
      unit: "%",
      higher_is_better: true,
      is_industrial_only: false,
      is_banking_only: true,
      values: {
        1: { raw_value: null, formatted_value: "N/A (Industrial)", is_leader: false, is_laggard: false, bypass_reason: "NON_FINANCIAL_BYPASS" },
        2: { raw_value: null, formatted_value: "N/A (Industrial)", is_leader: false, is_laggard: false, bypass_reason: "NON_FINANCIAL_BYPASS" },
        3: { raw_value: 3.65, formatted_value: "3.65%", is_leader: true, is_laggard: false },
      },
      peer_average: 3.65,
    },
  ],
  radar_scores: [
    {
      company_id: 1,
      symbol: "RELIANCE",
      growth: 65.0,
      profitability: 58.0,
      financial_health: 72.0,
      operating_efficiency: 60.0,
      valuation_attractiveness: 55.0,
    },
    {
      company_id: 2,
      symbol: "TCS",
      growth: 72.0,
      profitability: 92.0,
      financial_health: 95.0,
      operating_efficiency: 85.0,
      valuation_attractiveness: 48.0,
    },
    {
      company_id: 3,
      symbol: "HDFCBANK",
      growth: 68.0,
      profitability: 75.0,
      financial_health: 80.0,
      operating_efficiency: 70.0,
      valuation_attractiveness: 62.0,
    },
  ],
};

const mockPeersResponse: CompanyPeersResponse = {
  company_id: 1,
  company_name: "Reliance Industries Limited",
  symbol: "RELIANCE",
  sector: "Energy",
  peers_count: 1,
  peers: [
    {
      id: 4,
      name: "Suzlon Energy Limited",
      symbol: "SUZLON",
      exchange: "NSE",
      sector: "Energy",
      is_financial_sector: false,
      current_price: 68.4,
      market_cap_cr: 75000.0,
    },
  ],
};

describe("CompareView Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(apiClient.compareCompanies).mockResolvedValue(mockComparisonResponse);
    vi.mocked(apiClient.fetchCompanyPeers).mockResolvedValue(mockPeersResponse);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <CompareView initialCompanyIds={[1, 2, 3]} />
      </QueryClientProvider>
    );

  it("renders side-by-side headers with company symbols and live prices", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("RELIANCE").length).toBeGreaterThan(0);
      expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
      expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);
      expect(screen.getByText("Side-by-Side Competitor Benchmarking")).toBeInTheDocument();
    });
  });

  it("renders metric rows, peer averages, and leader tags", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Price to Earnings (P/E)")).toBeInTheDocument();
      expect(screen.getByText("Return on Capital Employed (ROCE)")).toBeInTheDocument();
      expect(screen.getByText("Debt to Equity (D/E)")).toBeInTheDocument();
      expect(screen.getByText("23.70x")).toBeInTheDocument(); // Peer average (toFixed(2))
      expect(screen.getAllByText(/Best/i).length).toBeGreaterThan(0);
    });
  });

  it("correctly displays Banking Bypass for banks on industrial solvency rows", async () => {
    renderComponent();

    await waitFor(() => {
      const bypassBadges = screen.getAllByText("Banking Bypass");
      expect(bypassBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders 5-pillar relative scorecards", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/5-Pillar Relative Scorecard/i)).toBeInTheDocument();
      expect(screen.getAllByText("Growth Trajectory").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Profitability & Returns").length).toBeGreaterThan(0);
    });
  });

  it("handles category tab switching", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Valuation & Market" })).toBeInTheDocument();
    });

    const valTab = screen.getByRole("button", { name: "Valuation & Market" });
    fireEvent.click(valTab);

    // Only valuation metrics should be displayed
    await waitFor(() => {
      expect(screen.getByText("Price to Earnings (P/E)")).toBeInTheDocument();
      expect(screen.queryByText("Return on Capital Employed (ROCE)")).not.toBeInTheDocument();
    });
  });

  it("exports comparison CSV when Export CSV is clicked", async () => {
    const mockBlob = new Blob(["mock,csv"], { type: "text/csv" });
    vi.mocked(apiClient.exportComparisonCsv).mockResolvedValue(mockBlob);

    // Mock URL.createObjectURL and revokeObjectURL
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock");
    window.URL.revokeObjectURL = vi.fn();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });

    const exportBtn = screen.getByText("Export CSV");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(apiClient.exportComparisonCsv).toHaveBeenCalledWith({
        company_ids: [1, 2, 3],
        reporting_basis: "CONSOLIDATED",
      });
    });
  });
});
