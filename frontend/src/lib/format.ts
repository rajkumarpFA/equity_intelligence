/**
 * Equity Intelligence Canonical Display Formatting Library
 * Strictly display-only formatting helpers. No business logic or calculations.
 * Adheres to Indian numbering system (en-IN) and design system tokens.
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format exact Indian Rupee amount (e.g. ₹1,339.70).
 */
export function formatINR(val?: number | string | null): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return inrFormatter.format(num);
}

/**
 * Format standardized aggregates in Crores (₹ Cr) or Lakh Crores (₹ L Cr).
 */
export function formatCrores(
  val?: number | string | null,
  compact: boolean = false
): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";

  if (compact && Math.abs(num) >= 100000) {
    const lCr = num / 100000;
    return `₹${numberFormatter.format(lCr)} L Cr`;
  }
  return `₹${numberFormatter.format(num)} Cr`;
}

/**
 * Format percentage with explicit sign (+ / -) and 1 to 2 decimal places.
 */
export function formatPercent(
  val?: number | string | null,
  decimals: number = 2
): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format financial ratios (e.g. 2.45x).
 */
export function formatRatio(
  val?: number | string | null,
  decimals: number = 2
): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return `${num.toFixed(decimals)}x`;
}

/**
 * Format number with Indian grouping (e.g. 1,23,456.78).
 */
export function formatNumber(
  val?: number | string | null,
  decimals: number = 2
): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format ISO date string into Indian standard date (e.g. 12 Nov 2026).
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format duration in days (e.g. 42 days).
 */
export function formatDays(val?: number | string | null): string {
  if (val == null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return `${Math.round(num)} days`;
}

