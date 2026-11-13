import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyResearchHub } from "@/components/company/CompanyResearchHub";
import * as apiClient from "@/lib/api-client";
import type { CompanySearchResponse, SectorRead } from "@/types/company";

vi.mock("@/lib/api-client", () => ({
  searchCompanies: vi.fn(),
  fetchSectors: vi.fn(),
  seedBenchmarkUniverse: vi.fn(),
}));

const mockSectors: SectorRead[] = [
  { id: 1, name: "Energy", code: "ENG" },
  { id: 2, name: "Technology", code: "TECH" },
  { id: 3, name: "Financials", code: "FIN" },
];

const mockCompaniesResponse: CompanySearchResponse = {
  total: 3,
  page: 1,
  page_size: 24,
  total_pages: 1,
  items: [
    {
      id: 1,
      name: "Reliance Industries Limited",
      isin: "INE002A01018",
      cin: "L17110MH1973PLC019786",
      sector_name: "Energy",
      industry_name: "Oil & Gas Refining",
      is_financial_sector: false,
      status: "ACTIVE",
      primary_symbol: "RELIANCE",
      exchange_listings: ["NSE", "BSE"],
      current_price: 1336.3,
      price_change: 16.5,
      price_change_pct: 1.25,
      price_date: "2026-11-12",
      securities: [
        {
          id: 101,
          symbol: "RELIANCE",
          exchange_code: "NSE",
          exchange_name: "National Stock Exchange",
          series: "EQ",
          is_primary: true,
          is_active: true,
          lot_size: 1,
        },
      ],
    },
    {
      id: 2,
      name: "Tata Consultancy Services Limited",
      isin: "INE467B01029",
      cin: "L22210MH1995PLC084781",
      sector_name: "Technology",
      industry_name: "IT Services",
      is_financial_sector: false,
      status: "ACTIVE",
      primary_symbol: "TCS",
      exchange_listings: ["NSE", "BSE"],
      current_price: 4120.0,
      price_change: -25.0,
      price_change_pct: -0.6,
      price_date: "2026-11-12",
      securities: [
        {
          id: 102,
          symbol: "TCS",
          exchange_code: "NSE",
          exchange_name: "National Stock Exchange",
          series: "EQ",
          is_primary: true,
          is_active: true,
          lot_size: 1,
        },
      ],
    },
    {
      id: 3,
      name: "HDFC Bank Limited",
      isin: "INE040A01034",
      cin: "L65920MH1994PLC080618",
      sector_name: "Financials",
      industry_name: "Commercial Banking",
      is_financial_sector: true,
      status: "ACTIVE",
      primary_symbol: "HDFCBANK",
      exchange_listings: ["NSE", "BSE"],
      current_price: 1720.5,
      price_change: 18.0,
      price_change_pct: 1.05,
      price_date: "2026-11-12",
      securities: [
        {
          id: 103,
          symbol: "HDFCBANK",
          exchange_code: "NSE",
          exchange_name: "National Stock Exchange",
          series: "EQ",
          is_primary: true,
          is_active: true,
          lot_size: 1,
        },
      ],
    },
  ],
};

describe("CompanyResearchHub Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchSectors).mockResolvedValue(mockSectors);
    vi.mocked(apiClient.searchCompanies).mockResolvedValue(mockCompaniesResponse);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <CompanyResearchHub />
      </QueryClientProvider>
    );

  it("renders header, search bar, and benchmark equity pills", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fundamental Equities Dossiers")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search company by symbol/i)).toBeInTheDocument();
      expect(screen.getByText("Benchmark Equities:")).toBeInTheDocument();
    });
  });

  it("renders company dossier cards with symbol, name, ISIN, price and action links", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("RELIANCE").length).toBeGreaterThan(0);
      expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
      expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);
      expect(screen.getByText("INE002A01018")).toBeInTheDocument();
      expect(screen.getByText("Bank / NBFC")).toBeInTheDocument();
      expect(screen.getAllByText("Industrial").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Open 18-Section Dossier").length).toBe(3);
    });
  });

  it("filters by accounting sector type (Industrial vs Banks & NBFCs)", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Banks & NBFCs" })).toBeInTheDocument();
    });

    const bankBtn = screen.getByRole("button", { name: "Banks & NBFCs" });
    fireEvent.click(bankBtn);

    // Only HDFCBANK should be displayed in the cards
    await waitFor(() => {
      expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);
      expect(screen.queryByText("Reliance Industries Limited")).not.toBeInTheDocument();
      expect(screen.queryByText("Tata Consultancy Services Limited")).not.toBeInTheDocument();
    });
  });

  it("toggles between card grid view and dense table view", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTitle("Dense Matrix View")).toBeInTheDocument();
    });

    const tableViewBtn = screen.getByTitle("Dense Matrix View");
    fireEvent.click(tableViewBtn);

    await waitFor(() => {
      expect(screen.getByText("RESEARCH ACTIONS")).toBeInTheDocument();
      expect(screen.getByText("GOVERNANCE")).toBeInTheDocument();
      expect(screen.getAllByText("Dossier ›").length).toBe(3);
    });
  });

  it("handles clicking a benchmark equity pill to set search filter", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText("RELIANCE").length).toBeGreaterThan(0);
    });

    // Click TCS benchmark pill
    const tcsPills = screen.getAllByText("TCS");
    fireEvent.click(tcsPills[0]);

    await waitFor(() => {
      expect(apiClient.searchCompanies).toHaveBeenCalledWith(
        expect.objectContaining({ q: "TCS" })
      );
    });
  });
});
