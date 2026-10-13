/**
 * Mainnet Read-Only Liquidity Scoring Script
 * Analyzes market-making quality across HIP-4 venues (out, txyz, skew, etc.)
 * Strictly READ-ONLY. NEVER submits orders.
 */

import { HyperliquidClient } from '../data/hl-client.js';
import {
  OutcomeMetaItem,
  L2BookResponse,
  LiquidityMetric,
  VenueLiquiditySummary,
} from '../types.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let sampleSize = 15;
  const sampleArg = args.find((a) => a.startsWith('--sample=') || a.startsWith('--sample-size='));
  if (sampleArg) {
    sampleSize = parseInt(sampleArg.split('=')[1], 10);
  }

  let env = 'mainnet';
  const envArg = args.find((a) => a.startsWith('--env='));
  if (envArg) {
    env = envArg.split('=')[1].toLowerCase();
  }

  const isJson = args.includes('--json');
  return { sampleSize, env, isJson };
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2.0;
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

async function analyzeOutcomeBook(
  client: HyperliquidClient,
  item: OutcomeMetaItem
): Promise<LiquidityMetric> {
  let book: L2BookResponse | null = null;
  try {
    book = await client.getOutcomeL2Book(item.outcome, 0); // Side 0 = YES token
  } catch {
    // If book fetch fails, treat as empty
  }

  const bids = book?.levels?.[0] || [];
  const asks = book?.levels?.[1] || [];

  const bestBid = bids.length > 0 ? parseFloat(bids[0].px) : null;
  const bestAsk = asks.length > 0 ? parseFloat(asks[0].px) : null;

  let spread: number | null = null;
  if (bestBid !== null && bestAsk !== null) {
    spread = Number(Math.max(0, bestAsk - bestBid).toFixed(4));
  }

  // Calculate top 5 depth in USD
  const top5Bids = bids.slice(0, 5);
  const top5Asks = asks.slice(0, 5);

  const depthTop5BidsUsd = top5Bids.reduce(
    (sum, level) => sum + parseFloat(level.px) * parseFloat(level.sz),
    0
  );
  const depthTop5AsksUsd = top5Asks.reduce(
    (sum, level) => sum + parseFloat(level.px) * parseFloat(level.sz),
    0
  );

  const totalDepthTop5Usd = depthTop5BidsUsd + depthTop5AsksUsd;
  const isEmpty = bids.length === 0 && asks.length === 0;

  return {
    outcomeId: item.outcome,
    venue: item.venue || 'unknown',
    name: item.name || '',
    description: item.description || '',
    quoteToken: item.quoteToken || 'USDC',
    bestBid,
    bestAsk,
    spread,
    depthTop5BidsUsd: Number(depthTop5BidsUsd.toFixed(2)),
    depthTop5AsksUsd: Number(depthTop5AsksUsd.toFixed(2)),
    totalDepthTop5Usd: Number(totalDepthTop5Usd.toFixed(2)),
    bidLevelsCount: bids.length,
    askLevelsCount: asks.length,
    isEmpty,
  };
}

