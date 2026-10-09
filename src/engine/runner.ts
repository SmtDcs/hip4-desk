/**
 * Quoting Loop Runner
 * Orchestrates market discovery, pricing, orderbook diffing, and quoting cycles.
 * Enforces strict safety gates against mainnet order submission.
 */

import { AppConfig, assertSafeExecution } from '../config.js';
import { HyperliquidClient } from '../data/hl-client.js';
import { MarketDiscovery } from '../data/market-discovery.js';
import { VolatilityEstimator } from '../data/volatility.js';
import { QuotingEngine } from './quoter.js';
import { GeneratedQuote, ParsedPriceBinary, InventoryState } from '../types.js';

export interface QuoterRunOptions {
  dryRun: boolean;
  singleIteration?: boolean;
  limit?: number;
  onQuoteGenerated?: (quote: GeneratedQuote, market: ParsedPriceBinary) => void;
}

export class QuotingLoopRunner {
  private config: AppConfig;
  private client: HyperliquidClient;
  private quoter: QuotingEngine;
  private inventories: Map<number, InventoryState> = new Map();
  private isRunning: boolean = false;

  constructor(config: AppConfig) {
    this.config = config;
    this.client = new HyperliquidClient({ apiUrl: config.apiUrl });
    this.quoter = new QuotingEngine({
      baseSpread: config.baseSpread,
      orderSizeNotional: config.orderSizeNotional,
      maxInventory: config.maxInventory,
      expiryPullbackMinutes: config.expiryPullbackMinutes,
      annualizedVol: config.defaultAnnualizedVol,
    });
  }

