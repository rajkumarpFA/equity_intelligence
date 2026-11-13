/**
 * Helpers to construct verified deep-links to external market data and exchange portals.
 */

export function getGoogleFinanceUrl(symbol: string, exchange: string = "NSE"): string {
  const cleanSym = symbol.trim().toUpperCase();
  const exchangeCode = exchange.toUpperCase() === "BSE" ? "BOM" : "NSE";
  return `https://www.google.com/finance/quote/${cleanSym}:${exchangeCode}`;
}

export function getTradingViewUrl(symbol: string, exchange: string = "NSE"): string {
  const cleanSym = symbol.trim().toUpperCase();
  const ex = exchange.toUpperCase() === "BSE" ? "BSE" : "NSE";
  return `https://in.tradingview.com/chart/?symbol=${ex}:${cleanSym}`;
}

export function getNSEUrl(symbol: string): string {
  const cleanSym = symbol.trim().toUpperCase();
  return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(cleanSym)}`;
}

export function getBSEUrl(scripCodeOrSymbol: string): string {
  const clean = scripCodeOrSymbol.trim();
  // If numeric scrip code (e.g. 500325), link to BSE scrip page
  if (/^\d+$/.test(clean)) {
    return `https://www.bseindia.com/stock-share-price/x/y/${clean}/`;
  }
  return `https://www.bseindia.com/stock-share-price/x/y/${encodeURIComponent(clean)}/`;
}

export function getYahooFinanceUrl(symbol: string, exchange: string = "NSE"): string {
  const cleanSym = symbol.trim().toUpperCase();
  const suffix = exchange.toUpperCase() === "BSE" ? ".BO" : ".NS";
  return `https://finance.yahoo.com/quote/${cleanSym}${suffix}`;
}
