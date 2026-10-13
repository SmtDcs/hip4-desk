/**
 * Unit Tests: Quoting Engine & Risk Manager
 */

import assert from 'node:assert';
import { QuotingEngine } from '../src/engine/quoter.js';
import { ParsedPriceBinary, QuotingParams, InventoryState } from '../src/types.js';

console.log('🧪 Running Quoting Engine & Risk Limits Tests...\n');

const mockParams: QuotingParams = {
  baseSpread: 0.04,              // 4 cents
  orderSizeNotional: 20,         // $20 per order
  maxInventory: 100,             // 100 contracts cap
  expiryPullbackMinutes: 30,     // pull 30 min before
  annualizedVol: 0.60,
  skewFactor: 0.0002,
};

const quoter = new QuotingEngine(mockParams);

const futureExpiry = Date.now() + 24 * 3600 * 1000; // 24 hours in future

const sampleMarket: ParsedPriceBinary = {
  outcomeId: 9999,
  venue: 'out',
  quoteToken: 'USDC',
  templateType: 'priceBinary',
  underlyingPerp: 'BTC',
  strikePrice: 85000,
  expiryTimestampMs: futureExpiry,
  expiryDate: new Date(futureExpiry),
  isExpired: false,
  timeToExpirySeconds: 24 * 3600,
  rawName: 'template:priceBinary',
  rawDescription: 'perp:BTC|threshold:85000|time:20261101-0000',
};

// 1. Two-sided active quote generation
{
  const quote = quoter.generateQuote(sampleMarket, 85000, 0.60);
  assert.strictEqual(quote.status, 'active');
  assert(quote.yesBidPx < quote.yesAskPx, 'Bid must be strictly less than Ask');
  assert(quote.effectiveSpread >= 0.038, `Effective spread should be ~0.04, got ${quote.effectiveSpread}`);
  assert(quote.yesBidSz * quote.yesBidPx >= 10, 'Bid notional must be >= 10');
  assert(quote.yesAskSz * quote.yesAskPx >= 10, 'Ask notional must be >= 10');

  console.log(`  ✅ Active Quote: Bid $${quote.yesBidPx} (${quote.yesBidSz} sz) | Ask $${quote.yesAskPx} (${quote.yesAskSz} sz) | Spread: $${quote.effectiveSpread}`);
}

// 2. Inventory Skew test
{
  const neutralQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, {
    outcomeId: 9999,
    netYesPosition: 0,
    totalYesBought: 0,
    totalYesSold: 0,
  });

  const longInventory: InventoryState = {
    outcomeId: 9999,
    netYesPosition: 50, // Long 50 Yes contracts -> should lower quotes to dump Yes
    totalYesBought: 50,
    totalYesSold: 0,
  };

  const skewedQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, longInventory);
  assert(skewedQuote.yesBidPx < neutralQuote.yesBidPx, 'Long inventory must lower Bid price');
  assert(skewedQuote.yesAskPx < neutralQuote.yesAskPx, 'Long inventory must lower Ask price');
  assert(skewedQuote.inventorySkew > 0, 'Inventory skew must be positive for long position');

  console.log(`  ✅ Inventory Skew: Neutral Bid $${neutralQuote.yesBidPx} -> Skewed Bid $${skewedQuote.yesBidPx} (Shift: -$${skewedQuote.inventorySkew})`);
}

// 3. Expiry Pullback test (anti-gamma risk)
{
  const nearExpiryMarket: ParsedPriceBinary = {
    ...sampleMarket,
    timeToExpirySeconds: 15 * 60, // 15 minutes left (< 30 minutes threshold)
  };

  const pulledQuote = quoter.generateQuote(nearExpiryMarket, 85000, 0.60);
  assert.strictEqual(pulledQuote.status, 'pulled_expiry');
  assert.strictEqual(pulledQuote.yesBidPx, 0);
  assert.strictEqual(pulledQuote.yesAskPx, 0);
  assert(pulledQuote.reason?.includes('gamma pullback window'));

  console.log(`  ✅ Expiry Pullback: Safely pulled quote 15m before expiry (${pulledQuote.reason})`);
}

// 4. Max Inventory Breach test
{
  const maxInventoryBreached: InventoryState = {
    outcomeId: 9999,
    netYesPosition: 105, // Cap is 100
    totalYesBought: 105,
    totalYesSold: 0,
  };

  const cappedQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, maxInventoryBreached);
  assert.strictEqual(cappedQuote.status, 'pulled_inventory');
  assert.strictEqual(cappedQuote.yesBidPx, 0);
  assert.strictEqual(cappedQuote.yesAskPx, 0);
  assert(cappedQuote.reason?.includes('Inventory cap breached'));

  console.log(`  ✅ Max Inventory Limit: Safely pulled quotes when cap exceeded (${cappedQuote.reason})`);
}