  /**
   * Executes a single evaluation and quoting cycle across target markets
   */
  async runTick(options: QuoterRunOptions): Promise<GeneratedQuote[]> {
    if (!options.dryRun) {
      // STRICT SAFETY ASSERTION: Mainnet execution is categorically blocked!
      assertSafeExecution(this.config, 'QuotingLoopRunner.runTick(live)');
    }

    console.log(`\n======================================================`);
    console.log(`[HIP-4 Desk] Quoting Tick at ${new Date().toISOString()}`);
    console.log(`Network: ${this.config.network.toUpperCase()} | Dry-Run: ${options.dryRun}`);
    console.log(`======================================================`);

    // 1. Fetch outcome markets
    console.log(`[1/4] Fetching outcome metadata from ${this.config.apiUrl}...`);
    const metaResp = await this.client.getOutcomeMeta();
    const outcomes = metaResp.outcomes || [];
    console.log(`       Retrieved ${outcomes.length} total registered outcomes.`);

    // 2. Discover priceBinary markets
    let candidateMarkets = MarketDiscovery.discoverPriceBinaryMarkets(outcomes, {
      includeExpired: false,
      targetVenue: this.config.targetVenue,
    });

    if (this.config.targetOutcomeId) {
      candidateMarkets = candidateMarkets.filter(
        (m) => m.outcomeId === this.config.targetOutcomeId
      );
    }

    if (options.limit && options.limit > 0) {
      candidateMarkets = candidateMarkets.slice(0, options.limit);
    }

    console.log(
      `[2/4] Discovered ${candidateMarkets.length} active priceBinary markets ` +
        `matching criteria (Sports/Events strictly excluded).`
    );

    if (candidateMarkets.length === 0) {
      console.log(`       No active unexpired priceBinary markets found for current filters.`);
      // If none active, try including recently expired for dry-run inspection/simulation
      if (options.dryRun) {
        console.log(`       [Dry-Run Notice] Searching for expired price markets to demonstrate pricing model...`);
        const anyPriceMarkets = MarketDiscovery.discoverPriceBinaryMarkets(outcomes, {
          includeExpired: true,
          targetVenue: this.config.targetVenue,
        });
        if (anyPriceMarkets.length > 0) {
          candidateMarkets = anyPriceMarkets.slice(0, 3);
          console.log(`       Found ${candidateMarkets.length} sample price markets for dry-run pricing demonstration.`);
        }
      }
    }

    // 3. For each candidate market, compute fair value and generate quote
    console.log(`[3/4] Pricing markets and computing quotes...`);
    const generatedQuotes: GeneratedQuote[] = [];

    // Cache perp prices and vols to avoid redundant network calls
    const perpPrices = new Map<string, number>();
    const assetVols = new Map<string, number>();

    for (const market of candidateMarkets) {
      // Get underlying perp mark price
      let spotPrice = perpPrices.get(market.underlyingPerp);
      if (spotPrice === undefined) {
        try {
          const markData = await this.client.getPerpMarkPrice(market.underlyingPerp);
          if (markData) {
            spotPrice = markData.markPx;
            perpPrices.set(market.underlyingPerp, spotPrice);
          } else {
            console.warn(`       ⚠️ Could not resolve perp mark for ${market.underlyingPerp}, skipping.`);
            continue;
          }
        } catch (err) {
          console.warn(`       ⚠️ Error fetching perp mark for ${market.underlyingPerp}:`, err);
          continue;
        }
      }

      // Get annualized vol
      let vol = assetVols.get(market.underlyingPerp);
      if (vol === undefined) {
        vol = await VolatilityEstimator.estimateRealizedVol(this.client, market.underlyingPerp);
        assetVols.set(market.underlyingPerp, vol);
      }

      // Current inventory
      const inv = this.inventories.get(market.outcomeId) || {
        outcomeId: market.outcomeId,
        netYesPosition: 0,
        totalYesBought: 0,
        totalYesSold: 0,
      };

      // Generate quote
      const quote = this.quoter.generateQuote(market, spotPrice, vol, inv);
      generatedQuotes.push(quote);

      if (options.onQuoteGenerated) {
        options.onQuoteGenerated(quote, market);
      }

      // Fetch live L2 book to compare existing market spread vs Desk spread
      let existingSpreadStr = 'EMPTY BOOK';
      try {
        const book = await this.client.getOutcomeL2Book(market.outcomeId, 0);
        const bestBid = book.levels[0]?.[0]?.px ? parseFloat(book.levels[0][0].px) : null;
        const bestAsk = book.levels[1]?.[0]?.px ? parseFloat(book.levels[1][0].px) : null;
        if (bestBid !== null && bestAsk !== null) {
          existingSpreadStr = `${bestBid.toFixed(4)} / ${bestAsk.toFixed(4)} (spd: ${(bestAsk - bestBid).toFixed(4)})`;
        }
      } catch {
        // Book query non-critical for pricing
      }

      const hoursLeft = (market.timeToExpirySeconds / 3600).toFixed(1);

      console.log(`\n--- Market Outcome #${market.outcomeId} [Venue: ${market.venue}] ---`);
      console.log(`    Underlying: ${market.underlyingPerp} | Spot: $${spotPrice.toFixed(2)} | Strike: $${market.strikePrice.toFixed(2)} | Exp: ${market.expiryDate.toISOString()} (${hoursLeft}h left)`);
      console.log(`    Est. Vol: ${(vol * 100).toFixed(1)}% | Fair Value YES: ${(quote.fairValueYes * 100).toFixed(2)}% ($${quote.fairValueYes.toFixed(4)})`);
      console.log(`    Existing Market Book: ${existingSpreadStr}`);

      if (quote.status === 'active') {
        console.log(`    🟢 DESK QUOTE [ACTIVE]:`);
        console.log(`       BID: ${quote.yesBidSz} @ $${quote.yesBidPx.toFixed(4)} (Notional ~$${(quote.yesBidSz * quote.yesBidPx).toFixed(2)})`);
        console.log(`       ASK: ${quote.yesAskSz} @ $${quote.yesAskPx.toFixed(4)} (Notional ~$${(quote.yesAskSz * quote.yesAskPx).toFixed(2)})`);
        console.log(`       Desk Spread: $${quote.effectiveSpread.toFixed(4)} | Inv Skew: $${quote.inventorySkew.toFixed(4)}`);
        if (options.dryRun) {
          console.log(`       [DRY-RUN] No order submitted. In live testnet, limit orders would be posted.`);
        }
      } else {
        console.log(`    🔴 DESK QUOTE [PULLED]: ${quote.reason}`);
      }
    }

    console.log(`\n[4/4] Completed tick. Evaluated ${generatedQuotes.length} quotes.`);
    return generatedQuotes;
  }

  /**
   * Starts continuous quoting loop
   */
  async start(options: QuoterRunOptions): Promise<void> {
    this.isRunning = true;
    console.log(`[HIP-4 Desk] Starting continuous quoting loop (Interval: ${this.config.tickIntervalMs}ms)...`);

    while (this.isRunning) {
      try {
        await this.runTick(options);
      } catch (err) {
        console.error(`[HIP-4 Desk] Error in quoting tick:`, err);
      }

      if (options.singleIteration) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, this.config.tickIntervalMs));
    }
  }

  /**
   * Stops continuous quoting loop
   */
  stop(): void {
    this.isRunning = false;
    console.log(`[HIP-4 Desk] Quoting loop stopped.`);
  }
}
