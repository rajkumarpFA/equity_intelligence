"use client";

import React, { useState, useId, useMemo } from "react";
import { formatINR } from "@/lib/format";

interface CandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  symbol: string;
  currentPrice: number | string;
  priceChange?: number | string;
  priceChangePct?: number | string;
  height?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deterministic pseudo-random generator (avoids SSR hydration mismatches)
function pseudoRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function CandlestickChart({
  symbol,
  currentPrice,
  priceChange,
  priceChangePct,
  height = 360,
}: CandlestickChartProps) {
  const [timeframe, setTimeframe] = useState<"1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "ALL">("1M");
  const [hoveredPoint, setHoveredPoint] = useState<CandlePoint | null>(null);
  const reactId = useId();
  const cleanId = reactId.replace(/:/g, "");

  const priceNum = typeof currentPrice === "string" ? parseFloat(currentPrice) : currentPrice;

  // Candle count based on timeframe
  const candleCount = timeframe === "1D" ? 24 : timeframe === "5D" ? 35 : timeframe === "1M" ? 30 : 60;

  // Generate deterministic historical candle data around the current stock price
  const candles: CandlePoint[] = useMemo(() => {
    if (priceNum == null || isNaN(priceNum) || priceNum <= 0) return [];

    const list: CandlePoint[] = [];
    let prevClose = priceNum * 0.94;
    const baseDate = new Date("2026-11-12T00:00:00Z");

    for (let i = candleCount - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() - i);
      const seed = i * 17 + 101;
      const isUp = Math.sin(i * 0.7) + (pseudoRand(seed) - 0.48) > 0;
      const variation = prevClose * 0.015 * (pseudoRand(seed + 1) * 0.8 + 0.2);
      const open = prevClose;
      const close = isUp ? open + variation : Math.max(10, open - variation);
      const high = Math.max(open, close) + variation * 0.5 * pseudoRand(seed + 2);
      const low = Math.min(open, close) - variation * 0.5 * pseudoRand(seed + 3);
      const volume = Math.floor(100000 + pseudoRand(seed + 4) * 850000);

      list.push({
        date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });
      prevClose = close;
    }

    // Make the last candle align with priceNum
    if (list.length > 0) {
      list[list.length - 1].close = priceNum;
      list[list.length - 1].high = Math.max(list[list.length - 1].high, priceNum);
      list[list.length - 1].low = Math.min(list[list.length - 1].low, priceNum);
    }
    return list;
  }, [candleCount, priceNum]);

  if (priceNum == null || isNaN(priceNum) || priceNum <= 0 || candles.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] text-xs text-[var(--text-3)] font-mono">
        Candlestick chart data unavailable for {symbol}
      </div>
    );
  }

  const allLows = candles.map((c) => c.low);
  const allHighs = candles.map((c) => c.high);
  const minPrice = Math.min(...allLows) * 0.99;
  const maxPrice = Math.max(...allHighs) * 1.01;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = Math.max(...candles.map((c) => c.volume)) || 1;

  const paddingLeft = 10;
  const paddingRight = 65;
  const paddingTop = 25;
  const chartBottom = height - 70;
  const volumeTop = height - 55;
  const volumeBottom = height - 20;

  // Compute 10-period and 20-period Moving Average lines
  const ma10Points: { x: number; y: number }[] = [];
  const ma20Points: { x: number; y: number }[] = [];

  const svgWidth = 800;
  const stepX = (svgWidth - paddingLeft - paddingRight) / Math.max(1, candles.length - 1);

  candles.forEach((candle, idx) => {
    const x = paddingLeft + idx * stepX;
    if (idx >= 9) {
      const slice10 = candles.slice(idx - 9, idx + 1);
      const avg10 = slice10.reduce((sum, c) => sum + Number(c.close), 0) / 10;
      const y10 = paddingTop + (1 - (avg10 - minPrice) / priceRange) * (chartBottom - paddingTop);
      ma10Points.push({ x, y: y10 });
    }
    if (idx >= 19) {
      const slice20 = candles.slice(idx - 19, idx + 1);
      const avg20 = slice20.reduce((sum, c) => sum + Number(c.close), 0) / 20;
      const y20 = paddingTop + (1 - (avg20 - minPrice) / priceRange) * (chartBottom - paddingTop);
      ma20Points.push({ x, y: y20 });
    }
  });

  const ma10D = ma10Points.length > 0 ? `M ${ma10Points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}` : "";
  const ma20D = ma20Points.length > 0 ? `M ${ma20Points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}` : "";

  // Current price horizontal line
  const currentPriceY =
    paddingTop + (1 - (priceNum - minPrice) / priceRange) * (chartBottom - paddingTop);

  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm transition">
      {/* Chart Top Bar: Symbol, Timeframes & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--text-3)]">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <span>MA (10)</span>
            <span className="ml-2 h-2 w-2 rounded-full bg-[var(--accent-2)]" />
            <span>MA (20)</span>
          </div>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center rounded-lg border border-[var(--border)] bg-white/5 p-0.5 text-[11px] font-bold text-[var(--text-3)]">
          {(["1D", "5D", "1M", "6M", "YTD", "1Y", "ALL"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-2.5 py-1 transition ${
                timeframe === tf
                  ? "bg-[var(--accent)] text-slate-950 shadow-sm font-extrabold"
                  : "hover:text-[var(--text-1)]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Active Hover Tooltip */}
      {hoveredPoint && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-mono text-[var(--text-2)] border border-[var(--border)]">
          <span className="font-bold text-[var(--text-1)]">
            {hoveredPoint.date}
          </span>
          <span>O: <span className="font-semibold text-[var(--text-1)]">{formatINR(hoveredPoint.open)}</span></span>
          <span>H: <span className="font-semibold text-[var(--up)]">{formatINR(hoveredPoint.high)}</span></span>
          <span>L: <span className="font-semibold text-[var(--down)]">{formatINR(hoveredPoint.low)}</span></span>
          <span>C: <span className="font-semibold text-[var(--text-1)]">{formatINR(hoveredPoint.close)}</span></span>
          <span>Vol: <span className="font-semibold text-[var(--text-3)]">{hoveredPoint.volume.toLocaleString("en-IN")}</span></span>
        </div>
      )}

      {/* SVG Candlestick & Volume Canvas */}
      <div className="relative mt-2 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full select-none"
          style={{ height }}
        >
          <defs>
            <linearGradient id={`candlestick-cyan-${cleanId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D3F3" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#00D3F3" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = paddingTop + ratio * (chartBottom - paddingTop);
            const price = maxPrice - ratio * priceRange;
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-white/[0.04]"
                  strokeDasharray="3 3"
                />
                <text
                  x={svgWidth - paddingRight + 8}
                  y={y + 3}
                  className="fill-[var(--text-3)] text-[10px] font-mono"
                >
                  {price.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Volume bars at bottom */}
          {candles.map((c, idx) => {
            const x = paddingLeft + idx * stepX;
            const barW = Math.max(2, stepX * 0.6);
            const isGreen = c.close >= c.open;
            const barHeight = (c.volume / maxVolume) * (volumeBottom - volumeTop);
            const y = volumeBottom - barHeight;

            return (
              <rect
                key={`vol-${idx}`}
                x={x - barW / 2}
                y={y}
                width={barW}
                height={Math.max(2, barHeight)}
                fill={isGreen ? "var(--up)" : "var(--down)"}
                opacity={0.3}
              />
            );
          })}

          {/* Candlesticks */}
          {candles.map((c, idx) => {
            const x = paddingLeft + idx * stepX;
            const isGreen = c.close >= c.open;
            const color = isGreen ? "var(--up)" : "var(--down)";

            const highY = paddingTop + (1 - (c.high - minPrice) / priceRange) * (chartBottom - paddingTop);
            const lowY = paddingTop + (1 - (c.low - minPrice) / priceRange) * (chartBottom - paddingTop);
            const openY = paddingTop + (1 - (c.open - minPrice) / priceRange) * (chartBottom - paddingTop);
            const closeY = paddingTop + (1 - (c.close - minPrice) / priceRange) * (chartBottom - paddingTop);

            const candleTop = Math.min(openY, closeY);
            const candleHeight = Math.max(2, Math.abs(closeY - openY));
            const candleW = Math.max(3, stepX * 0.7);

            return (
              <g
                key={`candle-${idx}`}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredPoint(c)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.25"
                />
                {/* Body */}
                <rect
                  x={x - candleW / 2}
                  y={candleTop}
                  width={candleW}
                  height={candleHeight}
                  fill={isGreen ? color : color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* MA 10 Curve (Sky) */}
          {ma10D && (
            <path
              d={ma10D}
              fill="none"
              stroke="#00D3F3"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* MA 20 Curve (Yellow) */}
          {ma20D && (
            <path
              d={ma20D}
              fill="none"
              stroke="#FDC700"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current Price Reference Line & Right Axis Tag */}
          <line
            x1={paddingLeft}
            y1={currentPriceY}
            x2={svgWidth - paddingRight}
            y2={currentPriceY}
            stroke="#00D3F3"
            strokeDasharray="4 4"
            strokeWidth="1.25"
          />
          <g transform={`translate(${svgWidth - paddingRight}, ${currentPriceY - 9})`}>
            <rect
              x="2"
              y="0"
              width="58"
              height="18"
              rx="4"
              fill="#00D3F3"
            />
            <text
              x="31"
              y="12"
              textAnchor="middle"
              className="fill-slate-950 text-[10px] font-mono font-bold"
            >
              {priceNum.toFixed(1)}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
