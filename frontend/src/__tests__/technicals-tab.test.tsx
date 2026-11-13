import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TechnicalAnalysisTab } from "@/components/company/TechnicalAnalysisTab";
import * as apiClient from "@/lib/api-client";
import type { CompanyTechnicalsResponse } from "@/types/technicals";

vi.mock("@/lib/api-client", () => ({
  fetchCompanyTechnicals: vi.fn(),
}));

const mockTechnicalsResponse: CompanyTechnicalsResponse = {
  company_id: 1,
  security_id: 1,
  symbol: "RELIANCE",
  exchange: "NSE",
  timeframe: "1Y",
  data_points_count: 5,
  candles: [
    { trade_date: "2026-11-08", open: 1300.0, high: 1320.0, low: 1295.0, close: 1315.0, volume: 1500000 },
    { trade_date: "2026-11-09", open: 1315.0, high: 1335.0, low: 1310.0, close: 1330.0, volume: 1800000 },
    { trade_date: "2026-11-10", open: 1330.0, high: 1345.0, low: 1325.0, close: 1328.0, volume: 1200000 },
    { trade_date: "2026-11-11", open: 1328.0, high: 1340.0, low: 1320.0, close: 1335.0, volume: 1400000 },
    { trade_date: "2026-11-12", open: 1335.0, high: 1350.0, low: 1332.0, close: 1342.0, volume: 2000000 },
  ],
  sma_20: [
    { trade_date: "2026-11-08", value: 1305.0 },
    { trade_date: "2026-11-09", value: 1310.0 },
    { trade_date: "2026-11-10", value: 1315.0 },
    { trade_date: "2026-11-11", value: 1320.0 },
    { trade_date: "2026-11-12", value: 1325.0 },
  ],
  sma_50: [
    { trade_date: "2026-11-08", value: 1280.0 },
    { trade_date: "2026-11-09", value: 1285.0 },
    { trade_date: "2026-11-10", value: 1290.0 },
    { trade_date: "2026-11-11", value: 1295.0 },
    { trade_date: "2026-11-12", value: 1300.0 },
  ],
  sma_200: [
    { trade_date: "2026-11-08", value: 1220.0 },
    { trade_date: "2026-11-09", value: 1222.0 },
    { trade_date: "2026-11-10", value: 1225.0 },
    { trade_date: "2026-11-11", value: 1227.0 },
    { trade_date: "2026-11-12", value: 1230.0 },
  ],
  ema_12: [
    { trade_date: "2026-11-08", value: 1310.0 },
    { trade_date: "2026-11-09", value: 1318.0 },
    { trade_date: "2026-11-10", value: 1322.0 },
    { trade_date: "2026-11-11", value: 1327.0 },
    { trade_date: "2026-11-12", value: 1334.0 },
  ],
  ema_26: [
    { trade_date: "2026-11-08", value: 1295.0 },
    { trade_date: "2026-11-09", value: 1300.0 },
    { trade_date: "2026-11-10", value: 1305.0 },
    { trade_date: "2026-11-11", value: 1310.0 },
    { trade_date: "2026-11-12", value: 1315.0 },
  ],
  rsi_14: [
    { trade_date: "2026-11-08", value: 58.5 },
    { trade_date: "2026-11-09", value: 64.2 },
    { trade_date: "2026-11-10", value: 61.0 },
    { trade_date: "2026-11-11", value: 65.8 },
    { trade_date: "2026-11-12", value: 71.4 },
  ],
  macd: [
    { trade_date: "2026-11-08", macd: 15.0, signal: 12.0, histogram: 3.0 },
    { trade_date: "2026-11-09", macd: 18.0, signal: 13.5, histogram: 4.5 },
    { trade_date: "2026-11-10", macd: 17.0, signal: 14.2, histogram: 2.8 },
    { trade_date: "2026-11-11", macd: 17.0, signal: 14.8, histogram: 2.2 },
    { trade_date: "2026-11-12", macd: 19.0, signal: 15.5, histogram: 3.5 },
  ],
  bollinger_bands: [
    { trade_date: "2026-11-08", upper: 1350.0, middle: 1305.0, lower: 1260.0, bandwidth: 6.9, percent_b: 0.61 },
    { trade_date: "2026-11-09", upper: 1355.0, middle: 1310.0, lower: 1265.0, bandwidth: 6.8, percent_b: 0.72 },
    { trade_date: "2026-11-10", upper: 1358.0, middle: 1315.0, lower: 1272.0, bandwidth: 6.5, percent_b: 0.65 },
    { trade_date: "2026-11-11", upper: 1362.0, middle: 1320.0, lower: 1278.0, bandwidth: 6.3, percent_b: 0.68 },
    { trade_date: "2026-11-12", upper: 1368.0, middle: 1325.0, lower: 1282.0, bandwidth: 6.5, percent_b: 0.70 },
  ],
  summary: {
    last_close: 1342.0,
    last_date: "2026-11-12",
    price_change: 7.0,
    price_change_pct: 0.52,
    sma_20: 1325.0,
    sma_50: 1300.0,
    sma_200: 1230.0,
    ema_12: 1334.0,
    ema_26: 1315.0,
    rsi_14: 71.4,
    rsi_condition: "OVERBOUGHT",
    macd: 19.0,
    macd_signal: 15.5,
    macd_histogram: 3.5,
    bb_upper: 1368.0,
    bb_middle: 1325.0,
    bb_lower: 1282.0,
    bb_bandwidth: 6.5,
    bb_squeeze: true,
    avg_volume_20d: 1500000,
    volume_vs_20d_ratio: 1.33,
    trend_signal: "BULLISH",
    trend_explanation: "Golden Cross active (50 DMA > 200 DMA) and price above both moving averages.",
    returns: {
      return_1d: 0.52,
      return_1w: 2.05,
      return_1m: 5.4,
      return_3m: 12.1,
      return_6m: 18.5,
      return_1y: 28.2,
      cagr_3y: 19.4,
      cagr_5y: 16.8,
    },
    drawdown: {
      max_drawdown_pct: -15.2,
      peak_date: "2026-08-14",
      trough_date: "2026-09-20",
      high_52w: 1380.0,
      low_52w: 1050.0,
      current_drawdown_from_52w_high_pct: -2.75,
    },
    pivots: {
      pivot: 1341.33,
      r1: 1350.67,
      s1: 1332.67,
      r2: 1359.33,
      s2: 1323.33,
      r3: 1368.67,
      s3: 1314.67,
    },
  },
};

