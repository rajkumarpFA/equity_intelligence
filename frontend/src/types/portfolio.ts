/**
 * Portfolio types matching backend Pydantic models (Phase 14).
 */

export interface Portfolio {
  id: number;
  name: string;
  description: string | null;
  benchmark_symbol: string;
  cash_balance: number;
  currency: string;
  total_equity_value: number;
  total_invested_amount: number;
  total_unrealized_pnl: number;
  total_realized_pnl: number;
  portfolio_xirr: number | null;
  holdings_count: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  security_id: number;
  company_id: number;
  symbol: string;
  company_name: string;
  sector_name: string;
  market_cap_category: string;
  total_quantity: number;
  average_buy_price: number;
  invested_amount: number;
  current_price: number | null;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number | null;
  realized_pnl: number;
  holding_xirr: number | null;
}

export interface SectorAllocation {
  name: string;
  value: number;
  weight_pct: number;
}

export interface MarketCapAllocation {
  tier: string;
  value: number;
  weight_pct: number;
}

export interface PortfolioAnalytics {
  portfolio_id: number;
  portfolio_name: string;
  total_net_worth: number;
  total_stock_value: number;
  invested_capital: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number | null;
  realized_pnl: number;
  cash_balance: number;
  portfolio_xirr: number | null;
  benchmark_symbol: string;
  beta: number | null;
  alpha: number | null;
  sectors: SectorAllocation[];
  market_caps: MarketCapAllocation[];
  holdings: PortfolioHolding[];
}

export interface PortfolioTransaction {
  id: number;
  portfolio_id: number;
  security_id: number | null;
  company_id: number | null;
  symbol: string | null;
  company_name: string | null;
  transaction_type: string;
  trade_date: string;
  trade_time: string | null;
  order_sequence: number;
  quantity: number | null;
  price_per_share: number | null;
  amount: number;
  brokerage_charges: number;
  taxes: number;
  broker_trade_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface TransactionCreatePayload {
  symbol?: string;
  security_id?: number;
  company_id?: number;
  transaction_type: string;
  trade_date: string;
  quantity?: number;
  price_per_share?: number;
  amount?: number;
  brokerage_charges?: number;
  taxes?: number;
  notes?: string;
}

export interface CSVImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}
