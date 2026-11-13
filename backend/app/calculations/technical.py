"""Mathematical calculation engine for Technical Indicators and EOD price analysis.

Implements standard quantitative formulas with strict data integrity (missing values
return None rather than fabricated zeros):
- Simple Moving Average (SMA)
- Exponential Moving Average (EMA)
- Relative Strength Index (RSI - Wilder's smoothing)
- Moving Average Convergence Divergence (MACD)
- Bollinger Bands (BB - 20-period, 2 std dev)
- Historical Returns (1D, 1W, 1M, 3M, 6M, 1Y, 3Y/5Y CAGR)
- Maximum Drawdown (MDD) & Drawdown Series
- Classical Floor Trader Pivot Points (PP, R1-R3, S1-S3)
- 52-Week High & Low
"""

import math
from datetime import date


def calculate_sma(prices: list[float], window: int) -> list[float | None]:
    """Calculate Simple Moving Average (SMA) over a sliding window.

    Returns a list of the same length as `prices`. Entries where fewer than
    `window` periods are available are set to `None`.
    """
    if window <= 0:
        raise ValueError("Window must be positive")
    n = len(prices)
    result: list[float | None] = [None] * n
    if n < window:
        return result

    window_sum = sum(prices[:window])
    result[window - 1] = round(window_sum / window, 4)

    for i in range(window, n):
        window_sum += prices[i] - prices[i - window]
        result[i] = round(window_sum / window, 4)

    return result


def calculate_ema(prices: list[float], window: int) -> list[float | None]:
    """Calculate Exponential Moving Average (EMA) using standard multiplier 2 / (window + 1).

    The first EMA value (at index window - 1) is initialized as the SMA of the first
    `window` prices. Entries before index `window - 1` return `None`.
    """
    if window <= 0:
        raise ValueError("Window must be positive")
    n = len(prices)
    result: list[float | None] = [None] * n
    if n < window:
        return result

    multiplier = 2.0 / (window + 1.0)
    sma_seed = sum(prices[:window]) / window
    result[window - 1] = round(sma_seed, 4)
    current_ema = sma_seed

    for i in range(window, n):
        current_ema = (prices[i] * multiplier) + (current_ema * (1.0 - multiplier))
        result[i] = round(current_ema, 4)

    return result


def calculate_rsi(prices: list[float], window: int = 14) -> list[float | None]:
    """Calculate Relative Strength Index (RSI) using Wilder's smoothing technique.

    - Overbought threshold: >= 70
    - Oversold threshold: <= 30
    Entries before index `window` return `None`.
    """
    if window <= 0:
        raise ValueError("Window must be positive")
    n = len(prices)
    result: list[float | None] = [None] * n
    if n <= window:
        return result

    # Calculate price changes
    changes = [prices[i] - prices[i - 1] for i in range(1, n)]

    # Initial average gain and loss over first `window` changes
    gains = [max(c, 0.0) for c in changes[:window]]
    losses = [max(-c, 0.0) for c in changes[:window]]

    avg_gain = sum(gains) / window
    avg_loss = sum(losses) / window

    if avg_loss == 0.0:
        result[window] = 100.0 if avg_gain > 0.0 else 50.0
    else:
        rs = avg_gain / avg_loss
        result[window] = round(100.0 - (100.0 / (1.0 + rs)), 2)

    # Wilder's smoothing for subsequent periods
    for i in range(window + 1, n):
        c = changes[i - 1]
        gain = max(c, 0.0)
        loss = max(-c, 0.0)

        avg_gain = ((avg_gain * (window - 1)) + gain) / window
        avg_loss = ((avg_loss * (window - 1)) + loss) / window

        if avg_loss == 0.0:
            rsi = 100.0 if avg_gain > 0.0 else 50.0
        else:
            rs = avg_gain / avg_loss
            rsi = 100.0 - (100.0 / (1.0 + rs))

        result[i] = round(max(0.0, min(100.0, rsi)), 2)

    return result


