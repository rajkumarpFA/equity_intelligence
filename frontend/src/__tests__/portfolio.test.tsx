import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PortfolioDashboard } from "@/components/portfolio/PortfolioDashboard";
import * as apiClient from "@/lib/api-client";
import type { Portfolio, PortfolioAnalytics } from "@/types/portfolio";

vi.mock("@/lib/api-client", () => ({
  fetchPortfolios: vi.fn(),
  createPortfolio: vi.fn(),
  deletePortfolio: vi.fn(),
  fetchPortfolioAnalytics: vi.fn(),
  fetchPortfolioTransactions: vi.fn(),
  addPortfolioTransaction: vi.fn(),
  deletePortfolioTransaction: vi.fn(),
  importPortfolioCsv: vi.fn(),
}));

const mockPortfolios: Portfolio[] = [
  {
    id: 1,
    name: "Alpha Compounders",
    description: "High ROCE leaders",
    benchmark_symbol: "^NSEI",
    cash_balance: 25000,
    currency: "INR",
    total_equity_value: 275000,
    total_invested_amount: 220000,
    total_unrealized_pnl: 30000,
    total_realized_pnl: 15000,
    portfolio_xirr: 0.185,
    holdings_count: 2,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockAnalytics: PortfolioAnalytics = {
  portfolio_id: 1,
  portfolio_name: "Alpha Compounders",
  total_net_worth: 275000,
  total_stock_value: 250000,
  invested_capital: 220000,
  unrealized_pnl: 30000,
  unrealized_pnl_pct: 13.64,
  realized_pnl: 15000,
  cash_balance: 25000,
  portfolio_xirr: 0.185,
  benchmark_symbol: "^NSEI",
  beta: 1.05,
  alpha: 0.035,
  sectors: [
    { name: "Energy", value: 150000, weight_pct: 60.0 },
    { name: "IT Services", value: 100000, weight_pct: 40.0 },
  ],
  market_caps: [
    { tier: "LARGE_CAP", value: 250000, weight_pct: 100.0 },
  ],
  holdings: [
    {
      security_id: 1,
      company_id: 1,
      symbol: "RELIANCE",
      company_name: "Reliance Industries Limited",
      sector_name: "Energy",
      market_cap_category: "LARGE_CAP",
      total_quantity: 100,
      average_buy_price: 1500,
      invested_amount: 150000,
      current_price: 1800,
      current_value: 180000,
      unrealized_pnl: 30000,
      unrealized_pnl_pct: 20.0,
      realized_pnl: 5000,
      holding_xirr: 0.22,
    },
    {
      security_id: 2,
      company_id: 2,
      symbol: "TCS",
      company_name: "Tata Consultancy Services Ltd",
      sector_name: "IT Services",
      market_cap_category: "LARGE_CAP",
      total_quantity: 20,
      average_buy_price: 3500,
      invested_amount: 70000,
      current_price: 3500,
      current_value: 70000,
      unrealized_pnl: 0,
      unrealized_pnl_pct: 0.0,
      realized_pnl: 0,
      holding_xirr: 0.12,
    },
  ],
};

describe("PortfolioDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchPortfolios).mockResolvedValue(mockPortfolios);
    vi.mocked(apiClient.fetchPortfolioAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(apiClient.fetchPortfolioTransactions).mockResolvedValue([]);
  });

  it("renders portfolio header, switcher pills, and key metrics ribbon", async () => {
    render(<PortfolioDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Portfolio Analytics & Tracking")).toBeInTheDocument();
      expect(screen.getByText(/total net worth/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Alpha Compounders")).toBeInTheDocument();
    expect(screen.getByText(/portfolio xirr/i)).toBeInTheDocument();
    expect(screen.getByText("18.5%")).toBeInTheDocument();
  });

  it("renders active holdings table with symbols and quantities", async () => {
    render(<PortfolioDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Active Holdings (2)")).toBeInTheDocument();
    });

    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
    expect(screen.getByText("TCS")).toBeInTheDocument();
    expect(screen.getByText("Tata Consultancy Services Ltd")).toBeInTheDocument();
  });

  it("opens the Log Trade modal when Log Trade button is clicked", async () => {
    render(<PortfolioDashboard />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log a new trade")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Log a new trade"));
    expect(screen.getByText("Log Portfolio Transaction")).toBeInTheDocument();
    expect(screen.getByLabelText(/Symbol \(NSE\/BSE\)/i)).toBeInTheDocument();
  });
});
