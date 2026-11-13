/**
 * TypeScript definitions for Phase 12: Valuation Workbench
 */

export interface DCFScenarioAssumptions {
  forecast_years: number;
  revenue_growth_rates: number[];
  operating_margins: number[];
  tax_rate: number;
  reinvestment_rates: number[];
  wacc: number;
  terminal_growth_rate: number;
  terminal_method: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  exit_multiple?: number;
}

export interface DCFProjectionItem {
  year: number;
  revenue: number;
  growth_pct: number;
  ebit: number;
  margin_pct: number;
  nopat: number;
  fcff: number;
  discount_factor: number;
  pv_fcff: number;
}

export interface DCFResult {
  model: string;
  terminal_value_method: string;
  enterprise_value: number;
  pv_explicit_fcf: number;
  terminal_value: number;
  pv_terminal_value: number;
  total_debt: number;
  cash_and_equivalents: number;
  equity_value: number;
  shares_outstanding: number;
  current_price: number;
  intrinsic_value_per_share: number;
  margin_of_safety_pct: number;
  is_undervalued: boolean;
  projections: DCFProjectionItem[];
  status: 'SUCCESS' | 'BYPASSED' | 'ERROR';
  reason?: string | null;
}

export interface SensitivityMatrixCell {
  terminal_growth_pct: number;
  value: number | null;
  diff_pct: number | null;
}

export interface SensitivityMatrixRow {
  wacc_pct: number;
  values: SensitivityMatrixCell[];
}

export interface SensitivityMatrixResponse {
  base_wacc_pct: number;
  base_terminal_growth_pct: number;
  current_price: number;
  tg_headers: number[];
  matrix: SensitivityMatrixRow[];
}

export interface ReverseDCFResponse {
  model: string;
  current_price: number;
  implied_revenue_growth_pct: number;
  historical_revenue_cagr_pct?: number | null;
  growth_gap_pct?: number | null;
  is_optimistic: boolean;
  assumptions: {
    wacc_pct: number;
    terminal_growth_pct: number;
    operating_margin_pct: number;
    projection_years: number;
    reinvestment_rate_pct: number;
  };
  status: 'SUCCESS' | 'BYPASSED' | 'ERROR';
  reason?: string | null;
}

export interface MultiplesBand {
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  count: number;
}

export interface MultiplesDetail {
  bands: MultiplesBand | null;
  latest_eps?: number | null;
  latest_bvps?: number | null;
  latest_ebitda?: number | null;
  implied_target_price: number | null;
  margin_of_safety_pct: number | null;
}

export interface HistoricalMultiplesResponse {
  model: string;
  current_price: number;
  pe: MultiplesDetail;
  pb: MultiplesDetail;
  ev_ebitda: MultiplesDetail;
  blended_target_price?: number | null;
  blended_margin_of_safety_pct?: number | null;
  status: 'SUCCESS' | 'BYPASSED' | 'ERROR';
  reason?: string | null;
}

export interface DDMResponse {
  model: string;
  is_applicable: boolean;
  bypass_reason?: string | null;
  message?: string | null;
  latest_dps?: number | null;
  cost_of_equity_pct?: number | null;
  dividend_growth_pct?: number | null;
  current_price?: number | null;
  intrinsic_value?: number | null;
  margin_of_safety_pct?: number | null;
  is_undervalued?: boolean | null;
}

export interface GrahamResponse {
  model: string;
  is_applicable: boolean;
  bypass_reason?: string | null;
  message?: string | null;
  latest_eps?: number | null;
  latest_bvps?: number | null;
  expected_growth_pct?: number | null;
  benchmark_yield_pct?: number | null;
  current_price?: number | null;
  graham_value?: number | null;
  graham_number?: number | null;
  margin_of_safety_pct?: number | null;
  is_undervalued?: boolean | null;
}

export interface ValuationSummaryResponse {
  company_id: number;
  symbol: string;
  company_name: string;
  sector_name?: string | null;
  industry_name?: string | null;
  is_financial_sector: boolean;
  current_price: number;
  dcf?: DCFResult | null;
  reverse_dcf?: ReverseDCFResponse | null;
  historical_multiples?: HistoricalMultiplesResponse | null;
  ddm?: DDMResponse | null;
  graham?: GrahamResponse | null;
  consensus_fair_value?: number | null;
  consensus_upside_pct?: number | null;
  applicable_models_count: number;
}

export interface SavedValuation {
  id: number;
  company_id: number;
  model_type: string;
  scenario_name: string;
  intrinsic_value?: number | null;
  current_price_at_run?: number | null;
  margin_of_safety_pct?: number | null;
  assumptions: Record<string, any>;
  projections: any[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