def calculate_macd(
    prices: list[float],
    fast_window: int = 12,
    slow_window: int = 26,
    signal_window: int = 9,
) -> list[dict[str, float | None]]:
    """Calculate Moving Average Convergence Divergence (MACD).

    - MACD Line = EMA(fast) - EMA(slow)
    - Signal Line = EMA(signal_window) of MACD Line
    - Histogram = MACD Line - Signal Line

    Returns a list of dicts: {"macd": ..., "signal": ..., "histogram": ...}
    """
    n = len(prices)
    result: list[dict[str, float | None]] = [
        {"macd": None, "signal": None, "histogram": None} for _ in range(n)
    ]
    if n < slow_window:
        return result

    fast_ema = calculate_ema(prices, fast_window)
    slow_ema = calculate_ema(prices, slow_window)

    macd_line: list[float | None] = [None] * n
    for i in range(n):
        if fast_ema[i] is not None and slow_ema[i] is not None:
            macd_line[i] = round(fast_ema[i] - slow_ema[i], 4)

    # Valid macd values starting from slow_window - 1
    valid_macd_indices = [i for i, val in enumerate(macd_line) if val is not None]
    if len(valid_macd_indices) < signal_window:
        for i in valid_macd_indices:
            result[i]["macd"] = macd_line[i]
        return result

    valid_macd_vals = [macd_line[i] for i in valid_macd_indices]  # type: ignore
    signal_ema_sub = calculate_ema(valid_macd_vals, signal_window)

    for idx_in_sub, orig_idx in enumerate(valid_macd_indices):
        m_val = macd_line[orig_idx]
        s_val = signal_ema_sub[idx_in_sub]
        h_val = round(m_val - s_val, 4) if (m_val is not None and s_val is not None) else None

        result[orig_idx] = {
            "macd": m_val,
            "signal": s_val,
            "histogram": h_val,
        }

    return result


def calculate_bollinger_bands(
    prices: list[float],
    window: int = 20,
    num_std: float = 2.0,
) -> list[dict[str, float | None]]:
    """Calculate Bollinger Bands (Upper, Middle, Lower, Bandwidth %, %B).

    - Middle Band = SMA(window)
    - Upper Band = Middle + (num_std * std_dev)
    - Lower Band = Middle - (num_std * std_dev)
    - Bandwidth = ((Upper - Lower) / Middle) * 100
    - %B = (Price - Lower) / (Upper - Lower)
    """
    n = len(prices)
    result: list[dict[str, float | None]] = [
        {
            "upper": None,
            "middle": None,
            "lower": None,
            "bandwidth": None,
            "percent_b": None,
        }
        for _ in range(n)
    ]
    if n < window:
        return result

    sma_values = calculate_sma(prices, window)

    for i in range(window - 1, n):
        slice_vals = prices[i - window + 1 : i + 1]
        mid = sma_values[i]
        if mid is None:
            continue

        variance = sum((p - mid) ** 2 for p in slice_vals) / window
        std_dev = math.sqrt(variance)

        upper = round(mid + (num_std * std_dev), 4)
        lower = round(mid - (num_std * std_dev), 4)
        bandwidth = round(((upper - lower) / mid) * 100.0, 2) if mid != 0 else None

        band_spread = upper - lower
        p_val = prices[i]
        percent_b = round((p_val - lower) / band_spread, 4) if band_spread != 0 else None

        result[i] = {
            "upper": upper,
            "middle": mid,
            "lower": lower,
            "bandwidth": bandwidth,
            "percent_b": percent_b,
        }

    return result


def calculate_historical_returns(
    prices: list[float],
    dates: list[date],
) -> dict[str, float | None]:
    """Calculate historical percentage price returns across standardized trading horizons.

    Standard trading day estimates:
    - 1D: 1 bar back
    - 1W: 5 bars back
    - 1M: 21 bars back
    - 3M: 63 bars back
    - 6M: 126 bars back
    - 1Y: 252 bars back
    - 3Y CAGR: 756 bars back (or 3 calendar years)
    - 5Y CAGR: 1260 bars back (or 5 calendar years)
    """
    n = len(prices)
    out: dict[str, float | None] = {
        "return_1d": None,
        "return_1w": None,
        "return_1m": None,
        "return_3m": None,
        "return_6m": None,
        "return_1y": None,
        "cagr_3y": None,
        "cagr_5y": None,
    }
    if n < 2:
        return out

    latest = prices[-1]

    def _calc_return(bars_back: int) -> float | None:
        if n > bars_back:
            prior = prices[-1 - bars_back]
            if prior > 0:
                return round(((latest - prior) / prior) * 100.0, 2)
        return None

    def _calc_cagr(bars_back: int, years: float) -> float | None:
        if n > bars_back:
            prior = prices[-1 - bars_back]
            if prior > 0 and latest > 0:
                cagr = ((latest / prior) ** (1.0 / years)) - 1.0
                return round(cagr * 100.0, 2)
        return None

    out["return_1d"] = _calc_return(1)
    out["return_1w"] = _calc_return(5)
    out["return_1m"] = _calc_return(21)
    out["return_3m"] = _calc_return(63)
    out["return_6m"] = _calc_return(126)
    out["return_1y"] = _calc_return(252)
    out["cagr_3y"] = _calc_cagr(756, 3.0)
    out["cagr_5y"] = _calc_cagr(1260, 5.0)

    return out


