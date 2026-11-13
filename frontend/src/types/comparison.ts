export interface PeerSummaryItem {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  sector: string;
  industry?: string | null;
  is_financial_sector: boolean;
  current_price?: number | null;
  price_change_pct?: number | null;
  market_cap_cr?: number | null;
  pe_ratio?: number | null;
  roce_pct?: number | null;
}

export interface CompanyPeersResponse {
  company_id: number;
  company_name: string;
  symbol: string;
  sector: string;
  industry?: string | null;
  peers_count: number;
  peers: PeerSummaryItem[];
}

export interface ComparisonCompanyHeader {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  isin: string;
  sector: string;
  industry?: string | null;
  is_financial_sector: boolean;
  current_price?: number | null;
  price_change_pct?: number | null;
  market_cap_cr?: number | null;
}

export interface ComparisonMetricValue {
  raw_value?: number | null;
  formatted_value: string;
  is_leader: boolean;
  is_laggard: boolean;
  bypass_reason?: string | null;
}

export interface ComparisonMetricRow {
  category: string;
  metric_key: string;
  metric_name: string;
  unit: string;
  higher_is_better: boolean;
  is_industrial_only: boolean;
  is_banking_only: boolean;
  values: Record<number, ComparisonMetricValue>;
  peer_average?: number | null;
}

export interface RadarDimensionScore {
  company_id: number;
  symbol: string;
  growth: number;
  profitability: number;
  financial_health: number;
  operating_efficiency: number;
  valuation_attractiveness: number;
}

export interface CompanyComparisonRequest {
  company_ids: number[];
  reporting_basis?: string;
}

export interface CompanyComparisonResponse {
  reporting_basis: string;
  companies_count: number;
  companies: ComparisonCompanyHeader[];
  categories: string[];
  metrics: ComparisonMetricRow[];
  radar_scores: RadarDimensionScore[];
}
