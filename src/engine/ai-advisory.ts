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
        `🚨 Vadeye yalnızca ${minutesToExpiry} dakika kaldı! Binary kontratlarda vade yaklaşırken gamma ve pin riski aşırı yükselir. ` +
        `Adverse selection ve stale quote kaybını önlemek için geri çekilme eşiği 60 dakikaya çıkarılmalı, spread 2x genişletilmeli ve emir büyüklüğü %50 azaltılmalıdır.`
      );
    } else if (hoursToExpiry < 3 && !market.isExpired) {
      rulesTriggered.push('EXPIRY_GAMMA_ELEVATED');
      urgency = 'high';
      suggested.baseSpread = Number((suggested.baseSpread * 1.4).toFixed(4));
      suggested.orderSizeNotional = Math.max(10, Math.round(suggested.orderSizeNotional * 0.75));
      explanations.push(
        `⚠️ Vadeye son ${hoursToExpiry.toFixed(1)} saat. Son düzlükte olası sert fiyat sıçramalarına karşı baz spread %40 artırılmalı ` +
        `ve emir büyüklüğü ${suggested.orderSizeNotional} USDC seviyesine çekilmelidir.`
      );
    }

    // Rule 2: Volatility Regime Rule
    if (annualizedVol > 0.75) {
      rulesTriggered.push('VOLATILITY_ELEVATED');
      if (urgency === 'low') urgency = 'medium';
      const volSpreadAdjustment = Number((0.02 * (annualizedVol / 0.75)).toFixed(4));
      suggested.baseSpread = Number((suggested.baseSpread + volSpreadAdjustment).toFixed(4));
      explanations.push(
        `📈 Dayanak varlık (${market.underlyingPerp}) realize volatilitesi yüksek seviyede: σ = ${(annualizedVol * 100).toFixed(1)}%. ` +
        `Hızlı piyasa hareketlerinde arbitrager'lar tarafından süpürülmemek için spread +${volSpreadAdjustment} genişletilmelidir.`
      );
    } else if (annualizedVol < 0.35) {
      rulesTriggered.push('VOLATILITY_SUBDUED');
      suggested.baseSpread = Math.max(0.015, Number((suggested.baseSpread * 0.85).toFixed(4)));
      explanations.push(
        `📉 Dayanak varlık realize volatilitesi sakin: σ = ${(annualizedVol * 100).toFixed(1)}%. ` +
        `Risk düşük olduğundan piyasadan daha fazla işlem akışı (flow) çekmek amacıyla spread %15 daraltılabilir.`
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
        `🏜️ Defter durumu: ${bookInfo.isEmpty ? 'TAMAMEN BOŞ' : `Aşırı geniş spread (${(bookInfo.spread || 0).toFixed(4)})`}. ` +
        `Deployer marketinde rakip likidite bulunmuyor. HIP-4 Desk'in ${suggested.baseSpread} spread ve $${suggested.orderSizeNotional} büyüklük ile ` +
        `organik alıcı/satıcıları çekecek iki taraflı derinlik sağlaması önerilir.`
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
          `⚖️ Envanter dengesizliği yüksek (Net YES: ${netPos} / Tavan: ${currentParams.maxInventory}, doluluk: %${(capRatio * 100).toFixed(0)}). ` +
          `Risk tavanına çarpmamak için skew katsayısı ${suggested.skewFactor} değerine yükseltilmeli ve tek yönlü pozisyon birikimi yavaşlatılmalıdır.`
        );
      }
    }

    // If no specific risk rules triggered, return healthy status
    if (rulesTriggered.length === 0) {
      rulesTriggered.push('NORMAL_MARKET_CONDITIONS');
      explanations.push(
        `✅ Piyasa ve volatilite koşulları standart aralıkta (σ = ${(annualizedVol * 100).toFixed(1)}%, Vadeye ${hoursToExpiry.toFixed(1)} sa). ` +
        `Mevcut parametreler (${currentParams.baseSpread} spread, $${currentParams.orderSizeNotional} büyüklük) optimal risk/getiri dengesini koruyor.`
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
