export interface GrowthRatios {
  revenue_cagr_3y?: number | null;
  revenue_cagr_5y?: number | null;
  ebitda_cagr_3y?: number | null;
  ebitda_cagr_5y?: number | null;
  pat_cagr_3y?: number | null;
  pat_cagr_5y?: number | null;
  eps_cagr_3y?: number | null;
  eps_cagr_5y?: number | null;
  revenue_yoy_pct?: number | null;
  pat_yoy_pct?: number | null;
}

export interface DuPontDecomposition {
  net_profit_margin_pct?: number | null;
  asset_turnover?: number | null;
  financial_leverage?: number | null;
  calculated_roe_pct?: number | null;
}

export interface ProfitabilityRatios {
  operating_margin_pct?: number | null;
  ebitda_margin_pct?: number | null;
  net_profit_margin_pct?: number | null;
  return_on_equity_pct?: number | null;
  return_on_capital_employed_pct?: number | null;
  return_on_assets_pct?: number | null;
  dupont: DuPontDecomposition;
}

export interface SolvencyRatios {
  debt_to_equity?: number | null;
  interest_coverage_ratio?: number | null;
  current_ratio?: number | null;
  quick_ratio?: number | null;
  debt_to_assets?: number | null;
  is_applicable: boolean;
  bypass_reason?: string | null;
}

export interface OperatingEfficiencyRatios {
  asset_turnover?: number | null;
  inventory_days?: number | null;
  debtor_days?: number | null;
  creditor_days?: number | null;
  cash_conversion_cycle_days?: number | null;
  working_capital_days?: number | null;
  is_applicable: boolean;
  bypass_reason?: string | null;
}

export interface BankingRatios {
  net_interest_margin_pct?: number | null;
  casa_ratio_pct?: number | null;
  cost_to_income_pct?: number | null;
  gross_npa_pct?: number | null;
  net_npa_pct?: number | null;
  capital_adequacy_ratio_pct?: number | null;
  is_applicable: boolean;
}

export interface HistoricalRatioPeriod {
  period_label: string;
  fiscal_year?: number | null;
  period_end: string;
  operating_margin_pct?: number | null;
  net_profit_margin_pct?: number | null;
  roe_pct?: number | null;
  roce_pct?: number | null;
  debt_to_equity?: number | null;
  current_ratio?: number | null;
  interest_coverage?: number | null;
  cash_conversion_cycle_days?: number | null;
}

export interface CompanyRatiosResponse {
  company_id: number;
  company_name: string;
  symbol: string;
  is_financial_sector: boolean;
  reporting_basis: string;
  latest_period_label: string;
  growth: GrowthRatios;
  profitability: ProfitabilityRatios;
  solvency: SolvencyRatios;
  efficiency: OperatingEfficiencyRatios;
  banking: BankingRatios;
  historical_trend: HistoricalRatioPeriod[];
}

export interface AltmanZScoreDetail {
  score?: number | null;
  zone: "SAFE" | "GREY" | "DISTRESS" | "UNAVAILABLE" | string;
  model: string;
  interpretation: string;
  components?: Record<string, number>;
  is_applicable: boolean;
  bypass_reason?: string | null;
}

export interface PiotroskiFactorItem {
  score: number;
  description: string;
  details?: Record<string, unknown>;
}

export interface PiotroskiFScoreDetail {
  score?: number | null;
  max_score: number;
  rating: "VERY_STRONG" | "MODERATE" | "WEAK" | "UNAVAILABLE" | string;
  summary: string;
  profitability_score: number;
  leverage_score: number;
  efficiency_score: number;
  factors?: Record<string, PiotroskiFactorItem>;
  is_applicable: boolean;
  bypass_reason?: string | null;
}

export interface QualityScoresResponse {
  company_id: number;
  company_name: string;
  symbol: string;
  is_financial_sector: boolean;
  period_label: string;
  altman_z: AltmanZScoreDetail;
  piotroski_f: PiotroskiFScoreDetail;
}