// 5. Empty-book-friendly quoting: two-sided quote generated when active
{
  const emptyBookQuote = quoter.generateQuote(sampleMarket, 85000, 0.60);
  assert.strictEqual(emptyBookQuote.status, 'active');
  assert(emptyBookQuote.yesBidPx > 0, 'Bid must be positive');
  assert(emptyBookQuote.yesAskPx > 0, 'Ask must be positive');
  assert(emptyBookQuote.yesBidPx < emptyBookQuote.yesAskPx, 'Bid must be lower than Ask');
  assert(emptyBookQuote.yesBidSz > 0 && emptyBookQuote.yesAskSz > 0, 'Sizes must be positive');

  console.log(`  ✅ Empty-Book Quoting: Generates active two-sided liquidity on unseeded book`);
}

// 6. Short inventory (negative netYes) raises bids
{
  const neutralQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, {
    outcomeId: 9999,
    netYesPosition: 0,
    totalYesBought: 0,
    totalYesSold: 0,
  });

  const shortInventory: InventoryState = {
    outcomeId: 9999,
    netYesPosition: -50, // Short 50 YES contracts -> desk needs YES
    totalYesBought: 0,
    totalYesSold: 50,
  };

  const shortQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, shortInventory);
  assert(shortQuote.yesBidPx > neutralQuote.yesBidPx, 'Short inventory must raise Bid price');
  assert(shortQuote.yesAskPx > neutralQuote.yesAskPx, 'Short inventory must raise Ask price');
  assert(shortQuote.inventorySkew < 0, 'Inventory skew must be negative for short inventory');

  console.log(`  ✅ Short Inventory Skew: Net -50 YES raised Bid $${neutralQuote.yesBidPx} -> $${shortQuote.yesBidPx} to acquire inventory`);
}

// 7. Exact inventory-at-cap boundary tests
{
  // Just under cap (99 of 100) -> ACTIVE
  const underCapQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, {
    outcomeId: 9999,
    netYesPosition: 99,
    totalYesBought: 99,
    totalYesSold: 0,
  });
  assert.strictEqual(underCapQuote.status, 'active', 'Position 99 (< cap 100) must remain active');

  // Exact cap boundary (100 of 100) -> PULLED
  const exactCapQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, {
    outcomeId: 9999,
    netYesPosition: 100,
    totalYesBought: 100,
    totalYesSold: 0,
  });
  assert.strictEqual(exactCapQuote.status, 'pulled_inventory', 'Exact cap boundary (100) must pull quotes');

  // Exact negative cap boundary (-100 of 100) -> PULLED
  const exactNegCapQuote = quoter.generateQuote(sampleMarket, 85000, 0.60, {
    outcomeId: 9999,
    netYesPosition: -100,
    totalYesBought: 0,
    totalYesSold: 100,
  });
  assert.strictEqual(exactNegCapQuote.status, 'pulled_inventory', 'Exact negative cap boundary (-100) must pull quotes');

  console.log(`  ✅ Exact Cap Boundary: 99 active, exactly 100 / -100 safely pulled`);
}

// 8. Minimum notional holds at the low end of the price band
// A deep out-of-the-money binary quotes near 0.001, where rounding the price up
// to 0.01 for sizing would leave a $1.50 order that HIP-4 rejects.
{
  const deepOtm = quoter.generateQuote(sampleMarket, 20000, 0.60); // spot far below strike
  assert.strictEqual(deepOtm.status, 'active');
  assert(
    deepOtm.yesBidSz * deepOtm.yesBidPx >= 10,
    `Bid notional must stay >= 10 at low prices, got $${(deepOtm.yesBidSz * deepOtm.yesBidPx).toFixed(2)}`
  );
  assert(
    deepOtm.yesAskSz * deepOtm.yesAskPx >= 10,
    `Ask notional must stay >= 10 at low prices, got $${(deepOtm.yesAskSz * deepOtm.yesAskPx).toFixed(2)}`
  );

  console.log(`  ✅ Low-Price Sizing: Bid ${deepOtm.yesBidSz} @ $${deepOtm.yesBidPx} = $${(deepOtm.yesBidSz * deepOtm.yesBidPx).toFixed(2)} notional, above the $10 floor`);
}

console.log('\nAll Quoting Engine & Risk Limits tests passed successfully!\n');
