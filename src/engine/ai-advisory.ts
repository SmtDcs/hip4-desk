/**
 * AI Parameter Advisory Module for HIP-4 Desk
 * 
 * Generates rule-based heuristic parameter recommendations with natural-language
 * explanations. Strictly ADVISORY only — NEVER possesses order execution authority.
 * 
 * Workflow:
 * 1. AI analyzes market volatility, expiry time, existing order book state, and inventory.
 * 2. Produces an AiRecommendation containing suggested params + natural language reasoning.
 * 3. Deployer reviews the recommendation in the dashboard.
 * 4. Parameters are updated ONLY upon explicit Deployer approval.
 */

import {
  ParsedPriceBinary,
  QuotingParams,
  InventoryState,
  AiRecommendation,
  AiUrgency,
  L2BookResponse,
} from '../types.js';

export interface BookSnapshotInfo {
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  isEmpty: boolean;
}

export class AiParamAdvisor {
  /**
   * Helper to inspect an L2Book response into summary numbers
   */
  static extractBookInfo(book?: L2BookResponse | null): BookSnapshotInfo {
    if (!book || !book.levels) {
      return { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
    }

    const bids = book.levels[0] || [];
    const asks = book.levels[1] || [];

    const bestBid = bids.length > 0 ? parseFloat(bids[0].px) : null;
    const bestAsk = asks.length > 0 ? parseFloat(asks[0].px) : null;

    const isEmpty = bids.length === 0 && asks.length === 0;
    const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;

    return { bestBid, bestAsk, spread, isEmpty };
  }

  /**
   * Evaluates market metrics deterministically and generates parameter recommendations.
   * STRICT SAFETY: This method has NO order placement authority.
   */
  static generateRecommendation(
    market: ParsedPriceBinary,
    spotPrice: number,
    annualizedVol: number,
    bookInfo: BookSnapshotInfo,
    inventory: InventoryState | undefined,
    currentParams: QuotingParams
  ): AiRecommendation {
    const rulesTriggered: string[] = [];
    const explanations: string[] = [];
    let urgency: AiUrgency = 'low';
    let confidence = 0.85;

    // Clone current params as base for suggestions
    const suggested: QuotingParams = { ...currentParams };

    const hoursToExpiry = market.timeToExpirySeconds / 3600;
    const minutesToExpiry = Math.round(market.timeToExpirySeconds / 60);

    // Rule 1: Expiry Nearness / Gamma Pin-Risk Rule
    if (minutesToExpiry <= 45 && !market.isExpired) {
      rulesTriggered.push('EXPIRY_GAMMA_CRITICAL');
      urgency = 'critical';
      confidence = 0.95;
      suggested.expiryPullbackMinutes = Math.max(suggested.expiryPullbackMinutes, 60);
      suggested.baseSpread = Number((suggested.baseSpread * 2.0).toFixed(4));
      suggested.orderSizeNotional = Math.max(10, Math.round(suggested.orderSizeNotional * 0.5));
      explanations.push(
        `${minutesToExpiry} minutes to expiry. Gamma and pin risk climb sharply into settlement of a binary, so a resting quote ` +
        `is more likely to be picked off. Move the pullback threshold to 60 minutes, double the spread, and halve order size to ` +
        `cut adverse selection on stale quotes.`
      );
    } else if (hoursToExpiry < 3 && !market.isExpired) {
      rulesTriggered.push('EXPIRY_GAMMA_ELEVATED');
      urgency = 'high';
      suggested.baseSpread = Number((suggested.baseSpread * 1.4).toFixed(4));
      suggested.orderSizeNotional = Math.max(10, Math.round(suggested.orderSizeNotional * 0.75));
      explanations.push(
        `${hoursToExpiry.toFixed(1)} hours to expiry. The last stretch of a binary carries outsized jumps, so widen the base ` +
        `spread by 40% and trim order size to $${suggested.orderSizeNotional}.`
      );
    }

    // Rule 2: Volatility Regime Rule
    if (annualizedVol > 0.75) {
      rulesTriggered.push('VOLATILITY_ELEVATED');
      if (urgency === 'low') urgency = 'medium';
      const volSpreadAdjustment = Number((0.02 * (annualizedVol / 0.75)).toFixed(4));
      suggested.baseSpread = Number((suggested.baseSpread + volSpreadAdjustment).toFixed(4));
      explanations.push(
        `Realized vol on ${market.underlyingPerp} is running high at sigma = ${(annualizedVol * 100).toFixed(1)}%. Widen the ` +
        `spread by +${volSpreadAdjustment} so fast moves do not get swept by arbitrage.`
      );
    } else if (annualizedVol < 0.35) {
      rulesTriggered.push('VOLATILITY_SUBDUED');
      suggested.baseSpread = Math.max(0.015, Number((suggested.baseSpread * 0.85).toFixed(4)));
      explanations.push(
        `Realized vol on ${market.underlyingPerp} is subdued at sigma = ${(annualizedVol * 100).toFixed(1)}%. With less risk on ` +
        `the book, tighten the spread by 15% to pull in more flow.`
      );
    }

    // Rule 3: Existing Orderbook State (Desert vs Competitive)
    if (bookInfo.isEmpty || (bookInfo.spread !== null && bookInfo.spread > 0.30)) {
      rulesTriggered.push('DESERT_MARKET_OPPORTUNITY');
      if (urgency === 'low') urgency = 'medium';
      confidence = Math.max(confidence, 0.90);
      // In empty book, provide attractive liquidity with optimal half-spread
      suggested.orderSizeNotional = Math.max(suggested.orderSizeNotional, 20);
      explanations.push(
        `Book state: ${bookInfo.isEmpty ? 'Deserted — nothing resting' : `spread is unusably wide at ${(bookInfo.spread || 0).toFixed(4)}`}. ` +
        `No competing liquidity on this deployer's market, so posting ${suggested.baseSpread} at $${suggested.orderSizeNotional} ` +
        `gives takers a reason to cross and bootstraps two-sided depth.`
      );
    }

    // Rule 4: Inventory Imbalance & Rebalance Skew
    if (inventory) {
      const netPos = inventory.netYesPosition;
      const capRatio = Math.abs(netPos) / currentParams.maxInventory;

      if (capRatio >= 0.65) {
        rulesTriggered.push('INVENTORY_IMBALANCE_ALERT');
        if (urgency !== 'critical') urgency = 'high';
        suggested.skewFactor = Math.max(0.0003, (suggested.skewFactor ?? 0.0001) * 2);
        suggested.orderSizeNotional = Math.max(10, Math.round(suggested.orderSizeNotional * 0.7));
        explanations.push(
          `Inventory is lopsided at net YES ${netPos} against a cap of ${currentParams.maxInventory} (${(capRatio * 100).toFixed(0)}% used). ` +
          `Raise the skew factor to ${suggested.skewFactor} and cut order size to slow one-way accumulation before the cap pulls the quote.`
        );
      }
    }

    // If no specific risk rules triggered, return healthy status
    if (rulesTriggered.length === 0) {
      rulesTriggered.push('NORMAL_MARKET_CONDITIONS');
      explanations.push(
        `Nothing unusual: sigma = ${(annualizedVol * 100).toFixed(1)}% with ${hoursToExpiry.toFixed(1)}h to expiry. Current ` +
        `settings (${currentParams.baseSpread} spread, $${currentParams.orderSizeNotional} size) already sit at a reasonable ` +
        `risk-to-flow balance, so hold.`
      );
    }

    const fullExplanation = explanations.join('\n\n');

    return {
      marketId: market.outcomeId,
      marketName: market.rawName || `Outcome #${market.outcomeId}`,
      underlyingPerp: market.underlyingPerp,
      currentParams,
      suggestedParams: suggested,
      rulesTriggered,
      urgency,
      confidence: Number(confidence.toFixed(2)),
      explanation: fullExplanation,
      timestamp: Date.now(),
    };
  }

  /**
   * Applies approved recommendation to active parameters.
   * Can ONLY be invoked when the Deployer explicitly confirms via UI or API.
   */
  static applyApprovedRecommendation(
    recommendation: AiRecommendation,
    targetParams: QuotingParams
  ): QuotingParams {
    return {
      ...targetParams,
      baseSpread: recommendation.suggestedParams.baseSpread,
      orderSizeNotional: recommendation.suggestedParams.orderSizeNotional,
      maxInventory: recommendation.suggestedParams.maxInventory,
      expiryPullbackMinutes: recommendation.suggestedParams.expiryPullbackMinutes,
      skewFactor: recommendation.suggestedParams.skewFactor ?? targetParams.skewFactor,
    };
  }
}