def calculate_max_drawdown(
    prices: list[float],
    dates: list[date],
) -> dict[str, float | str | None]:
    """Calculate Maximum Drawdown (MDD) and Drawdown from 52-week High.

    Returns:
    - max_drawdown_pct: largest peak-to-trough decline (negative percentage)
    - peak_date: date of the peak before maximum drop
    - trough_date: date of the trough of the maximum drop
    - high_52w: highest price over last 252 bars
    - low_52w: lowest price over last 252 bars
    - current_drawdown_from_52w_high_pct: decline from 52w high to latest close
    """
    if not prices:
        return {
            "max_drawdown_pct": None,
            "peak_date": None,
            "trough_date": None,
            "high_52w": None,
            "low_52w": None,
            "current_drawdown_from_52w_high_pct": None,
        }

    peak = prices[0]
    peak_idx = 0
    max_dd = 0.0
    best_peak_idx = 0
    best_trough_idx = 0

    for i, p in enumerate(prices):
        if p > peak:
            peak = p
            peak_idx = i
        else:
            if peak > 0:
                dd = (p - peak) / peak * 100.0
                if dd < max_dd:
                    max_dd = dd
                    best_peak_idx = peak_idx
                    best_trough_idx = i

    # 52-week statistics (up to 252 bars)
    lookback_52w = prices[-252:] if len(prices) >= 252 else prices
    high_52w = max(lookback_52w)
    low_52w = min(lookback_52w)

    latest = prices[-1]
    curr_dd = round(((latest - high_52w) / high_52w) * 100.0, 2) if high_52w > 0 else 0.0

    peak_date_str = str(dates[best_peak_idx]) if dates and best_peak_idx < len(dates) else None
    trough_date_str = str(dates[best_trough_idx]) if dates and best_trough_idx < len(dates) else None

    return {
        "max_drawdown_pct": round(max_dd, 2),
        "peak_date": peak_date_str,
        "trough_date": trough_date_str,
        "high_52w": round(high_52w, 2),
        "low_52w": round(low_52w, 2),
        "current_drawdown_from_52w_high_pct": curr_dd,
    }


def calculate_pivot_points(high: float, low: float, close: float) -> dict[str, float]:
    """Calculate classical floor trader Pivot Points (PP, R1, S1, R2, S2, R3, S3).

    - PP = (High + Low + Close) / 3
    - R1 = (2 * PP) - Low
    - S1 = (2 * PP) - High
    - R2 = PP + (High - Low)
    - S2 = PP - (High - Low)
    - R3 = High + 2 * (PP - Low)
    - S3 = Low - 2 * (High - PP)
    """
    pp = (high + low + close) / 3.0
    r1 = (2.0 * pp) - low
    s1 = (2.0 * pp) - high
    r2 = pp + (high - low)
    s2 = pp - (high - low)
    r3 = high + (2.0 * (pp - low))
    s3 = low - (2.0 * (high - pp))

    return {
        "pivot": round(pp, 2),
        "r1": round(r1, 2),
        "s1": round(s1, 2),
        "r2": round(r2, 2),
        "s2": round(s2, 2),
        "r3": round(r3, 2),
        "s3": round(s3, 2),
    }


def evaluate_trend_signal(
    current_price: float,
    sma_50: float | None,
    sma_200: float | None,
) -> tuple[str, str]:
    """Evaluate technical trend based on Moving Average crossovers and price position.

    Returns: (signal, explanation)
    - 'BULLISH': Golden Cross (50 DMA > 200 DMA) or Price trading above both MAs.
    - 'BEARISH': Death Cross (50 DMA < 200 DMA) or Price trading below both MAs.
    - 'NEUTRAL': Mixed moving average alignment.
    """
    if sma_50 is None or sma_200 is None:
        if sma_50 is not None:
            if current_price > sma_50:
                return "BULLISH", "Price is trading above the 50 DMA."
            return "BEARISH", "Price is trading below the 50 DMA."
        return "NEUTRAL", "Insufficient price history for 50/200 DMA analysis."

    golden_cross = sma_50 > sma_200
    above_both = current_price > sma_50 and current_price > sma_200
    below_both = current_price < sma_50 and current_price < sma_200

    if golden_cross and above_both:
        return "BULLISH", "Golden Cross active (50 DMA > 200 DMA) and price above both moving averages."
    elif golden_cross and not below_both:
        return "BULLISH", "50 DMA is above 200 DMA (bullish structure)."
    elif not golden_cross and below_both:
        return "BEARISH", "Death Cross active (50 DMA < 200 DMA) and price below both moving averages."
    elif not golden_cross and not above_both:
        return "BEARISH", "50 DMA is below 200 DMA (bearish structure)."
    else:
        return "NEUTRAL", "Mixed moving average signals; price consolidating between key levels."
