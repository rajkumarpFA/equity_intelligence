import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ValuationWorkbench } from "@/components/valuation/ValuationWorkbench";
import * as apiClient from "@/lib/api-client";
import type {
  ValuationSummaryResponse,
  SensitivityMatrixResponse,
} from "@/types/valuation";

vi.mock("@/lib/api-client", () => ({
  fetchValuationSummary: vi.fn(),
  fetchCompanySearch: vi.fn(),
  runDCFValuation: vi.fn(),
  runReverseDCFValuation: vi.fn(),
  runSensitivityMatrix: vi.fn(),
  runDDMValuation: vi.fn(),
  runGrahamValuation: vi.fn(),
  saveValuationScenario: vi.fn(),
  fetchSavedValuations: vi.fn(),
  deleteSavedValuation: vi.fn(),
}));

const mockSummary: ValuationSummaryResponse = {
  company_id: 1,
  symbol: "RELIANCE",
  company_name: "Reliance Industries Limited",
  sector_name: "Energy",
  industry_name: "Oil & Gas Refining",
  is_financial_sector: false,
  current_price: 1336.3,
  consensus_fair_value: 1540.0,
  consensus_upside_pct: 15.24,
  applicable_models_count: 3,
  dcf: {
    model: "DCF",
    terminal_value_method: "GORDON_GROWTH",
    enterprise_value: 950000.0,
    pv_explicit_fcf: 350000.0,
    terminal_value: 1200000.0,
    pv_terminal_value: 600000.0,
    total_debt: 200000.0,
    cash_and_equivalents: 50000.0,
    equity_value: 800000.0,
    shares_outstanding: 500.0,
    current_price: 1336.3,
    intrinsic_value_per_share: 1600.0,
    margin_of_safety_pct: 16.48,
    is_undervalued: true,
    status: "SUCCESS",
    projections: [
      {
        year: 1,
        revenue: 900000.0,
        growth_pct: 15.0,
        ebit: 120000.0,
        margin_pct: 13.3,
        nopat: 90000.0,
        fcff: 63000.0,
        discount_factor: 0.8929,
        pv_fcff: 56252.7,
      },
      {
        year: 2,
        revenue: 1026000.0,
        growth_pct: 14.0,
        ebit: 136458.0,
        margin_pct: 13.3,
        nopat: 102343.5,
        fcff: 71640.4,
        discount_factor: 0.7972,
        pv_fcff: 57111.7,
      },
    ],
  },
  reverse_dcf: {
    model: "REVERSE_DCF",
    current_price: 1336.3,
    implied_revenue_growth_pct: 11.8,
    historical_revenue_cagr_pct: 14.5,
    growth_gap_pct: -2.7,
    is_optimistic: false,
    assumptions: {
      wacc_pct: 12.0,
      terminal_growth_pct: 5.0,
      operating_margin_pct: 13.3,
      projection_years: 5,
      reinvestment_rate_pct: 30.0,
    },
    status: "SUCCESS",
  },
  historical_multiples: {
    model: "HISTORICAL_MULTIPLES",
    current_price: 1336.3,
    pe: {
      bands: { min: 18.2, p25: 22.0, median: 26.5, p75: 31.0, max: 38.5, count: 5 },
      latest_eps: 55.2,
      implied_target_price: 1462.8,
      margin_of_safety_pct: 8.65,
    },
    pb: {
      bands: { min: 1.8, p25: 2.1, median: 2.5, p75: 2.9, max: 3.4, count: 5 },
      latest_bvps: 610.0,
      implied_target_price: 1525.0,
      margin_of_safety_pct: 12.37,
    },
    ev_ebitda: {
      bands: { min: 8.5, p25: 10.0, median: 11.8, p75: 13.5, max: 16.0, count: 5 },
      latest_ebitda: 145000.0,
      implied_target_price: 1580.0,
      margin_of_safety_pct: 15.42,
    },
    blended_target_price: 1522.6,
    blended_margin_of_safety_pct: 12.24,
    status: "SUCCESS",
  },
  ddm: {
    model: "DDM",
    is_applicable: true,
    latest_dps: 10.0,
    cost_of_equity_pct: 13.0,
    dividend_growth_pct: 6.0,
    current_price: 1336.3,
    intrinsic_value: 151.43,
    margin_of_safety_pct: -782.45,
    is_undervalued: false,
  },
  graham: {
    model: "GRAHAM",
    is_applicable: true,
    latest_eps: 55.2,
    latest_bvps: 610.0,
    expected_growth_pct: 10.0,
    benchmark_yield_pct: 7.1,
    current_price: 1336.3,
    graham_value: 974.1,
    graham_number: 870.5,
    margin_of_safety_pct: -37.18,
    is_undervalued: false,
  },
};

