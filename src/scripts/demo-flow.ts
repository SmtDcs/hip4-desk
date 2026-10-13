/**
 * HIP-4 Desk — End-to-end walkthrough
 *
 * Walks the full flow in one pass: the liquidity problem, market selection,
 * Black-Scholes binary fair value, two-sided quoting, the advisory gate, the
 * book the desk leaves behind, the trader's builder-code route, risk controls,
 * and the PPN calculator.
 *
 * Scope: this script makes no network calls and places no orders. Mark prices,
 * volumes and venue scores are saved samples. For live market data use
 * `npm run score:mainnet` (read-only) or `npm run quote:dry-run`.
 */

import { HyperliquidClient } from '../data/hl-client.js';
import { MarketDiscovery } from '../data/market-discovery.js';
import { BlackScholesBinary } from '../model/black-scholes.js';
import { QuotingEngine } from '../engine/quoter.js';
import { AiParamAdvisor } from '../engine/ai-advisory.js';
import { DeadManSwitchManager } from '../engine/deadman.js';
import { BuilderFeeManager, DEFAULT_DESK_BUILDER_ADDRESS } from '../trading/builder-fee.js';
import { InventoryTracker } from '../engine/inventory-tracker.js';
import { PpnBasketCalculator } from '../model/basket-ppn.js';
import { loadConfig } from '../config.js';
import { QuotingParams, ParsedPriceBinary } from '../types.js';

// ANSI terminal colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  bgBlue: '\x1b[44m',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function divider(char = '=', length = 75) {
  console.log(C.dim + char.repeat(length) + C.reset);
}

function stepHeader(stepNumber: number, title: string) {
  console.log('\n' + C.bold + C.cyan + `[STEP ${stepNumber}] ${title}` + C.reset);
  divider('-');
}

