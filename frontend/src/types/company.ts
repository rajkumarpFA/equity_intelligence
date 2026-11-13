export interface SecurityRead {
  id: number;
  exchange_code: "NSE" | "BSE" | string;
  exchange_name: string;
  symbol: string;
  series: string;
  exchange_token?: string | null;
  provider_instrument_key?: string | null;
  is_primary: boolean;
  is_active: boolean;
  lot_size: number;
  market_cap_category?: string | null;
}

export interface SectorRead {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface IndustryRead {
  id: number;
  sector_id: number;
  name: string;
  code?: string | null;
}

export interface CompanyRead {
  id: number;
  name: string;
  legal_name?: string | null;
  isin: string;
  cin?: string | null;
  sector?: SectorRead | null;
  industry?: IndustryRead | null;
  is_financial_sector: boolean;
  accounting_standard: string;
  paid_up_capital?: number | null;
  face_value?: number | null;
  description?: string | null;
  website?: string | null;
  status: string;
  current_price?: number | string | null;
  price_change?: number | string | null;
  price_change_pct?: number | string | null;
  price_date?: string | null;
  securities: SecurityRead[];
  created_at: string;
  updated_at: string;
}

export interface CompanySearchItem {
  id: number;
  name: string;
  isin: string;
  cin?: string | null;
  sector_name?: string | null;
  industry_name?: string | null;
  is_financial_sector: boolean;
  status: string;
  primary_symbol?: string | null;
  exchange_listings: string[];
  current_price?: number | string | null;
  price_change?: number | string | null;
  price_change_pct?: number | string | null;
  price_date?: string | null;
  securities: SecurityRead[];
}

export interface CompanySearchResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CompanySearchItem[];
}
