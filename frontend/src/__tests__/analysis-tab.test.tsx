import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FinancialAnalysisTab } from "@/components/company/FinancialAnalysisTab";
import type { CompanyRatiosResponse, QualityScoresResponse } from "@/types/analysis";

const mockRatiosIndustrial: CompanyRatiosResponse = {
  company_id: 1,
  company_name: "Titan Company Limited",
  symbol: "TITAN",
  is_financial_sector: false,
  reporting_basis: "CONSOLIDATED",
  latest_period_label: "FY2024",
  growth: {
    revenue_cagr_3y: 28.5,
    revenue_cagr_5y: 21.2,
    ebitda_cagr_3y: 24.1,
    ebitda_cagr_5y: 19.8,
    pat_cagr_3y: 22.4,
    pat_cagr_5y: 18.1,
    eps_cagr_3y: 22.4,
    eps_cagr_5y: 18.1,
    revenue_yoy_pct: 22.9,
    pat_yoy_pct: 12.5,
  },
  profitability: {
    operating_margin_pct: 11.2,
    ebitda_margin_pct: 12.8,
    net_profit_margin_pct: 7.2,
    return_on_equity_pct: 32.4,
    return_on_capital_employed_pct: 29.8,
    return_on_assets_pct: 14.1,
    dupont: {
      net_profit_margin_pct: 7.2,
      asset_turnover: 1.95,
      financial_leverage: 2.31,
      calculated_roe_pct: 32.4,
    },
  },
  solvency: {
    debt_to_equity: 0.28,
    interest_coverage_ratio: 9.85,
    current_ratio: 1.82,
    quick_ratio: 0.65,
    debt_to_assets: 0.12,
    is_applicable: true,
  },
  efficiency: {
    asset_turnover: 1.95,
    inventory_days: 145,
    debtor_days: 12,
    creditor_days: 35,
    cash_conversion_cycle_days: 122,
    working_capital_days: 85,
    is_applicable: true,
  },
  banking: {
    is_applicable: false,
  },
  historical_trend: [
    {
      period_label: "FY2023",
      period_end: "2023-03-31",
      operating_margin_pct: 10.9,
      net_profit_margin_pct: 7.0,
      roe_pct: 30.8,
      roce_pct: 28.2,
      debt_to_equity: 0.32,
      interest_coverage: 10.1,
      cash_conversion_cycle_days: 118,
    },
    {
      period_label: "FY2024",
      period_end: "2024-03-31",
      operating_margin_pct: 11.2,
      net_profit_margin_pct: 7.2,
      roe_pct: 32.4,
      roce_pct: 29.8,
      debt_to_equity: 0.28,
      interest_coverage: 9.85,
      cash_conversion_cycle_days: 122,
    },
  ],
};

const mockScoresIndustrial: QualityScoresResponse = {
  company_id: 1,
  company_name: "Titan Company Limited",
  symbol: "TITAN",
  is_financial_sector: false,
  period_label: "FY2024",
  altman_z: {
    score: 5.42,
    zone: "SAFE",
    model: "NON_MANUFACTURING_4_FACTOR",
    interpretation: "Safe Zone: Strong balance sheet liquidity with low insolvency probability.",
    components: {
      working_capital_to_assets: 0.45,
      retained_earnings_to_assets: 0.52,
      ebit_to_assets: 0.22,
      equity_to_liabilities: 1.75,
    },
    is_applicable: true,
  },
  piotroski_f: {
    score: 8,
    max_score: 9,
    rating: "VERY_STRONG",
    summary: "Very Strong fundamental performance across 8 of 9 parameters.",
    profitability_score: 4,
    leverage_score: 2,
    efficiency_score: 2,
    factors: {
      positive_roa: { score: 1, description: "Positive Return on Assets (ROA > 0)" },
      positive_cfo: { score: 1, description: "Positive Operating Cash Flow (CFO > 0)" },
      roa_growth: { score: 1, description: "ROA improved year-over-year" },
      accrual_quality: { score: 1, description: "CFO exceeds Net Income (high earnings quality)" },
      debt_reduction: { score: 1, description: "Long-term debt-to-assets ratio decreased or flat" },
      current_ratio_growth: { score: 1, description: "Current ratio improved year-over-year" },
      no_dilution: { score: 0, description: "No new equity shares issued (dilution detected)" },
      margin_growth: { score: 1, description: "Gross margin improved year-over-year" },
      asset_turnover_growth: { score: 1, description: "Asset turnover improved year-over-year" },
    },
    is_applicable: true,
  },
};

vi.mock("@/lib/api-client", () => ({
  fetchCompanyRatios: vi.fn(),
  fetchCompanyQualityScores: vi.fn(),
}));

import { fetchCompanyRatios, fetchCompanyQualityScores } from "@/lib/api-client";

