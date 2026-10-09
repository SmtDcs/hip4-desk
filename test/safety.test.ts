/**
 * Safety & Hardening Unit Tests
 * Verifies mainnet execution locks, environment fallbacks, and AI advisory gating.
 */

import assert from 'node:assert';
import { loadConfig, assertSafeExecution, AppConfig } from '../src/config.js';
import { AiParamAdvisor } from '../src/engine/ai-advisory.js';
import { ParsedPriceBinary, QuotingParams } from '../src/types.js';

console.log('🧪 Running Safety & Hardening Tests...\n');

// 1. assertSafeExecution throws on mainnet config
{
  const mainnetConfig = loadConfig({ network: 'mainnet', isMainnet: true });
  assert.throws(
    () => assertSafeExecution(mainnetConfig, 'placeOrder'),
    (err: Error) => {
      assert(err.message.includes('[HIP-4 DESK CRITICAL SAFETY VIOLATION]'));
      assert(err.message.includes('placeOrder'));
      assert(err.message.includes('mainnet'));
      return true;
    },
    'assertSafeExecution must throw on mainnet config'
  );

  // Also test with isMainnet: true flag
  const customMainnetConfig: AppConfig = {
    ...loadConfig(),
    network: 'mainnet',
    isMainnet: true,
  };
  assert.throws(
    () => assertSafeExecution(customMainnetConfig, 'cancelAllOrders'),
    /CRITICAL SAFETY VIOLATION/
  );

  console.log('  ✅ Mainnet Safety Lock: assertSafeExecution strictly throws on mainnet');
}

// 2. assertSafeExecution allows testnet
{
  const testnetConfig = loadConfig({ network: 'testnet', isMainnet: false });
  assert.doesNotThrow(
    () => assertSafeExecution(testnetConfig, 'simulateTradeOrder'),
    'assertSafeExecution must allow execution on testnet'
  );
  assert.doesNotThrow(
    () => assertSafeExecution(testnetConfig, 'testnetQuotingTick'),
    'assertSafeExecution must allow execution on testnet'
  );

  console.log('  ✅ Testnet Execution Allowed: assertSafeExecution gracefully passes for testnet');
}

// 3. loadConfig defaults to testnet when HIP4_NETWORK is unset or invalid
{
  const savedNetwork = process.env.HIP4_NETWORK;

  try {
    // Unset / undefined
    delete process.env.HIP4_NETWORK;
    const configUnset = loadConfig();
    assert.strictEqual(configUnset.network, 'testnet');
    assert.strictEqual(configUnset.isMainnet, false);
    assert(configUnset.apiUrl.includes('testnet'));

    // Empty string
    process.env.HIP4_NETWORK = '';
    const configEmpty = loadConfig();
    assert.strictEqual(configEmpty.network, 'testnet');
    assert.strictEqual(configEmpty.isMainnet, false);

    // Invalid value: 'devnet'
    process.env.HIP4_NETWORK = 'devnet';
    const configDevnet = loadConfig();
    assert.strictEqual(configDevnet.network, 'testnet');
    assert.strictEqual(configDevnet.isMainnet, false);

    // Invalid value: 'production'
    process.env.HIP4_NETWORK = 'production';
    const configProd = loadConfig();
    assert.strictEqual(configProd.network, 'testnet');
    assert.strictEqual(configProd.isMainnet, false);

    // Explicit 'mainnet'
    process.env.HIP4_NETWORK = 'mainnet';
    const configMainnet = loadConfig();
    assert.strictEqual(configMainnet.network, 'mainnet');
    assert.strictEqual(configMainnet.isMainnet, true);
    assert(configMainnet.apiUrl.includes('api.hyperliquid.xyz'));
  } finally {
    if (savedNetwork !== undefined) {
      process.env.HIP4_NETWORK = savedNetwork;
    } else {
      delete process.env.HIP4_NETWORK;
    }
  }

  console.log('  ✅ Config Network Fallback: loadConfig safely defaults to testnet when unset or invalid');
}

// 4. Empty/desert book advisory path still returns suggestion without executing orders
{
  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const mockMarket: ParsedPriceBinary = {
    outcomeId: 11074,
    venue: 'txyz',
    quoteToken: 'USDC',
    templateType: 'priceBinary',
    underlyingPerp: 'BTC',
    strikePrice: 85000,
    expiryTimestampMs: Date.now() + 86400000,
    expiryDate: new Date(Date.now() + 86400000),
    isExpired: false,
    timeToExpirySeconds: 86400,
    rawName: 'BTC > $85,000',
    rawDescription: 'perp:BTC|threshold:85000',
  };

  const currentParams: QuotingParams = {
    baseSpread: 0.03,
    orderSizeNotional: 15,
    maxInventory: 200,
    expiryPullbackMinutes: 30,
    annualizedVol: 0.50,
  };

  const recommendation = AiParamAdvisor.generateRecommendation(
    mockMarket,
    84000,
    0.50,
    emptyBook,
    undefined,
    currentParams
  );

  // Advisory returns valid suggestions
  assert(recommendation.rulesTriggered.includes('DESERT_MARKET_OPPORTUNITY'), 'Must detect empty book opportunity');
  assert(recommendation.suggestedParams.orderSizeNotional >= 20, 'Suggests liquidity depth on empty book');
  assert(recommendation.explanation.length > 0, 'Must provide human-readable reasoning');
  assert.strictEqual(recommendation.marketId, 11074);

  // Strictly advisory: parameters unchanged, no execution authorization
  assert.strictEqual(recommendation.approved, undefined, 'Must not be auto-approved');
  assert.strictEqual(currentParams.baseSpread, 0.03, 'Current parameters must not be mutated');
  assert.strictEqual(currentParams.orderSizeNotional, 15, 'Current order size must remain untouched');

  console.log('  ✅ Desert Book Advisory Safety: Advisory returns suggestion with zero execution authority');
}

console.log('\n🎉 All Safety & Hardening tests passed successfully!\n');