const mockSensitivity: SensitivityMatrixResponse = {
  base_wacc_pct: 12.0,
  base_terminal_growth_pct: 5.0,
  current_price: 1336.3,
  tg_headers: [4.0, 4.5, 5.0, 5.5, 6.0],
  matrix: [
    {
      wacc_pct: 10.0,
      values: [
        { terminal_growth_pct: 4.0, value: 1720.0, diff_pct: 28.7 },
        { terminal_growth_pct: 4.5, value: 1840.0, diff_pct: 37.7 },
        { terminal_growth_pct: 5.0, value: 1980.0, diff_pct: 48.2 },
        { terminal_growth_pct: 5.5, value: 2150.0, diff_pct: 60.9 },
        { terminal_growth_pct: 6.0, value: 2360.0, diff_pct: 76.6 },
      ],
    },
  ],
};

describe("ValuationWorkbench Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchValuationSummary).mockResolvedValue(mockSummary);
    vi.mocked(apiClient.runSensitivityMatrix).mockResolvedValue(mockSensitivity);
    vi.mocked(apiClient.fetchSavedValuations).mockResolvedValue([]);
  });

  it("renders header and benchmark pills", async () => {
    render(<ValuationWorkbench />);

    expect(screen.getByText(/PHASE 12 • QUANTITATIVE VALUATION WORKBENCH/i)).toBeInTheDocument();
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("HDFCBANK")).toBeInTheDocument();
    expect(screen.getByText("TCS")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
    });
  });

  it("displays company summary and consensus intrinsic value", async () => {
    render(<ValuationWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
      expect(screen.getAllByText("₹1336.30")[0]).toBeInTheDocument();
      expect(screen.getAllByText("₹1540.00")[0]).toBeInTheDocument();
      expect(screen.getByText(/\+15.2% Margin of Safety/i)).toBeInTheDocument();
    });
  });

  it("switches to DCF tab and displays projection table", async () => {
    render(<ValuationWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
    });

    const dcfTab = screen.getByText("DCF & Scenarios");
    fireEvent.click(dcfTab);

    expect(screen.getByText("WACC DISCOUNT RATE")).toBeInTheDocument();
    expect(screen.getByText("TERMINAL VALUE METHOD")).toBeInTheDocument();
    expect(screen.getByText("Explicit 5-Year Free Cash Flow Projections (₹ Crores)")).toBeInTheDocument();
    expect(screen.getByText("₹1600.00")).toBeInTheDocument();
  });

  it("switches to Reverse DCF tab and shows implied revenue growth", async () => {
    render(<ValuationWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
    });

    const revTab = screen.getByText("Reverse DCF & Sensitivity");
    fireEvent.click(revTab);

    expect(screen.getByText("11.8% / yr")).toBeInTheDocument();
    expect(screen.getByText("IMPLIED 5Y REVENUE GROWTH")).toBeInTheDocument();
    expect(screen.getByText(/5×5 Sensitivity Matrix/i)).toBeInTheDocument();
  });

  it("switches to Historical Multiples tab and shows PE and PB bands", async () => {
    render(<ValuationWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Reliance Industries Limited")).toBeInTheDocument();
    });

    const multTab = screen.getByText("Historical Multiples");
    fireEvent.click(multTab);

    expect(screen.getByText("PRICE-TO-EARNINGS (P/E)")).toBeInTheDocument();
    expect(screen.getByText("PRICE-TO-BOOK (P/B)")).toBeInTheDocument();
    expect(screen.getByText("26.5x")).toBeInTheDocument();
    expect(screen.getByText("₹1462.80")).toBeInTheDocument();
  });
});