describe("FinancialAnalysisTab Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (isFinancial = false) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <FinancialAnalysisTab
          companyId={1}
          companyName="Titan Company Limited"
          isFinancialSector={isFinancial}
        />
      </QueryClientProvider>
    );
  };

  it("renders DuPont ROE decomposition pipeline correctly", async () => {
    vi.mocked(fetchCompanyRatios).mockResolvedValue(mockRatiosIndustrial);
    vi.mocked(fetchCompanyQualityScores).mockResolvedValue(mockScoresIndustrial);

    renderComponent(false);

    expect(await screen.findByText(/3-Stage DuPont ROE Decomposition/i)).toBeInTheDocument();
    expect(screen.getByText(/1. Net Profit Margin/i)).toBeInTheDocument();
    expect(screen.getAllByText("+7.20%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.95x").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2.31x").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+32.40%").length).toBeGreaterThan(0);
  });

  it("renders Altman Z-Score and SAFE zone badge", async () => {
    vi.mocked(fetchCompanyRatios).mockResolvedValue(mockRatiosIndustrial);
    vi.mocked(fetchCompanyQualityScores).mockResolvedValue(mockScoresIndustrial);

    renderComponent(false);

    expect(await screen.findByText(/Altman Z-Score \(Bankruptcy Health\)/i)).toBeInTheDocument();
    expect(screen.getByText("5.42")).toBeInTheDocument();
    expect(screen.getAllByText(/SAFE ZONE/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Safe Zone: Strong balance sheet liquidity/i)).toBeInTheDocument();
  });

  it("renders Piotroski 9-factor F-Score and toggles breakdown checklist", async () => {
    vi.mocked(fetchCompanyRatios).mockResolvedValue(mockRatiosIndustrial);
    vi.mocked(fetchCompanyQualityScores).mockResolvedValue(mockScoresIndustrial);

    renderComponent(false);

    expect(await screen.findByText(/Piotroski 9-Factor F-Score/i)).toBeInTheDocument();
    expect(screen.getByText("8 / 9")).toBeInTheDocument();
    expect(screen.getByText("VERY STRONG")).toBeInTheDocument();

    // Toggle factor checklist
    const toggleBtn = screen.getByRole("button", { name: /View 9-Factor Audit Breakdown/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Positive Return on Assets (ROA > 0)")).toBeInTheDocument();
    expect(screen.getByText("No new equity shares issued (dilution detected)")).toBeInTheDocument();
  });

  it("renders multi-year CAGR table with data integrity", async () => {
    vi.mocked(fetchCompanyRatios).mockResolvedValue(mockRatiosIndustrial);
    vi.mocked(fetchCompanyQualityScores).mockResolvedValue(mockScoresIndustrial);

    renderComponent(false);

    expect(await screen.findByText(/Compounded Growth \(CAGR\)/i)).toBeInTheDocument();
    expect(screen.getByText("+28.50%")).toBeInTheDocument(); // 3Y Rev CAGR
    expect(screen.getByText("+21.20%")).toBeInTheDocument(); // 5Y Rev CAGR
    expect(screen.getByText("+22.90%")).toBeInTheDocument(); // YoY Rev
  });

  it("enforces Banking Sector Governance isolation when isFinancialSector is true", async () => {
    const mockBankingRatios = {
      ...mockRatiosIndustrial,
      is_financial_sector: true,
      solvency: { is_applicable: false, bypass_reason: "Bypassed for banks" },
      efficiency: { is_applicable: false, bypass_reason: "Bypassed for banks" },
      banking: {
        is_applicable: true,
        net_interest_margin_pct: 4.15,
        casa_ratio_pct: 44.2,
        gross_npa_pct: 1.25,
        net_npa_pct: 0.35,
        cost_to_income_pct: 42.0,
        capital_adequacy_ratio_pct: 19.5,
      },
    };

    const mockBankingScores = {
      ...mockScoresIndustrial,
      is_financial_sector: true,
      altman_z: {
        is_applicable: false,
        zone: "UNAVAILABLE",
        model: "BANKING_BYPASS",
        interpretation: "Altman Z-Score is not applicable to banks or financial institutions.",
        bypass_reason: "Model calibrated for non-financial corporations only.",
      },
    };

    vi.mocked(fetchCompanyRatios).mockResolvedValue(mockBankingRatios);
    vi.mocked(fetchCompanyQualityScores).mockResolvedValue(mockBankingScores);

    renderComponent(true);

    expect(await screen.findByText(/Banking & NBFC Operating Metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/Financial Sector Governance Rule/i)).toBeInTheDocument();
    expect(screen.getByText("+4.15%")).toBeInTheDocument(); // NIM
    expect(screen.getByText("+44.20%")).toBeInTheDocument(); // CASA
    expect(screen.getByText("+1.25%")).toBeInTheDocument(); // GNPA
    expect(screen.getByText("+19.50%")).toBeInTheDocument(); // CAR
    expect(screen.getByText("BYPASS")).toBeInTheDocument(); // Altman Z bypass badge
  });
});
