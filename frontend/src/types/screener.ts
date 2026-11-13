export type FilterOperator =
  | ">"
  | ">="
  | "<"
  | "<="
  | "=="
  | "!="
  | "between"
  | "in"
  | "not_in"
  | "contains";

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: number | string | boolean | string[];
  second_value?: number | string | null;
}

export interface FilterExpression {
  conjunction: "AND" | "OR";
  conditions: FilterCondition[];
}

export interface ScreenRequest {
  filter_expression: FilterExpression;
  sort_by?: string;
  sort_direction?: "asc" | "desc";
  page?: number;
  page_size?: number;
  include_financials?: boolean;
  reporting_basis?: "CONSOLIDATED" | "STANDALONE";
}

export interface ScreenedCompanyItem {
  company_id: number;
  company_name: string;
  isin: string;
  symbol: string;
  exchange: string;
  sector_name: string;
  industry_name?: string | null;
  is_financial_sector: boolean;
  latest_fiscal_year?: number | null;

  // Valuation
  current_price?: number | null;
  price_change_pct?: number | null;
  market_cap_cr?: number | null;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  ev_ebitda?: number | null;

  // Returns & Profitability
  roe_pct?: number | null;
  roce_pct?: number | null;
  roa_pct?: number | null;
  operating_margin_pct?: number | null;
  net_profit_margin_pct?: number | null;

  // Solvency & Capital Structure
  debt_to_equity?: number | null;
  interest_coverage?: number | null;
  current_ratio?: number | null;
  quick_ratio?: number | null;

  // Efficiency
  asset_turnover?: number | null;
  cash_conversion_cycle_days?: number | null;
  working_capital_days?: number | null;

  // Growth
  revenue_cagr_3y?: number | null;
  pat_cagr_3y?: number | null;
  revenue_cagr_5y?: number | null;
  pat_cagr_5y?: number | null;
  revenue_yoy_pct?: number | null;

  // Health Scores
  altman_z_score?: number | null;
  altman_zone: "SAFE" | "GREY" | "DISTRESS" | "UNAVAILABLE" | string;
  piotroski_f_score?: number | null;
  piotroski_rating: "VERY_STRONG" | "MODERATE" | "WEAK" | "UNAVAILABLE" | string;

  // Banking Specific
  net_interest_margin_pct?: number | null;
  casa_ratio_pct?: number | null;
  gross_npa_pct?: number | null;
  capital_adequacy_ratio_pct?: number | null;
}

export interface ScreenResponse {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  applied_filter_count: number;
  reporting_basis: string;
  items: ScreenedCompanyItem[];
}

export interface SavedScreen {
  id: number;
  name: string;
  description?: string | null;
  filter_expression: FilterExpression;
  sort_by: string;
  sort_direction: "asc" | "desc";
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetricDefinition {
  field: string;
  label: string;
  category: "Valuation" | "Profitability" | "Solvency" | "Growth" | "Quality" | "Banking" | "General";
  defaultOperator: FilterOperator;
  defaultValue: number | string;
  unit: "%" | "x" | "Cr" | "INR" | "Days" | "Pts" | "";
  isBankingOnly?: boolean;
  isIndustrialOnly?: boolean;
}