describe("TechnicalAnalysisTab Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.mocked(apiClient.fetchCompanyTechnicals).mockResolvedValue(mockTechnicalsResponse);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TechnicalAnalysisTab
          companyId={1}
          companyName="Reliance Industries Limited"
          symbol="RELIANCE"
          currentPrice={1342.0}
        />
      </QueryClientProvider>
    );

  it("renders timeframe pills and overlay controls", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("1M")).toBeInTheDocument();
      expect(screen.getByText("1Y")).toBeInTheDocument();
      expect(screen.getByText("20 SMA")).toBeInTheDocument();
      expect(screen.getByText("50 DMA")).toBeInTheDocument();
      expect(screen.getByText("200 DMA")).toBeInTheDocument();
      expect(screen.getByText("BB (20,2)")).toBeInTheDocument();
    });
  });

  it("renders technical trend signal and golden cross badge", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("BULLISH")).toBeInTheDocument();
      expect(screen.getByText("Golden Cross")).toBeInTheDocument();
      expect(
        screen.getByText(/Golden Cross active \(50 DMA > 200 DMA\)/i)
      ).toBeInTheDocument();
    });
  });

  it("renders RSI meter, condition chip, and squeeze badge", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("OVERBOUGHT")).toBeInTheDocument();
      expect(screen.getByText("SQUEEZE")).toBeInTheDocument();
      expect(screen.getByText("71.4")).toBeInTheDocument();
    });
  });

  it("renders classical floor trader pivot levels", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("CENTRAL PIVOT (PP)")).toBeInTheDocument();
      expect(screen.getByText("Resistance 1 (R1)")).toBeInTheDocument();
      expect(screen.getByText("Support 1 (S1)")).toBeInTheDocument();
      expect(screen.getByText("Resistance 3 (R3)")).toBeInTheDocument();
    });
  });

  it("switches timeframes and triggers fetch", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("1Y")).toBeInTheDocument();
    });

    const btn6M = screen.getByText("6M");
    fireEvent.click(btn6M);

    await waitFor(() => {
      expect(apiClient.fetchCompanyTechnicals).toHaveBeenCalledWith(1, "6M");
    });
  });
});
