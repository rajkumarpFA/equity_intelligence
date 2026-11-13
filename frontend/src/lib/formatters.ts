/**
 * Indian Rupee and financial numerical formatting helpers.
 */

export function formatINR(amount?: number | string | null): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(val?: number | string | null, maxDecimals: number = 2): string {
  if (val === null || val === undefined || val === "") {
    return "—";
  }
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: maxDecimals,
  }).format(num);
}

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
