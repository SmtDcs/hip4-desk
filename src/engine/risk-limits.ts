/**
 * Risk Limits and Safeguards for HIP-4 Market Making
 * Implements inventory bounds, gamma pullback near expiry, and notional limits.
 */

import { ParsedPriceBinary, QuotingParams, InventoryState, QuoteStatus } from '../types.js';

export interface RiskCheckResult {
  isSafe: boolean;
  status: QuoteStatus;
  reason?: string;
  recommendedSpreadMultiplier: number;
}

export class RiskManager {
  /**
   * Evaluates if a market should be quoted given time-to-expiry and inventory constraints
   */
  static evaluateRisk(
    market: ParsedPriceBinary,
    inventory: InventoryState | undefined,
    params: QuotingParams,
    spotPrice: number
  ): RiskCheckResult {
    // 1. Expiry Check (Gamma Risk Mitigation)
    const pullbackSeconds = params.expiryPullbackMinutes * 60;
    if (market.isExpired) {
      return {
        isSafe: false,
        status: 'pulled_expiry',
        reason: `Market has expired (ended at ${market.expiryDate.toISOString()})`,
        recommendedSpreadMultiplier: 1.0,
      };
    }

    if (market.timeToExpirySeconds < pullbackSeconds) {
      const minutesLeft = Math.round(market.timeToExpirySeconds / 60);
      return {
        isSafe: false,
        status: 'pulled_expiry',
        reason: `Inside gamma pullback window (${minutesLeft} mins < ${params.expiryPullbackMinutes} mins threshold)`,
        recommendedSpreadMultiplier: 1.0,
      };
    }

    // 2. Inventory Limit Check
    if (inventory) {
      const absNet = Math.abs(inventory.netYesPosition);
      if (absNet >= params.maxInventory) {
        return {
          isSafe: false,
          status: 'pulled_inventory',
          reason: `Inventory cap breached: Net position ${inventory.netYesPosition} >= max ${params.maxInventory}`,
          recommendedSpreadMultiplier: 1.0,
        };
      }
    }

    // 3. Volatility / Pin Risk Adjustment:
    // If spot is within 1% of strike and expiry is within 2 hours, widen spread
    const distToStrike = Math.abs(spotPrice - market.strikePrice) / market.strikePrice;
    let spreadMultiplier = 1.0;
    if (distToStrike < 0.01 && market.timeToExpirySeconds < 7200) {
      spreadMultiplier = 1.75; // 75% wider spread near pin-risk zone
    } else if (distToStrike < 0.02 && market.timeToExpirySeconds < 14400) {
      spreadMultiplier = 1.35;
    }

    return {
      isSafe: true,
      status: 'active',
      recommendedSpreadMultiplier: spreadMultiplier,
    };
  }

  /**
   * Validates minimum notional constraint (HIP-4 requires at least 10 USDC/USDH)
   */
  static validateMinNotional(price: number, size: number): boolean {
    const notional = price * size;
    return notional >= 10.0;
  }
}
