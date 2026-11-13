"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart2,
  Sliders,
  AlertTriangle,
  Compass,
  Calendar,
  Maximize2,
} from "lucide-react";
import { fetchCompanyTechnicals } from "@/lib/api-client";
import { formatINR, formatPercent, formatNumber } from "@/lib/format";
import { MissingValue } from "@/components/common/MissingValue";
import { DeltaChip } from "@/components/common/DeltaChip";
import type { CompanyTechnicalsResponse } from "@/types/technicals";

interface TechnicalAnalysisTabProps {
  companyId: number;
  companyName: string;
  symbol: string;
  currentPrice?: number | string | null;
}

export function TechnicalAnalysisTab({
  companyId,
  companyName,
  symbol,
  currentPrice,
}: TechnicalAnalysisTabProps) {
  const [timeframe, setTimeframe] = useState<"1M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL">("1Y");
  const [chartType, setChartType] = useState<"candles" | "line">("candles");

  // Indicator Overlay Toggles
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showBB, setShowBB] = useState(false);

  // Sub-panel Toggles
  const [showVolume, setShowVolume] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(false);

  // Hover state for interactive inspection
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const {
    data: techData,
    isLoading,
    isError,
    error,
  } = useQuery<CompanyTechnicalsResponse>({
    queryKey: ["technicals", companyId, timeframe],
    queryFn: () => fetchCompanyTechnicals(companyId, timeframe),
    staleTime: 60 * 1000,
  });

  const candles = techData?.candles || [];
  const summary = techData?.summary;

  const activeIndex = hoveredIndex !== null && hoveredIndex < candles.length ? hoveredIndex : (candles.length > 0 ? candles.length - 1 : null);
  const activeCandle = activeIndex !== null ? candles[activeIndex] : null;

  // Min / Max calculations for SVG chart scaling
  const chartBounds = useMemo(() => {
    if (candles.length === 0) return { min: 0, max: 100, range: 100 };
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    if (showBB && techData?.bollinger_bands) {
      techData.bollinger_bands.forEach((b) => {
        if (b.upper !== null) max = Math.max(max, b.upper);
        if (b.lower !== null) min = Math.min(min, b.lower);
      });
    }

    const padding = (max - min) * 0.05 || 1;
    return {
      min: min - padding,
      max: max + padding,
      range: (max + padding) - (min - padding) || 1,
    };
  }, [candles, showBB, techData?.bollinger_bands]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="flex h-72 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-3 text-sm text-[var(--text-3)] font-mono">
            <Activity className="h-5 w-5 animate-spin text-[var(--accent)]" />
            Loading technical analysis and price series for {symbol}...
          </div>
        </div>
      </div>
    );
  }

  if (isError || !techData || candles.length === 0) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-400">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
        Failed to load technical indicators for {companyName} ({symbol}).
        <div className="mt-2 text-xs text-[var(--text-3)] font-mono">
          {error instanceof Error ? error.message : "Technical data unavailable"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. Header Toolbar: Timeframes, Chart Mode, and Indicator Toggles */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-base)] p-1 border border-[var(--border)]">
          {(["1M", "6M", "1Y", "3Y", "5Y", "ALL"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                timeframe === tf
                  ? "bg-[var(--accent)] text-[var(--bg-base)] shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart Style: Candles vs Line */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-base)] p-1 border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setChartType("candles")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              chartType === "candles"
                ? "bg-white/10 text-[var(--text-1)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            }`}
          >
            Candles
          </button>
          <button
            type="button"
            onClick={() => setChartType("line")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              chartType === "line"
                ? "bg-white/10 text-[var(--text-1)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            }`}
          >
            Line
          </button>
        </div>

        {/* Overlay Badges & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-3)] flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Overlays:
          </span>
          <button
            type="button"
            onClick={() => setShowSMA20(!showSMA20)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showSMA20
                ? "border-[#00D3F3]/50 bg-[#00D3F3]/10 text-[#00D3F3]"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            20 SMA
          </button>
          <button
            type="button"
            onClick={() => setShowSMA50(!showSMA50)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showSMA50
                ? "border-[#FDC700]/50 bg-[#FDC700]/10 text-[#FDC700]"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            50 DMA
          </button>
          <button
            type="button"
            onClick={() => setShowSMA200(!showSMA200)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showSMA200
                ? "border-[#A78BFA]/50 bg-[#A78BFA]/10 text-[#A78BFA]"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            200 DMA
          </button>
          <button
            type="button"
            onClick={() => setShowBB(!showBB)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showBB
                ? "border-[#38BDF8]/50 bg-[#38BDF8]/10 text-[#38BDF8]"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            BB (20,2)
          </button>

          <span className="ml-2 text-xs text-[var(--text-3)] flex items-center gap-1">
            <Sliders className="h-3.5 w-3.5" /> Panels:
          </span>
          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showVolume
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            Volume
          </button>
          <button
            type="button"
            onClick={() => setShowRSI(!showRSI)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showRSI
                ? "border-purple-400/50 bg-purple-400/10 text-purple-400"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            RSI (14)
          </button>
          <button
            type="button"
            onClick={() => setShowMACD(!showMACD)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
              showMACD
                ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                : "border-[var(--border)] text-[var(--text-3)]"
            }`}
          >
            MACD
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Interactive Chart Canvas Area with Price & Indicator Scales */}
      {/* ------------------------------------------------------------- */}
      <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        {/* Crosshair / Active Point Inspector HUD */}
        {activeCandle && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-[var(--text-3)] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {activeCandle.trade_date}
              </span>
              <span>
                <span className="text-[var(--text-3)]">O:</span>{" "}
                <span className="text-[var(--text-1)]">{formatINR(activeCandle.open)}</span>
              </span>
              <span>
                <span className="text-[var(--text-3)]">H:</span>{" "}
                <span className="text-[var(--text-1)]">{formatINR(activeCandle.high)}</span>
              </span>
              <span>
                <span className="text-[var(--text-3)]">L:</span>{" "}
                <span className="text-[var(--text-1)]">{formatINR(activeCandle.low)}</span>
              </span>
              <span>
                <span className="text-[var(--text-3)]">C:</span>{" "}
                <span className="font-bold text-[var(--text-1)]">{formatINR(activeCandle.close)}</span>
              </span>
              <span>
                <span className="text-[var(--text-3)]">Vol:</span>{" "}
                <span className="text-[var(--text-2)]">{formatNumber(activeCandle.volume)}</span>
              </span>
            </div>

            {/* Active Indicator HUD Values */}
            <div className="flex items-center gap-3 text-[11px]">
              {showSMA20 && activeIndex !== null && techData.sma_20[activeIndex]?.value !== null && (
                <span className="text-[#00D3F3]">
                  SMA20: {formatINR(techData.sma_20[activeIndex].value!)}
                </span>
              )}
              {showSMA50 && activeIndex !== null && techData.sma_50[activeIndex]?.value !== null && (
                <span className="text-[#FDC700]">
                  50DMA: {formatINR(techData.sma_50[activeIndex].value!)}
                </span>
              )}
              {showSMA200 && activeIndex !== null && techData.sma_200[activeIndex]?.value !== null && (
                <span className="text-[#A78BFA]">
                  200DMA: {formatINR(techData.sma_200[activeIndex].value!)}
                </span>
              )}
              {showRSI && activeIndex !== null && techData.rsi_14[activeIndex]?.value !== null && (
                <span className="text-purple-400">
                  RSI: {techData.rsi_14[activeIndex].value!.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Primary Price & Overlays SVG Canvas */}
        <div className="relative h-80 w-full overflow-hidden select-none">
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${candles.length * 10} 320`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00D3F3" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#00D3F3" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
              const y = 320 * ratio;
              const val = chartBounds.max - (chartBounds.range * ratio);
              return (
                <g key={ratio}>
                  <line
                    x1="0"
                    y1={y}
                    x2={candles.length * 10}
                    y2={y}
                    stroke="rgba(255,255,255,0.05)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={candles.length * 10 - 4}
                    y={y - 4}
                    textAnchor="end"
                    fill="#6B7280"
                    fontSize="10"
                    className="font-mono"
                  >
                    {formatINR(val)}
                  </text>
                </g>
              );
            })}

            {/* Bollinger Bands Fill Zone */}
            {showBB && techData.bollinger_bands.length > 0 && (
              <polygon
                points={
                  techData.bollinger_bands
                    .map((b, i) => {
                      if (b.upper === null) return null;
                      const x = i * 10 + 5;
                      const y = 320 - ((b.upper - chartBounds.min) / chartBounds.range) * 320;
                      return `${x},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ") +
                  " " +
                  techData.bollinger_bands
                    .slice()
                    .reverse()
                    .map((b, i) => {
                      if (b.lower === null) return null;
                      const origIdx = techData.bollinger_bands.length - 1 - i;
                      const x = origIdx * 10 + 5;
                      const y = 320 - ((b.lower - chartBounds.min) / chartBounds.range) * 320;
                      return `${x},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ")
                }
                fill="rgba(56,189,248,0.06)"
              />
            )}

            {/* Bollinger Bands Upper & Lower Lines */}
            {showBB && (
              <>
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeOpacity="0.6"
                  strokeDasharray="3 3"
                  points={techData.bollinger_bands
                    .map((b, i) => {
                      if (b.upper === null) return null;
                      const x = i * 10 + 5;
                      const y = 320 - ((b.upper - chartBounds.min) / chartBounds.range) * 320;
                      return `${x},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ")}
                />
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  strokeOpacity="0.6"
                  strokeDasharray="3 3"
                  points={techData.bollinger_bands
                    .map((b, i) => {
                      if (b.lower === null) return null;
                      const x = i * 10 + 5;
                      const y = 320 - ((b.lower - chartBounds.min) / chartBounds.range) * 320;
                      return `${x},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ")}
                />
              </>
            )}

            {/* Candlesticks OR Area Line */}
            {chartType === "candles" ? (
              candles.map((c, i) => {
                const x = i * 10 + 5;
                const isGreen = c.close >= c.open;
                const bodyTop = Math.max(c.open, c.close);
                const bodyBottom = Math.min(c.open, c.close);

                const yHigh = 320 - ((c.high - chartBounds.min) / chartBounds.range) * 320;
                const yLow = 320 - ((c.low - chartBounds.min) / chartBounds.range) * 320;
                const yTop = 320 - ((bodyTop - chartBounds.min) / chartBounds.range) * 320;
                const yBottom = 320 - ((bodyBottom - chartBounds.min) / chartBounds.range) * 320;
                const bodyHeight = Math.max(1.5, yBottom - yTop);

                return (
                  <g
                    key={c.trade_date}
                    onMouseEnter={() => setHoveredIndex(i)}
                    className="cursor-crosshair"
                  >
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={yHigh}
                      x2={x}
                      y2={yLow}
                      stroke={isGreen ? "#22C55E" : "#EF4444"}
                      strokeWidth="1.2"
                    />
                    {/* Candle Body */}
                    <rect
                      x={x - 3.2}
                      y={yTop}
                      width="6.4"
                      height={bodyHeight}
                      fill={isGreen ? "#22C55E" : "#EF4444"}
                      rx="0.5"
                    />
                  </g>
                );
              })
            ) : (
              /* Line & Gradient Area Mode */
              <>
                <polygon
                  fill="url(#primaryAreaGrad)"
                  points={
                    candles
                      .map((c, i) => {
                        const x = i * 10 + 5;
                        const y = 320 - ((c.close - chartBounds.min) / chartBounds.range) * 320;
                        return `${x},${y}`;
                      })
                      .join(" ") +
                    ` ${candles.length * 10},320 0,320`
                  }
                />
                <polyline
                  fill="none"
                  stroke="#00D3F3"
                  strokeWidth="2"
                  points={candles
                    .map((c, i) => {
                      const x = i * 10 + 5;
                      const y = 320 - ((c.close - chartBounds.min) / chartBounds.range) * 320;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              </>
            )}

            {/* Moving Average Overlays */}
            {showSMA20 && (
              <polyline
                fill="none"
                stroke="#00D3F3"
                strokeWidth="1.6"
                points={techData.sma_20
                  .map((p, i) => {
                    if (p.value === null) return null;
                    const x = i * 10 + 5;
                    const y = 320 - ((p.value - chartBounds.min) / chartBounds.range) * 320;
                    return `${x},${y}`;
                  })
                  .filter(Boolean)
                  .join(" ")}
              />
            )}

            {showSMA50 && (
              <polyline
                fill="none"
                stroke="#FDC700"
                strokeWidth="1.8"
                points={techData.sma_50
                  .map((p, i) => {
                    if (p.value === null) return null;
                    const x = i * 10 + 5;
                    const y = 320 - ((p.value - chartBounds.min) / chartBounds.range) * 320;
                    return `${x},${y}`;
                  })
                  .filter(Boolean)
                  .join(" ")}
              />
            )}

            {showSMA200 && (
              <polyline
                fill="none"
                stroke="#A78BFA"
                strokeWidth="2"
                points={techData.sma_200
                  .map((p, i) => {
                    if (p.value === null) return null;
                    const x = i * 10 + 5;
                    const y = 320 - ((p.value - chartBounds.min) / chartBounds.range) * 320;
                    return `${x},${y}`;
                  })
                  .filter(Boolean)
                  .join(" ")}
              />
            )}

            {/* Hover indicator crosshair */}
            {activeIndex !== null && (
              <line
                x1={activeIndex * 10 + 5}
                y1="0"
                x2={activeIndex * 10 + 5}
                y2="320"
                stroke="white"
                strokeDasharray="2 2"
                strokeOpacity="0.4"
              />
            )}
          </svg>
        </div>

        {/* Sub-panel 1: Volume Histogram */}
        {showVolume && (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <div className="mb-1 text-[11px] font-mono text-[var(--text-3)] flex justify-between">
              <span>VOLUME HISTOGRAM (20-DAY AVG: {formatNumber(summary?.avg_volume_20d || 0)})</span>
              <span>LATEST VOL: {formatNumber(activeCandle?.volume || 0)}</span>
            </div>
            <div className="h-16 w-full">
              <svg
                className="h-full w-full"
                viewBox={`0 0 ${candles.length * 10} 60`}
                preserveAspectRatio="none"
              >
                {(() => {
                  const maxVol = Math.max(...candles.map((c) => c.volume), 1);
                  return candles.map((c, i) => {
                    const x = i * 10 + 5;
                    const isGreen = c.close >= c.open;
                    const h = Math.max(1, (c.volume / maxVol) * 55);
                    return (
                      <rect
                        key={c.trade_date}
                        x={x - 3.2}
                        y={60 - h}
                        width="6.4"
                        height={h}
                        fill={isGreen ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)"}
                        rx="0.5"
                      />
                    );
                  });
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* Sub-panel 2: RSI (14) Panel */}
        {showRSI && (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] font-mono text-purple-400">
              <span className="flex items-center gap-2">
                RSI (14) — WILDER SMOOTHED:{" "}
                <span className="font-bold">
                  {summary?.rsi_14 !== null && summary?.rsi_14 !== undefined
                    ? summary.rsi_14.toFixed(1)
                    : "N/A"}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    summary?.rsi_condition === "OVERBOUGHT"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : summary?.rsi_condition === "OVERSOLD"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/10 text-gray-300"
                  }`}
                >
                  {summary?.rsi_condition || "NEUTRAL"}
                </span>
              </span>
              <span className="text-[var(--text-3)]">Overbought: 70 | Oversold: 30</span>
            </div>
            <div className="relative h-16 w-full rounded bg-[var(--bg-base)]/50">
              <svg
                className="h-full w-full"
                viewBox={`0 0 ${candles.length * 10} 100`}
                preserveAspectRatio="none"
              >
                {/* 70 overbought line */}
                <line
                  x1="0"
                  y1="30"
                  x2={candles.length * 10}
                  y2="30"
                  stroke="#EF4444"
                  strokeDasharray="3 3"
                  strokeOpacity="0.4"
                />
                {/* 30 oversold line */}
                <line
                  x1="0"
                  y1="70"
                  x2={candles.length * 10}
                  y2="70"
                  stroke="#22C55E"
                  strokeDasharray="3 3"
                  strokeOpacity="0.4"
                />
                {/* 50 centerline */}
                <line
                  x1="0"
                  y1="50"
                  x2={candles.length * 10}
                  y2="50"
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="2 2"
                />
                {/* RSI Line */}
                <polyline
                  fill="none"
                  stroke="#C084FC"
                  strokeWidth="1.8"
                  points={techData.rsi_14
                    .map((p, i) => {
                      if (p.value === null) return null;
                      const x = i * 10 + 5;
                      const y = 100 - p.value; // Invert for SVG coords
                      return `${x},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ")}
                />
              </svg>
            </div>
          </div>
        )}

        {/* Sub-panel 3: MACD Panel */}
        {showMACD && (
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] font-mono text-amber-400">
              <span>
                MACD (12, 26, 9) — MACD:{" "}
                <span className="text-[#00D3F3]">{summary?.macd?.toFixed(2) ?? "N/A"}</span> | Signal:{" "}
                <span className="text-[#FDC700]">{summary?.macd_signal?.toFixed(2) ?? "N/A"}</span> | Hist:{" "}
                <span
                  className={
                    (summary?.macd_histogram ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {summary?.macd_histogram?.toFixed(2) ?? "N/A"}
                </span>
              </span>
            </div>
            <div className="relative h-16 w-full rounded bg-[var(--bg-base)]/50">
              <svg
                className="h-full w-full"
                viewBox={`0 0 ${candles.length * 10} 60`}
                preserveAspectRatio="none"
              >
                {/* Zero line */}
                <line
                  x1="0"
                  y1="30"
                  x2={candles.length * 10}
                  y2="30"
                  stroke="rgba(255,255,255,0.15)"
                />
                {/* Histogram */}
                {techData.macd.map((m, i) => {
                  if (m.histogram === null) return null;
                  const x = i * 10 + 5;
                  const isPos = m.histogram >= 0;
                  const barH = Math.min(28, Math.abs(m.histogram) * 3);
                  return (
                    <rect
                      key={m.trade_date}
                      x={x - 2.5}
                      y={isPos ? 30 - barH : 30}
                      width="5"
                      height={Math.max(1, barH)}
                      fill={isPos ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Technical Summary Dashboard: Signals, Moving Averages, Volatility */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Overall Trend Signal */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-3)] flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-[var(--accent)]" /> OVERALL TREND
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                summary?.trend_signal === "BULLISH"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : summary?.trend_signal === "BEARISH"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
              }`}
            >
              {summary?.trend_signal || "NEUTRAL"}
            </span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-1)] tabular-nums">
            {formatINR(summary?.last_close || 0)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <DeltaChip percentage={summary?.price_change_pct || 0} />
            <span className="text-xs text-[var(--text-3)]">
              {summary?.price_change && summary.price_change > 0 ? "+" : ""}
              {summary?.price_change?.toFixed(2)} pts
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-2)]">
            {summary?.trend_explanation || "Analyzing moving average crossovers and price momentum."}
          </p>
        </div>

        {/* Card 2: Moving Averages Alignment */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-3)] flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-[#FDC700]" /> MOVING AVERAGES
            </span>
            {summary?.sma_50 && summary?.sma_200 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  summary.sma_50 > summary.sma_200
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/10 text-red-400 border border-red-500/30"
                }`}
              >
                {summary.sma_50 > summary.sma_200 ? "Golden Cross" : "Death Cross"}
              </span>
            )}
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">20 SMA (Short):</span>
              <span className="font-semibold text-[#00D3F3]">
                {summary?.sma_20 ? formatINR(summary.sma_20) : <MissingValue reason="Insufficient data" />}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">50 DMA (Medium):</span>
              <span className="font-semibold text-[#FDC700]">
                {summary?.sma_50 ? formatINR(summary.sma_50) : <MissingValue reason="Insufficient data" />}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">200 DMA (Long-Term):</span>
              <span className="font-semibold text-[#A78BFA]">
                {summary?.sma_200 ? formatINR(summary.sma_200) : <MissingValue reason="Insufficient data" />}
              </span>
            </div>
            <div className="flex justify-between pt-0.5 text-[11px] text-[var(--text-3)]">
              <span>Position vs 200 DMA:</span>
              <span
                className={`font-bold ${
                  summary?.last_close && summary.sma_200 && summary.last_close >= summary.sma_200
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {summary?.last_close && summary.sma_200
                  ? `${(((summary.last_close - summary.sma_200) / summary.sma_200) * 100).toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Volatility & Bollinger Bands */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-3)] flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4 text-[#38BDF8]" /> BOLLINGER BANDS (20,2)
            </span>
            {summary?.bb_squeeze && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 animate-pulse">
                SQUEEZE
              </span>
            )}
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">Upper Band:</span>
              <span className="font-semibold text-[#38BDF8]">
                {summary?.bb_upper ? formatINR(summary.bb_upper) : <MissingValue reason="N/A" />}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">Middle (20 SMA):</span>
              <span className="font-semibold text-[var(--text-2)]">
                {summary?.bb_middle ? formatINR(summary.bb_middle) : <MissingValue reason="N/A" />}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">Lower Band:</span>
              <span className="font-semibold text-[#38BDF8]">
                {summary?.bb_lower ? formatINR(summary.bb_lower) : <MissingValue reason="N/A" />}
              </span>
            </div>
            <div className="flex justify-between pt-0.5 text-[11px] text-[var(--text-3)]">
              <span>Bandwidth %:</span>
              <span className="font-bold text-[var(--text-1)]">
                {summary?.bb_bandwidth !== null && summary?.bb_bandwidth !== undefined
                  ? `${summary.bb_bandwidth.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Drawdown & 52-Week Range */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-3)] flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-400" /> RISK & DRAWDOWN
            </span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20">
              Peak: {summary?.drawdown?.peak_date || "N/A"}
            </span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">Max Historical DD:</span>
              <span className="font-bold text-red-400">
                {summary?.drawdown?.max_drawdown_pct !== null && summary?.drawdown?.max_drawdown_pct !== undefined
                  ? `${summary.drawdown.max_drawdown_pct.toFixed(1)}%`
                  : <MissingValue reason="N/A" />}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">52-Week High:</span>
              <span className="font-semibold text-emerald-400">
                {summary?.drawdown?.high_52w ? formatINR(summary.drawdown.high_52w) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-[var(--text-3)]">52-Week Low:</span>
              <span className="font-semibold text-red-400">
                {summary?.drawdown?.low_52w ? formatINR(summary.drawdown.low_52w) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between pt-0.5 text-[11px] text-[var(--text-3)]">
              <span>DD from 52W High:</span>
              <span className="font-bold text-amber-400">
                {summary?.drawdown?.current_drawdown_from_52w_high_pct !== null &&
                summary?.drawdown?.current_drawdown_from_52w_high_pct !== undefined
                  ? `${summary.drawdown.current_drawdown_from_52w_high_pct.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Two-Column Lower Section: Compounded Historical Returns & Pivot Points */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Historical Returns Matrix */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--accent)]" /> Compounded Historical Performance
          </h4>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: "1 Day", val: summary?.returns?.return_1d },
              { label: "1 Week", val: summary?.returns?.return_1w },
              { label: "1 Month", val: summary?.returns?.return_1m },
              { label: "3 Month", val: summary?.returns?.return_3m },
              { label: "6 Month", val: summary?.returns?.return_6m },
              { label: "1 Year", val: summary?.returns?.return_1y },
              { label: "3Y CAGR", val: summary?.returns?.cagr_3y },
              { label: "5Y CAGR", val: summary?.returns?.cagr_5y },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3"
              >
                <div className="text-[11px] text-[var(--text-3)]">{item.label}</div>
                <div className="mt-1 font-mono text-sm font-bold">
                  {item.val !== null && item.val !== undefined ? (
                    <span className={item.val >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}>
                      {item.val >= 0 ? "+" : ""}
                      {item.val.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-[var(--text-3)] text-xs">N/A</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Classical Floor Trader Pivot Points */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#FDC700]" /> Floor Trader Pivot Levels (Support & Resistance)
          </h4>
          {summary?.pivots ? (
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between rounded-lg bg-red-500/10 px-3 py-1.5 text-red-400">
                <span className="font-bold">Resistance 3 (R3)</span>
                <span>{formatINR(summary.pivots.r3)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-red-500/5 px-3 py-1.5 text-red-300">
                <span className="font-bold">Resistance 2 (R2)</span>
                <span>{formatINR(summary.pivots.r2)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-red-500/5 px-3 py-1.5 text-red-200">
                <span className="font-bold">Resistance 1 (R1)</span>
                <span>{formatINR(summary.pivots.r1)}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 font-bold text-[var(--accent)]">
                <span>CENTRAL PIVOT (PP)</span>
                <span>{formatINR(summary.pivots.pivot)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-500/5 px-3 py-1.5 text-emerald-200">
                <span className="font-bold">Support 1 (S1)</span>
                <span>{formatINR(summary.pivots.s1)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-500/5 px-3 py-1.5 text-emerald-300">
                <span className="font-bold">Support 2 (S2)</span>
                <span>{formatINR(summary.pivots.s2)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
                <span className="font-bold">Support 3 (S3)</span>
                <span>{formatINR(summary.pivots.s3)}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-[var(--text-3)] font-mono">
              Pivot points unavailable (insufficient range)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