async function main() {
  const { sampleSize, env, isJson } = parseArgs();

  const apiUrl =
    env === 'testnet'
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';

  const client = new HyperliquidClient({ apiUrl, timeoutMs: 12000 });

  if (!isJson) {
    console.log(`\n======================================================================`);
    console.log(`  HIP-4 DESK — LIQUIDITY BENCHMARK REPORT (READ-ONLY)`);
    console.log(`  Target Network: ${env.toUpperCase()} (${apiUrl})`);
    console.log(`  Sample per venue: up to ${sampleSize} markets`);
    console.log(`======================================================================\n`);
  }

  // 1. Fetch outcome metadata
  if (!isJson) {
    console.log(`Fetching registered outcome metadata...`);
  }
  const metaResp = await client.getOutcomeMeta();
  const allOutcomes = metaResp.outcomes || [];

  if (!isJson) {
    console.log(`Total HIP-4 outcomes registered: ${allOutcomes.length}\n`);
  }

  // 2. Group by venue
  const venueMap = new Map<string, OutcomeMetaItem[]>();
  for (const item of allOutcomes) {
    const venue = item.venue || 'unknown';
    if (!venueMap.has(venue)) {
      venueMap.set(venue, []);
    }
    venueMap.get(venue)!.push(item);
  }

  // Sort venues by outcome count descending
  const sortedVenues = Array.from(venueMap.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  const venueSummaries: VenueLiquiditySummary[] = [];
  const detailedMetrics: Record<string, LiquidityMetric[]> = {};

  // 3. Evaluate each venue
  for (const [venue, outcomes] of sortedVenues) {
    if (!isJson) {
      console.log(`Analyzing venue [${venue}] (${outcomes.length} total outcomes)...`);
    }

    const sampled = outcomes.slice(0, sampleSize);
    const metrics: LiquidityMetric[] = [];

    // Query books sequentially or in small parallel batches to respect rate limits
    for (const item of sampled) {
      const metric = await analyzeOutcomeBook(client, item);
      metrics.push(metric);
      // Small pause to be gentle on public API
      await new Promise((r) => setTimeout(r, 60));
    }

    detailedMetrics[venue] = metrics;

    const validSpreads = metrics
      .map((m) => m.spread)
      .filter((s): s is number => s !== null);

    const depths = metrics.map((m) => m.totalDepthTop5Usd);
    const emptyCount = metrics.filter((m) => m.isEmpty).length;
    const activeCount = metrics.filter((m) => !m.isEmpty).length;

    const summary: VenueLiquiditySummary = {
      venue,
      totalOutcomesInVenue: outcomes.length,
      sampledOutcomesCount: sampled.length,
      emptyBooksCount: emptyCount,
      emptyBooksPercentage: Number(((emptyCount / sampled.length) * 100).toFixed(1)),
      medianSpread: calculateMedian(validSpreads),
      averageSpread: calculateAverage(validSpreads),
      medianDepthTop5Usd: Number((calculateMedian(depths) || 0).toFixed(2)),
      activeOrderBooksCount: activeCount,
    };

    venueSummaries.push(summary);
  }

  // 4. Output Results
  if (isJson) {
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          network: env,
          totalOutcomes: allOutcomes.length,
          summaries: venueSummaries,
          details: detailedMetrics,
        },
        null,
        2
      )
    );
    return;
  }

  // Render Table
  console.log(`\n-------------------------------------------------------------------------------------------------------`);
  console.log(
    `| ${'VENUE'.padEnd(8)} | ${'TOTAL'.padStart(6)} | ${'SAMPLED'.padStart(8)} | ${'EMPTY %'.padStart(8)} | ${'MEDIAN SPREAD'.padStart(14)} | ${'AVG SPREAD'.padStart(11)} | ${'MEDIAN DEPTH'.padStart(13)} | ${'STATUS'.padEnd(10)} |`
  );
  console.log(`-------------------------------------------------------------------------------------------------------`);

  for (const s of venueSummaries) {
    const spreadStr = s.medianSpread !== null ? s.medianSpread.toFixed(4) : 'N/A';
    const avgSpreadStr = s.averageSpread !== null ? s.averageSpread.toFixed(4) : 'N/A';
    const depthStr = `$${s.medianDepthTop5Usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const emptyPctStr = `${s.emptyBooksPercentage}%`;

    let status = 'LIQUID';
    if (s.emptyBooksPercentage >= 80) status = 'DESERTED';
    else if (s.medianSpread !== null && s.medianSpread > 0.3) status = 'WIDE';

    console.log(
      `| ${s.venue.padEnd(8)} | ${String(s.totalOutcomesInVenue).padStart(6)} | ${String(
        s.sampledOutcomesCount
      ).padStart(8)} | ${emptyPctStr.padStart(8)} | ${spreadStr.padStart(14)} | ${avgSpreadStr.padStart(11)} | ${depthStr.padStart(13)} | ${status.padEnd(10)} |`
    );
  }
  console.log(`-------------------------------------------------------------------------------------------------------\n`);

  // Key Insight Summary
  console.log(`PRODUCT THESIS VERIFICATION:`);
  const liquidVenues = venueSummaries.filter(v => v.medianSpread !== null && v.medianSpread < 0.05);
  const illiquidVenues = venueSummaries.filter(v => v.emptyBooksPercentage > 50 || (v.medianSpread !== null && v.medianSpread > 0.20));

  console.log(`   - Highly liquid venues: [${liquidVenues.map(v => v.venue).join(', ') || 'None'}]`);
  console.log(`   - Deserted/Illiquid venues: [${illiquidVenues.map(v => v.venue).join(', ')}]`);
  console.log(`   - Market Opportunity: Deployers on illiquid venues suffer from wide spreads or empty books.`);
  console.log(`   - HIP-4 Desk Value Prop: Automated quoting bridges this gap instantly, making order books two-sided.`);
  console.log(`\nRead-only liquidity analysis complete.\n`);
}

main().catch((err) => {
  console.error(`Fatal error in liquidity scoring:`, err);
  process.exit(1);
});
