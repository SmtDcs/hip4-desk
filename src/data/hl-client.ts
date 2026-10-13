/**
 * Hyperliquid Native API Client
 * Direct REST info interface for HIP-4 outcome markets and HyperCore perps.
 * Zero dependency on Outcome.xyz BUSL SDK.
 */

import {
  OutcomeMetaResponse,
  L2BookResponse,
  MetaAndAssetCtxsResponse,
} from '../types.js';

export interface HyperliquidClientOptions {
  apiUrl: string;
  timeoutMs?: number;
}

export class HyperliquidClient {
  private apiUrl: string;
  private timeoutMs: number;

  constructor(options: HyperliquidClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Helper to make POST requests to Hyperliquid /info endpoint
   */
  async requestInfo<T>(body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          `Hyperliquid API request failed with status ${response.status} ${response.statusText}: ${errText}`
        );
      }

      const data = (await response.json()) as T;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetches all registered HIP-4 outcome markets metadata
   */
  async getOutcomeMeta(): Promise<OutcomeMetaResponse> {
    return this.requestInfo<OutcomeMetaResponse>({ type: 'outcomeMeta' });
  }

  /**
   * Computes HIP-4 standard asset encoding:
   * encoding = 10 * outcomeId + side
   * Symbol format in HyperCore: "#" + encoding
   */
  static getOutcomeSymbol(outcomeId: number, side: number = 0): string {
    const encoding = 10 * outcomeId + side;
    return `#${encoding}`;
  }

  /**
   * Fetches L2 order book for a given coin symbol (e.g., "#14720")
   */
  async getL2Book(coinSymbol: string): Promise<L2BookResponse> {
    return this.requestInfo<L2BookResponse>({
      type: 'l2Book',
      coin: coinSymbol,
    });
  }

  /**
   * Fetches L2 order book directly for an outcome market
   * @param outcomeId The outcome ID
   * @param side 0 for YES, 1 for NO (default 0)
   */
  async getOutcomeL2Book(outcomeId: number, side: number = 0): Promise<L2BookResponse> {
    const symbol = HyperliquidClient.getOutcomeSymbol(outcomeId, side);
    return this.getL2Book(symbol);
  }

  /**
   * Fetches perp metadata and live asset contexts (markPx, oraclePx, midPx, funding).
   * Pass `dex` for a HIP-3 builder-deployed perp dex, whose universe names are
   * prefixed with the dex (e.g. "xyz:XYZ100"). The default dex needs no argument.
   */
  async getMetaAndAssetCtxs(dex?: string): Promise<MetaAndAssetCtxsResponse> {
    const body: Record<string, unknown> = { type: 'metaAndAssetCtxs' };
    if (dex) body.dex = dex;
    return this.requestInfo<MetaAndAssetCtxsResponse>(body);
  }

  /**
   * Looks up the mark price and oracle price for a specific perp coin.
   * Accepts a plain name ("BTC") or a HIP-3 qualified name ("xyz:SKHX").
   */
  async getPerpMarkPrice(
    coinName: string
  ): Promise<{ markPx: number; oraclePx: number; midPx: number } | null> {
    const cleanCoin = coinName.toUpperCase().trim();
    // "xyz:SKHX" lives in the xyz dex; plain "BTC" lives in the default dex.
    const dex = cleanCoin.includes(':') ? cleanCoin.split(':')[0].toLowerCase() : undefined;

    const [meta, ctxs] = await this.getMetaAndAssetCtxs(dex);
    const index = meta.universe.findIndex((u) => u.name.toUpperCase() === cleanCoin);

    if (index === -1 || !ctxs[index]) {
      return null;
    }

    const ctx = ctxs[index];
    const markPx = parseFloat(ctx.markPx);
    const oraclePx = parseFloat(ctx.oraclePx);
    const midPx = ctx.midPx ? parseFloat(ctx.midPx) : markPx;

    return { markPx, oraclePx, midPx };
  }

  /**
   * Fetches recent OHLC candles for volatility estimation
   */
  async getCandles(
    coin: string,
    interval: string = '1h',
    startTime: number,
    endTime: number
  ): Promise<Array<{ t: number; T: number; s: string; i: string; o: string; c: string; h: string; l: string; v: string; n: number }>> {
    return this.requestInfo({
      type: 'candleSnapshot',
      req: {
        coin,
        interval,
        startTime,
        endTime,
      },
    });
  }
}
