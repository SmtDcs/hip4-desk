/**
 * Quoting Engine Module
 * Generates two-sided quotes (Bid/Ask) from Fair Value, spread, and inventory skew.
 */

import {
  ParsedPriceBinary,
  QuotingParams,
  InventoryState,
  GeneratedQuote,
  FairValueResult,
} from '../types.js';
import { BlackScholesBinary } from '../model/black-scholes.js';
import { RiskManager } from './risk-limits.js';

export class QuotingEngine {
  private params: QuotingParams;

  constructor(params: QuotingParams) {
    this.params = params;
  }

  /**
   * Generates a two-sided quote for a given market
   */
  generateQuote(
    market: ParsedPriceBinary,
    spotPrice: number,
    annualizedVol: number,
    inventory?: InventoryState
  ): GeneratedQuote {
    const timestamp = Date.now();

    // 1. Risk checks
    const riskCheck = RiskManager.evaluateRisk(
      market,
      inventory,
      this.params,
      spotPrice
    );

    // 2. Compute Black-Scholes Fair Value
    const fairValue: FairValueResult = BlackScholesBinary.calculateFairValue(
      spotPrice,
      market.strikePrice,
      market.timeToExpirySeconds,
      annualizedVol
    );

    // If risk gate is tripped, return pulled quote
    if (!riskCheck.isSafe) {
      return {
        outcomeId: market.outcomeId,
        underlyingPerp: market.underlyingPerp,
        fairValueYes: fairValue.fairPriceYes,
        fairValueNo: fairValue.fairPriceNo,
        yesBidPx: 0,
        yesBidSz: 0,
        yesAskPx: 0,
        yesAskSz: 0,
        effectiveSpread: 0,
        inventorySkew: 0,
        status: riskCheck.status,
        reason: riskCheck.reason,
        timestamp,
      };
    }

    // 3. Determine dynamic spread
    const effectiveSpread = Math.max(
      0.002,
      this.params.baseSpread * riskCheck.recommendedSpreadMultiplier
    );
    const halfSpread = effectiveSpread / 2.0;

    // 4. Inventory Skew calculation
    // Skew formula: 0.0001 per unit of net inventory (configurable)
    const skewFactor = this.params.skewFactor ?? 0.0001;
    const netPos = inventory?.netYesPosition ?? 0;
    const inventorySkew = netPos * skewFactor;

    // 5. Compute raw Bid and Ask
    let rawBid = fairValue.fairPriceYes - halfSpread - inventorySkew;
    let rawAsk = fairValue.fairPriceYes + halfSpread - inventorySkew;

    // Guard: Ensure ask > bid
    if (rawAsk <= rawBid) {
      rawAsk = rawBid + 0.002;
    }

    // HIP-4 Price boundaries clamp [0.001, 0.999]
    const bidPx = Math.max(0.001, Math.min(0.997, Number(rawBid.toFixed(4))));
    const askPx = Math.max(0.003, Math.min(0.999, Number(rawAsk.toFixed(4))));

    // 6. Sizing: ensure min 10 USDH notional (HIP-4 rule)
    const targetNotional = Math.max(10.0, this.params.orderSizeNotional);

    // Contract size = notional / price (rounded to integer as per testnet requirement)
    const bidSizeContracts = Math.max(1, Math.ceil(targetNotional / Math.max(0.01, bidPx)));
    const askSizeContracts = Math.max(1, Math.ceil(targetNotional / Math.max(0.01, askPx)));

    return {
      outcomeId: market.outcomeId,
      underlyingPerp: market.underlyingPerp,
      fairValueYes: fairValue.fairPriceYes,
      fairValueNo: fairValue.fairPriceNo,
      yesBidPx: bidPx,
      yesBidSz: bidSizeContracts,
      yesAskPx: askPx,
      yesAskSz: askSizeContracts,
      effectiveSpread: Number((askPx - bidPx).toFixed(4)),
      inventorySkew: Number(inventorySkew.toFixed(4)),
      status: 'active',
      timestamp,
    };
  }
}
