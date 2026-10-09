/**
 * Black-Scholes Binary Option Pricing Model
 * Evaluates fair probability P(S_T > K) ≈ N(d2) for HIP-4 priceBinary markets.
 *
 * References:
 * - Black-Scholes-Merton Binary Call: Payoff = 1 if S_T > K, else 0.
 * - Risk-neutral probability: P(S_T > K) = e^(-r*T) * N(d2)
 * - Hyperliquid outcome boundaries: prices clamped to [0.001, 0.999]
 */

import { FairValueResult } from '../types.js';

export class BlackScholesBinary {
  /**
   * High-precision Cumulative Normal Distribution Function N(x)
   * Using Abramowitz and Stegun 7.1.26 approximation (|error| < 1.5e-7).
   */
  static normalCDF(x: number): number {
    if (isNaN(x)) return 0.5;
    if (x > 8.0) return 1.0;
    if (x < -8.0) return 0.0;

    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c = 0.3989422804014327; // 1 / sqrt(2 * PI)

    const absX = Math.abs(x);
    const t = 1.0 / (1.0 + p * absX);
    const poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
    const cdf = 1.0 - c * Math.exp(-0.5 * absX * absX) * poly;

    return x >= 0 ? cdf : 1.0 - cdf;
  }

  /**
   * Standard Normal Probability Density Function phi(x)
   */
  static normalPDF(x: number): number {
    return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  }

  /**
   * Computes d1 and d2 for Black-Scholes
   * d1 = [ln(S / K) + (r + 0.5 * sigma^2) * T] / (sigma * sqrt(T))
   * d2 = d1 - sigma * sqrt(T)
   */
  static calculateD1D2(
    spot: number,
    strike: number,
    timeYears: number,
    volatility: number,
    riskFreeRate: number = 0
  ): { d1: number; d2: number } {
    if (spot <= 0 || strike <= 0) {
      throw new Error(`Invalid spot (${spot}) or strike (${strike}): must be positive.`);
    }

    const safeVol = Math.max(0.01, volatility);
    const safeT = Math.max(1e-7, timeYears); // Avoid zero division

    const numerator = Math.log(spot / strike) + (riskFreeRate + 0.5 * safeVol * safeVol) * safeT;
    const denominator = safeVol * Math.sqrt(safeT);

    const d1 = numerator / denominator;
    const d2 = d1 - safeVol * Math.sqrt(safeT);

    return { d1, d2 };
  }

  /**
   * Calculates fair probability P(S_T > K) for a binary call (YES token).
   *
   * @param spot Current spot/perp mark price (S)
   * @param strike Threshold/strike price (K)
   * @param timeToExpirySeconds Seconds remaining until expiry
   * @param annualizedVol Annualized volatility (sigma, e.g. 0.60 for 60%)
   * @param riskFreeRate Annualized risk-free rate (r, default 0)
   */
  static calculateFairValue(
    spot: number,
    strike: number,
    timeToExpirySeconds: number,
    annualizedVol: number,
    riskFreeRate: number = 0
  ): FairValueResult {
    const SECONDS_PER_YEAR = 365.25 * 86400;
    const timeYears = Math.max(0, timeToExpirySeconds) / SECONDS_PER_YEAR;
    const isExpired = timeToExpirySeconds <= 0;

    // Edge case: Expired
    if (isExpired) {
      let pYes = 0.5;
      if (spot > strike) pYes = 0.999;
      else if (spot < strike) pYes = 0.001;

      return {
        fairPriceYes: pYes,
        fairPriceNo: 1.0 - pYes,
        d1: spot >= strike ? 999 : -999,
        d2: spot >= strike ? 999 : -999,
        spotPrice: spot,
        strikePrice: strike,
        timeToExpiryYears: 0,
        annualizedVol,
        isExpired: true,
      };
    }

    const { d1, d2 } = this.calculateD1D2(spot, strike, timeYears, annualizedVol, riskFreeRate);

    // Risk-neutral probability: discount factor e^(-r*T) * N(d2)
    const discount = Math.exp(-riskFreeRate * timeYears);
    const rawPYes = discount * this.normalCDF(d2);

    // HIP-4 clamp to valid price bounds [0.001, 0.999]
    const clampedPYes = Math.max(0.001, Math.min(0.999, rawPYes));
    const clampedPNo = Math.max(0.001, Math.min(0.999, 1.0 - clampedPYes));

    return {
      fairPriceYes: Number(clampedPYes.toFixed(4)),
      fairPriceNo: Number(clampedPNo.toFixed(4)),
      d1,
      d2,
      spotPrice: spot,
      strikePrice: strike,
      timeToExpiryYears: timeYears,
      annualizedVol,
      isExpired: false,
    };
  }
}
