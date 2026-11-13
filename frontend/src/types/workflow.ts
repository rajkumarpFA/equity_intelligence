/**
 * TypeScript definitions for Phase 13: Watchlists & Investment Journal
 */

export interface WatchlistItem {
  id: number;
  watchlist_id: number;
  company_id: number;
  symbol: string;
  company_name: string;
  sector_name?: string | null;
  industry_name?: string | null;
  is_financial_sector: boolean;
  current_price?: number | null;
  price_change?: number | null;
  price_change_pct?: number | null;
  target_entry_price?: number | null;
  target_exit_price?: number | null;
  distance_to_entry_pct?: number | null;
  conviction: number;
  thesis_summary?: string | null;
  notes?: string | null;
  added_at: string;
}

export interface Watchlist {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  items_count: number;
  items: WatchlistItem[];
  created_at: string;
  updated_at: string;
}

export interface CatalystItem {
  title: string;
  target_date?: string | null;
  status: 'PENDING' | 'ACHIEVED' | 'MISSED';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskItem {
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  mitigant?: string | null;
}

export interface InvestmentNote {
  id: number;
  company_id: number;
  symbol: string;
  company_name: string;
  title: string;
  category: 'THESIS' | 'EARNINGS' | 'RISK' | 'VALUATION' | 'POST_MORTEM' | string;
  conviction_score: number;
  content: string;
  catalysts: CatalystItem[];
  key_risks: RiskItem[];
  target_price?: number | null;
  review_date?: string | null;
  created_at: string;
  updated_at: string;
}
