/**
 * Realized Volatility Estimator
 * Computes annualized historical volatility from OHLC candle log-returns,
 * with sensible per-asset fallbacks.
 */

import { HyperliquidClient } from './hl-client.js';

export class VolatilityEstimator {
  private static readonly DEFAULT_FALLBACKS: Record<string, number> = {
    BTC: 0.55,
    ETH: 0.65,
    SOL: 0.75,
    HYPE: 0.85,
    DEFAULT: 0.60,
  };

  /**
   * Returns fallback annualized volatility for an asset
   */
  static getFallbackVolatility(coin: string): number {
    const symbol = coin.toUpperCase().trim();
    return this.DEFAULT_FALLBACKS[symbol] ?? this.DEFAULT_FALLBACKS.DEFAULT;
  }

  /**
   * Estimates annualized realized volatility from candles
   * @param client HyperliquidClient instance
   * @param coin Coin symbol (e.g. "BTC")
   * @param hoursLookback Number of hours to look back (default 48h)
   */
  static async estimateRealizedVol(
    client: HyperliquidClient,
    coin: string,
    hoursLookback: number = 48
  ): Promise<number> {
    const fallback = this.getFallbackVolatility(coin);

    try {
      const now = Date.now();
      const startTime = now - hoursLookback * 3600 * 1000;
      const candles = await client.getCandles(coin, '1h', startTime, now);

      if (!candles || candles.length < 5) {
        return fallback;
      }

      // Calculate log returns
      const logReturns: number[] = [];
      for (let i = 1; i < candles.length; i++) {
        const prevClose = parseFloat(candles[i - 1].c);
        const currClose = parseFloat(candles[i].c);
        if (prevClose > 0 && currClose > 0) {
          logReturns.push(Math.log(currClose / prevClose));
        }
      }

      if (logReturns.length < 4) {
        return fallback;
      }

      // Mean log return
      const mean = logReturns.reduce((acc, r) => acc + r, 0) / logReturns.length;

      // Sample variance
      const variance =
        logReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
        (logReturns.length - 1);

      // Hourly standard deviation
      const hourlyVol = Math.sqrt(variance);

      // Annualize: 365 * 24 = 8760 hours in a year
      const annualized = hourlyVol * Math.sqrt(8760);

      // Sanity clamp: vol between 15% and 300%
      if (isNaN(annualized) || annualized < 0.15) {
        return Math.max(0.15, fallback);
      }
      if (annualized > 3.0) {
        return Math.min(3.0, fallback);
      }

      return annualized;
    } catch {
      // Graceful fallback to default asset vol
      return fallback;
    }
  }
}