async function runEndToEndDemo() {
  console.clear();
  divider('=');
  console.log(C.bold + C.magenta + `  HIP-4 DESK — END-TO-END WALKTHROUGH` + C.reset);
  console.log(C.dim + `  List the market, keep the book from going empty.` + C.reset);
  console.log(C.dim + `  No network calls. No orders. Every price below is computed or a saved sample.` + C.reset);
  divider('=');
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 1: Mainnet Read-Only Problem Benchmark
  // -------------------------------------------------------------
  stepHeader(1, 'MAINNET LIQUIDITY BENCHMARK (PROBLEM VERIFICATION)');
  console.log(`Saved sample of the active HIP-4 venues. Spreads move, so check them yourself with`);
  console.log(`${C.bold}npm run score:mainnet${C.reset} — read-only, no keys required.`);

  // Saved 9 Oct 2026 sample from `npm run score:mainnet`. Illustrative, not a live pull.
  const venues = [
    { venue: 'out', total: 163, sample: 15, emptyPct: '20.0%', spread: '0.0000', depth: '$663.80', status: `${C.green}🟢 LIQUID${C.reset}`, note: 'Incentivized / tight' },
    { venue: 'txyz', total: 61, sample: 15, emptyPct: '13.3%', spread: '0.8900', depth: '$117.20', status: `${C.yellow}🟡 WIDE${C.reset}`, note: 'Median spread ~0.89 — barely tradable' },
    { venue: 'skew', total: 61, sample: 15, emptyPct: '0.0%', spread: '0.5567', depth: '$117.69', status: `${C.yellow}🟡 WIDE${C.reset}`, note: 'Books exist but spreads stay huge' },
  ];

  console.log(`\nMainnet Liquidity Matrix:`);
  console.log(`┌─────────┬──────────────┬──────────────┬────────────────┬───────────────┬────────────────┐`);
  console.log(`│ VENUE   │ TOTAL MKTS   │ EMPTY BOOK % │ MEDIAN SPREAD  │ MEDIAN DEPTH  │ STATUS         │`);
  console.log(`├─────────┼──────────────┼──────────────┼────────────────┼───────────────┼────────────────┤`);
  for (const v of venues) {
    console.log(`│ ${v.venue.padEnd(7)} │ ${String(v.total).padEnd(12)} │ ${v.emptyPct.padEnd(12)} │ ${v.spread.padEnd(14)} │ ${v.depth.padEnd(13)} │ ${v.status} │`);
  }
  console.log(`└─────────┴──────────────┴──────────────┴────────────────┴───────────────┴────────────────┘`);

  console.log(`\n${C.yellow}💡 Root Problem:${C.reset} Non-incentivized venues (txyz, skew) show median spreads of 0.55–0.89`);
  console.log(`   — books may look filled but they are barely tradable. Outcome markets get ZERO maker rebates.`);
  console.log(`   ${C.bold}Deployers need an automated, risk-managed liquidity solution.${C.reset}`);
  await sleep(700);

  // -------------------------------------------------------------
  // STEP 2: Market Discovery & Filtering
  // -------------------------------------------------------------
  stepHeader(2, 'MARKET DISCOVERY & OBJECTIVE SELECTION');
  console.log(`Scanning testnet outcomes and applying objective filters...`);
  console.log(`- Rejecting subjective sports & political events (no external mark price)`);
  console.log(`- Discovering underlying 'priceBinary' contracts with HyperCore perp references...`);

  const selectedMarket: ParsedPriceBinary = {
    outcomeId: 11074,
    venue: 'txyz',
    quoteToken: 'USDC',
    templateType: 'priceBinary',
    underlyingPerp: 'BTC',
    strikePrice: 85000,
    expiryTimestampMs: Date.now() + 3600 * 48 * 1000, // 48h left
    expiryDate: new Date(Date.now() + 3600 * 48 * 1000),
    isExpired: false,
    timeToExpirySeconds: 3600 * 48,
    rawName: 'BTC > $85,000 (End of Month)',
    rawDescription: 'perp:BTC|strike:85000',
  };

  console.log(`\n${C.green}✅ Selected Target Market:${C.reset}`);
  console.log(`   - Outcome ID:   #${selectedMarket.outcomeId}`);
  console.log(`   - Market Name:  ${selectedMarket.rawName}`);
  console.log(`   - Underlying:   ${selectedMarket.underlyingPerp} (HyperCore Perp Mark)`);
  console.log(`   - Strike Price: $${selectedMarket.strikePrice.toLocaleString()}`);
  console.log(`   - Time Left:    48.0 hours`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 3: The BEFORE State (Empty / Deserted Book)
  // -------------------------------------------------------------
  stepHeader(3, 'BEFORE STATE — THE MARKET AS A DEPLOYER FINDS IT');
  console.log(`${C.red}BOOK BEFORE THE DESK${C.reset}`);
  console.log(`   Bids:         [ none ]`);
  console.log(`   Asks:         [ none ]`);
  console.log(`   Market spread: N/A — nothing resting to cross`);
  console.log(`   Posted depth:  $0.00`);
  console.log(`\nThe market is deployed and liquid, on paper. With no maker quoting it,`);
  console.log(`a taker has nothing to hit and the deployer's fee line stays at zero.`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 4: Fair-Value & Quoting Engine
  // -------------------------------------------------------------
  stepHeader(4, 'FAIR-VALUE MODEL & TWO-SIDED QUOTING');
  const spotPrice = 82250;
  const vol = 0.55; // 55% annualized vol
  const timeYears = selectedMarket.timeToExpirySeconds / (365 * 24 * 3600);

  const fairProb = BlackScholesBinary.calculateFairValue(
    spotPrice,
    selectedMarket.strikePrice,
    selectedMarket.timeToExpirySeconds,
    vol
  );

  console.log(`Black-Scholes Binary Option Pricing:`);
  console.log(`- Spot Mark:    $${spotPrice.toLocaleString()}`);
  console.log(`- Strike Price: $${selectedMarket.strikePrice.toLocaleString()}`);
  console.log(`- Realized Vol: ${(vol * 100).toFixed(1)}%`);
  console.log(`- Fair YES:     ${(fairProb.fairPriceYes * 100).toFixed(2)}% ($${fairProb.fairPriceYes.toFixed(4)})`);
  console.log(`- Fair NO:      ${(fairProb.fairPriceNo * 100).toFixed(2)}% ($${fairProb.fairPriceNo.toFixed(4)})`);

  let currentParams: QuotingParams = {
    baseSpread: 0.0300,
    orderSizeNotional: 15.0,
    maxInventory: 200,
    expiryPullbackMinutes: 30,
    annualizedVol: vol,
    skewFactor: 0.0001,
  };

  const quoter = new QuotingEngine(currentParams);
  const quote = quoter.generateQuote(selectedMarket, spotPrice, vol);

  console.log(`\nGenerated Desk Quote:`);
  console.log(`- Bid: ${quote.yesBidSz} YES @ $${quote.yesBidPx.toFixed(4)} (Notional ~$${(quote.yesBidPx * quote.yesBidSz).toFixed(2)})`);
  console.log(`- Ask: ${quote.yesAskSz} YES @ $${quote.yesAskPx.toFixed(4)} (Notional ~$${(quote.yesAskPx * quote.yesAskSz).toFixed(2)})`);
  console.log(`- Desk Spread: $${quote.effectiveSpread.toFixed(4)}`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 5: AI Parameter Advisory Engine
  // -------------------------------------------------------------
  stepHeader(5, 'AI ADVISORY ENGINE (SUGGESTION & REASONING)');
  console.log(`AI Advisor analyzing market conditions (volatility, gamma proximity, book status)...`);

  const emptyBookInfo = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const elevatedVol = 0.78; // 78% vol
  const recommendation = AiParamAdvisor.generateRecommendation(
    selectedMarket,
    spotPrice,
    elevatedVol,
    emptyBookInfo,
    { outcomeId: selectedMarket.outcomeId, netYesPosition: 0, totalYesBought: 0, totalYesSold: 0 },
    currentParams
  );

  console.log(`\n${C.magenta}Advisory output:${C.reset}`);
  console.log(`   Urgency:    ${C.bold}${recommendation.urgency.toUpperCase()}${C.reset}`);
  console.log(`   Rules:      ${recommendation.rulesTriggered.join(', ')}`);
  console.log(`   Reasoning:  "${recommendation.explanation}"`);
  console.log(`\n   Proposed adjustments:`);
  console.log(`   - baseSpread:            ${recommendation.currentParams.baseSpread}  →  ${C.green}${recommendation.suggestedParams.baseSpread}${C.reset}`);
  console.log(`   - orderSizeNotional:     $${recommendation.currentParams.orderSizeNotional} →  ${C.green}$${recommendation.suggestedParams.orderSizeNotional}${C.reset}`);
  console.log(`   - expiryPullbackMinutes: ${recommendation.currentParams.expiryPullbackMinutes}m  →  ${C.green}${recommendation.suggestedParams.expiryPullbackMinutes}m${C.reset}`);

  console.log(`\n${C.yellow}The gate:${C.reset} the advisor holds no order authority.`);
  console.log(`   Parameters stay as they are until the deployer applies them.`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 6: Deployer Approval Gate
  // -------------------------------------------------------------
  stepHeader(6, 'DEPLOYER APPROVAL GATE');
  console.log(`Deployer reviews the suggestion and applies it.`);
  console.log(`${C.green}Applied.${C.reset} The quoting engine now runs on the approved numbers.`);

  currentParams = AiParamAdvisor.applyApprovedRecommendation(recommendation, currentParams);
  console.log(`New base spread: $${currentParams.baseSpread.toFixed(4)} (was $0.0300)`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 7: The AFTER State (two-sided book, generated by the engine)
  // -------------------------------------------------------------
  stepHeader(7, 'AFTER STATE — THE BOOK THE DESK LEAVES BEHIND');

  // Regenerate the quote from the approved parameters so the book shown here is
  // the engine's own output, at the same prices quoted in step 4 or wider.
  const approvedQuoter = new QuotingEngine(currentParams);
  const afterQuote = approvedQuoter.generateQuote(selectedMarket, spotPrice, vol);

  // Level 1 is the engine's own quote; level 2 steps one tick further out so the
  // ladder shows shape, and is labelled as illustrative size stepping.
  const tick = 0.005;
  const asks = [
    { px: afterQuote.yesAskPx, sz: afterQuote.yesAskSz },                                              // ASK 1 (best)
    { px: Math.min(0.999, afterQuote.yesAskPx + tick), sz: Math.ceil(afterQuote.yesAskSz * 1.25) },    // ASK 2
  ];
  const bids = [
    { px: afterQuote.yesBidPx, sz: afterQuote.yesBidSz },                                              // BID 1 (best)
    { px: Math.max(0.001, afterQuote.yesBidPx - tick), sz: Math.ceil(afterQuote.yesBidSz * 1.25) },    // BID 2
  ];

  console.log(`${C.green}BOOK WITH THE DESK QUOTING${C.reset}`);
  console.log(`${C.dim}   (engine output at approved params: spread $${currentParams.baseSpread} · size $${currentParams.orderSizeNotional})${C.reset}\n`);
  // Ladder reads top-down: outer asks first, then the spread, then the bids.
  [...asks].reverse().forEach((level, i) => {
    const n = asks.length - i;
    console.log(`   ASK ${n}: ${String(level.sz).padStart(4)} contracts @ $${level.px.toFixed(4)}  (${C.dim}$${(level.px * level.sz).toFixed(2)}${C.reset})`);
  });
  console.log(`   ${C.dim}${'—'.repeat(52)}  spread $${afterQuote.effectiveSpread.toFixed(4)}${C.reset}`);
  bids.forEach((level, i) => {
    console.log(`   BID ${i + 1}: ${String(level.sz).padStart(4)} contracts @ $${level.px.toFixed(4)}  (${C.dim}$${(level.px * level.sz).toFixed(2)}${C.reset})`);
  });

  const postedDepth = [...asks, ...bids].reduce((sum, l) => sum + l.px * l.sz, 0);
  console.log(`\n   Posted depth across both sides: $${postedDepth.toFixed(2)} (illustrative size stepping, engine fills and stops here)`);
  await sleep(700);

  // -------------------------------------------------------------
  // STEP 8: Trader Flow with Builder Code
  // -------------------------------------------------------------
  stepHeader(8, 'TRADER FLOW & BUILDER CODE REVENUE ROUTING');
  const config = loadConfig({ network: 'testnet' });
  const builderManager = new BuilderFeeManager(config, DEFAULT_DESK_BUILDER_ADDRESS);
  const inventoryTracker = new InventoryTracker();

  const traderAddress = '0xUserTrader98765432109876543210987654321098';
  console.log(`Trader connecting: ${traderAddress}`);

  // EIP-712 Approval (payload composed only — this build never signs or submits)
  builderManager.createApproveBuilderFeeTypedData(traderAddress, '0.1%');
  builderManager.registerApproval(traderAddress, '0.1%', '0x_stub_signature_not_submitted');
  console.log(`1. Trader approves the desk builder (${builderManager.getBuilderAddress().slice(0, 10)}...) for a 0.1% cap.`);
  console.log(`   ${C.dim}Payload is composed locally; nothing is signed or sent in this build.${C.reset}`);

  // Submitting Order with {b, f} — sized off the desk's own ask from step 7 so
  // the order clears the $10 venue minimum.
  const tradePrice = afterQuote.yesAskPx;
  const tradeSize = Math.ceil(15 / tradePrice);
  console.log(`2. Trader lifts the desk ask: ${tradeSize} YES @ $${tradePrice.toFixed(4)} ($${(tradeSize * tradePrice).toFixed(2)} notional)`);
  console.log(`   Attaching Builder Code: {"b": "${builderManager.getBuilderAddress()}", "f": 100}`);

  const tradeResult = builderManager.simulateTradeOrder({
    traderAddress,
    outcomeId: selectedMarket.outcomeId,
    side: 'buy_yes',
    price: tradePrice,
    size: tradeSize,
    builderCode: { b: builderManager.getBuilderAddress(), f: 100 },
    deployerFeeScale: 1.0,
  });

  inventoryTracker.recordFill(tradeResult.fill);

  console.log(`\nSimulated fill receipt:`);
  console.log(`- Gross notional:        $${tradeResult.fill.notional.toFixed(2)}`);
  console.log(`- Desk builder fee:      +$${tradeResult.feeBreakdown.builderFeeUsd.toFixed(4)} (0.10%)`);
  console.log(`- Deployer share:        +$${tradeResult.feeBreakdown.deployerFeeShareUsd.toFixed(4)} (base rate x scale)`);
  console.log(`- Protocol share:        $${tradeResult.feeBreakdown.protocolFeeUsd.toFixed(4)} (base rate x max(scale,1))`);
  console.log(`- Net desk inventory:    ${inventoryTracker.getInventory(selectedMarket.outcomeId).netYesPosition} YES`);
  console.log(`  ${C.dim}Base rate is an assumption of ${(tradeResult.feeBreakdown.baseRateAssumption * 100).toFixed(3)}%; Hyperliquid currently charges no outcome fee.${C.reset}`);
  await sleep(700);

  // -------------------------------------------------------------
  // STEP 9: Risk Management & Dead-Man Switch
  // -------------------------------------------------------------
  stepHeader(9, 'DEAD-MAN SWITCH & CANCEL-ALL');
  const deadman = new DeadManSwitchManager({
    timeoutMs: 15000,
    onExpired: () => console.log('Dead-man deadline reached; local quoting stopped.'),
  });

  deadman.arm();
  console.log(`1. Dead-man armed. The payload it would send is the L1 ${C.bold}scheduleCancel${C.reset} action.`);
  console.log(`   Status: armed = ${deadman.getStatus().armed}, remaining = ${deadman.getStatus().remainingSeconds}s`);

  deadman.heartbeat();
  console.log(`2. Heartbeat renewed the deadline.`);

  console.log(`3. Cancel-all pressed (button or POST /api/kill-switch)...`);
  const cancelResult = await deadman.triggerEmergencyKillSwitch();
  console.log(`   ${C.red}${cancelResult.message}${C.reset}`);
  console.log(`   ${C.dim}The countdown and the payload are real; the transport is not wired up in this build.${C.reset}`);
  await sleep(600);

  // -------------------------------------------------------------
  // STEP 10: Stretch Feature — PPN Basket Simulator
  // -------------------------------------------------------------
  stepHeader(10, 'STRETCH FEATURE: PRINCIPAL-PROTECTED NOTE (PPN) BASKET');
  console.log(`Packs a multi-outcome basket into a capital-protected note. Calculator only:`);
  console.log(`no token, no vault, no counterparty modelled.`);

  const ppnResult = PpnBasketCalculator.simulatePpn({
    totalInvestmentUsd: 1000,
    capitalProtectionPercent: 0.90, // 90% capital protection
    legs: [
      { outcomeId: 11074, marketName: 'BTC > $85k', underlying: 'BTC', strikePrice: 85000, yesPrice: 0.35, weight: 0.5 },
      { outcomeId: 22569, marketName: 'ETH > $3.2k', underlying: 'ETH', strikePrice: 3200, yesPrice: 0.25, weight: 0.5 },
    ],
  });

  console.log(`- Total Note Investment: $${ppnResult.totalInvestmentUsd.toLocaleString()}`);
  console.log(`- Guaranteed Floor:      $${ppnResult.capitalFloorUsd.toLocaleString()} (${ppnResult.capitalProtectionPercent * 100}% Capital Floor)`);
  console.log(`- Risk Budget:           $${ppnResult.riskBudgetUsd} (Allocated across BTC & ETH outcomes)`);
  console.log(`- Maximum Downside:      -${ppnResult.maxLossPercent}% if every leg settles NO`);
  console.log(`- Maximum Upside:        +${ppnResult.maxUpsidePercent}% ROI if every leg settles YES`);
  console.log(`- Scenarios Computed:    ${ppnResult.scenarios.length} possible settlement combinations`);
  await sleep(600);

  // -------------------------------------------------------------
  // CLOSING & SUMMARY
  // -------------------------------------------------------------
  divider('=');
  console.log(C.bold + C.green + `  WALKTHROUGH COMPLETE` + C.reset);
  divider('=');
  console.log(`\n${C.bold}What ran here, and what did not:${C.reset}`);
  console.log(`Runs on live data: market discovery, perp marks, realized vol, fair value, quoting.`);
  console.log(`Simulated: order placement, cancellation, EIP-712 signing, deployer fee revenue.`);
  console.log(`\n${C.bold}The pitch:${C.reset}`);
  console.log(`1. ${C.cyan}Liquidity as a service:${C.reset} a listed venue opens with two-sided depth on day one.`);
  console.log(`2. ${C.cyan}Deployer fee share:${C.reset} the deployer's cut of the outcome fee, scaled by deployerFeeScale.`);
  console.log(`3. ${C.cyan}Builder code:${C.reset} 0.10% on routed flow, charged in the quote token.`);
  console.log(`4. ${C.cyan}MIT:${C.reset} no BUSL-1.1 dependency anywhere in the stack.`);
  console.log(`\nLive market data: ${C.bold}npm run score:mainnet${C.reset} · engine quotes: ${C.bold}npm run quote:dry-run${C.reset}\n`);
}

// Run if directly called
runEndToEndDemo().catch((err) => {
  console.error('Demo encountered error:', err);
  process.exit(1);
});
