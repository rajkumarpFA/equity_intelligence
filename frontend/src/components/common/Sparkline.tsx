"use client";

import React, { useId } from "react";

interface SparklineProps {
  data: (number | string)[];
  width?: number;
  height?: number;
  isPositive?: boolean;
  color?: string;
  className?: string;
  showGradient?: boolean;
}

export function Sparkline({
  data,
  width = 90,
  height = 32,
  isPositive = true,
  color,
  className = "",
  showGradient = true,
}: SparklineProps) {
  const reactId = useId();
  const cleanId = reactId.replace(/:/g, "");

  if (!data || data.length < 2) return null;

  const numData = data
    .map((v) => (typeof v === "string" ? parseFloat(v) : v))
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  if (numData.length < 2) return null;

  const min = Math.min(...numData);
  const max = Math.max(...numData);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 3;

  const points = numData.map((val, idx) => {
    const x = (idx / (numData.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `M ${points[0]} L ${points.join(" L ")} L ${width - padding},${height} L ${padding},${height} Z`;

  const strokeColor = color ?? (isPositive ? "#00D3F3" : "#F43F5E");
  const gradientId = `sparkline-grad-${cleanId}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      {showGradient && <path d={areaD} fill={`url(#${gradientId})`} />}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
