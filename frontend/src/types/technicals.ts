export interface CandleDataPoint {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close?: number | null;
}

export interface IndicatorPoint {
  trade_date: string;
  value: number | null;
}

export interface MACDPoint {
  trade_date: string;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerBandsPoint {
  trade_date: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
  bandwidth: number | null;
  percent_b: number | null;
}

export interface HistoricalReturns {
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  cagr_3y: number | null;
  cagr_5y: number | null;
}

export interface DrawdownStats {
  max_drawdown_pct: number | null;
  peak_date: string | null;
  trough_date: string | null;
  high_52w: number | null;
  low_52w: number | null;
  current_drawdown_from_52w_high_pct: number | null;
}

export interface PivotPoints {
  pivot: number;
  r1: number;
  s1: number;
  r2: number;
  s2: number;
  r3: number;
  s3: number;
}

export interface TechnicalsSummary {
  last_close: number;
  last_date: string;
  price_change: number | null;
  price_change_pct: number | null;

  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;

  rsi_14: number | null;
  rsi_condition: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | string;

  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;

  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  bb_bandwidth: number | null;
  bb_squeeze: boolean;

  avg_volume_20d: number | null;
  volume_vs_20d_ratio: number | null;

  trend_signal: "BULLISH" | "BEARISH" | "NEUTRAL" | string;
  trend_explanation: string;

  returns: HistoricalReturns;
  drawdown: DrawdownStats;
  pivots?: PivotPoints | null;
}

export interface CompanyTechnicalsResponse {
  company_id: number;
  security_id: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  data_points_count: number;

  candles: CandleDataPoint[];
  sma_20: IndicatorPoint[];
  sma_50: IndicatorPoint[];
  sma_200: IndicatorPoint[];
  ema_12: IndicatorPoint[];
  ema_26: IndicatorPoint[];
  rsi_14: IndicatorPoint[];
  macd: MACDPoint[];
  bollinger_bands: BollingerBandsPoint[];

  summary: TechnicalsSummary;
}
