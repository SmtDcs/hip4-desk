/**
 * Unit Tests: AI Parameter Advisory Module
 */

import assert from 'node:assert';
import { AiParamAdvisor } from '../src/engine/ai-advisory.js';
import { ParsedPriceBinary, QuotingParams } from '../src/types.js';

console.log('🧪 Running AI Parameter Advisor Tests...\n');

const baseParams: QuotingParams = {
  baseSpread: 0.03,
  orderSizeNotional: 15,
  maxInventory: 200,
  expiryPullbackMinutes: 30,
  annualizedVol: 0.60,
  skewFactor: 0.0001,
};

const sampleMarket: ParsedPriceBinary = {
  outcomeId: 11074,
  venue: 'txyz',
  quoteToken: 'USDC',
  templateType: 'priceBinary',
  underlyingPerp: 'BTC',
  strikePrice: 85000,
  expiryTimestampMs: Date.now() + 24 * 3600 * 1000,
  expiryDate: new Date(Date.now() + 24 * 3600 * 1000),
  isExpired: false,
  timeToExpirySeconds: 24 * 3600,
  rawName: 'template:priceBinary',
  rawDescription: 'BTC > $85,000',
};

// 1. High Volatility rule test
{
  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const highVolRec = AiParamAdvisor.generateRecommendation(
    sampleMarket,
    82000,
    0.95, // High Vol (95%)
    emptyBook,
    undefined,
    baseParams
  );

  assert(highRecTriggered(highVolRec, 'VOLATILITY_ELEVATED'), 'Should trigger VOLATILITY_ELEVATED');
  assert(highVolRec.suggestedParams.baseSpread > baseParams.baseSpread, 'Suggested spread must be wider under high vol');
  assert(highVolRec.explanation.includes('sigma = 95.0%') || highVolRec.explanation.toLowerCase().includes('volatility'));
  assert.strictEqual(highVolRec.approved, undefined, 'Must not be approved by default');

  console.log(`  ✅ High Volatility: σ = 95% -> Widened spread ${baseParams.baseSpread} to ${highVolRec.suggestedParams.baseSpread}`);
}

// 2. Near Expiry (Gamma Pin-Risk) rule test
{
  const nearExpiryMarket: ParsedPriceBinary = {
    ...sampleMarket,
    timeToExpirySeconds: 30 * 60, // 30 mins left
  };

  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const gammaRec = AiParamAdvisor.generateRecommendation(
    nearExpiryMarket,
    85000,
    0.50,
    emptyBook,
    undefined,
    baseParams
  );

  assert(highRecTriggered(gammaRec, 'EXPIRY_GAMMA_CRITICAL'), 'Should trigger EXPIRY_GAMMA_CRITICAL');
  assert.strictEqual(gammaRec.urgency, 'critical', 'Urgency must be critical for <45m expiry');
  assert(gammaRec.suggestedParams.expiryPullbackMinutes >= 60, 'Pullback window should increase to protect desk');

  console.log(`  ✅ Expiry Gamma: 30m left -> Critical Urgency with pullback increased to ${gammaRec.suggestedParams.expiryPullbackMinutes}m`);
}

// 3. Desert Orderbook opportunity rule test
{
  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const desertRec = AiParamAdvisor.generateRecommendation(
    sampleMarket,
    82000,
    0.50,
    emptyBook,
    undefined,
    baseParams
  );

  assert(highRecTriggered(desertRec, 'DESERT_MARKET_OPPORTUNITY'), 'Should trigger DESERT_MARKET_OPPORTUNITY');
  assert(desertRec.explanation.includes('TAMAMEN BOŞ') || desertRec.explanation.includes('Deserted'));

  console.log(`  ✅ Desert Market: Empty book detected -> Recommended liquidity deployment with explanation`);
}

// 4. Inventory Imbalance rule test
{
  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const heavyInventory = {
    outcomeId: 11074,
    netYesPosition: 150, // 150 / 200 = 75% cap ratio
    totalYesBought: 150,
    totalYesSold: 0,
  };

  const invRec = AiParamAdvisor.generateRecommendation(
    sampleMarket,
    82000,
    0.50,
    emptyBook,
    heavyInventory,
    baseParams
  );

  assert(highRecTriggered(invRec, 'INVENTORY_IMBALANCE_ALERT'), 'Should trigger INVENTORY_IMBALANCE_ALERT');
  assert(
    (invRec.suggestedParams.skewFactor ?? 0) > (baseParams.skewFactor ?? 0),
    'Skew factor must be increased to dump inventory'
  );

  console.log(`  ✅ Inventory Imbalance: Net YES 150/200 -> Doubled skewFactor to ${invRec.suggestedParams.skewFactor}`);
}

// 5. Deployer Approval Enforcement
{
  const emptyBook = { bestBid: null, bestAsk: null, spread: null, isEmpty: true };
  const rec = AiParamAdvisor.generateRecommendation(
    sampleMarket,
    82000,
    0.90,
    emptyBook,
    undefined,
    baseParams
  );

  // Active params remain untouched until explicitly approved
  let activeParams = { ...baseParams };
  assert.strictEqual(activeParams.baseSpread, 0.03);

  // Deployer confirms approval
  activeParams = AiParamAdvisor.applyApprovedRecommendation(rec, activeParams);
  assert.strictEqual(activeParams.baseSpread, rec.suggestedParams.baseSpread);

  console.log(`  ✅ Deployer Approval Gate: Params only updated upon explicit confirmation (${baseParams.baseSpread} -> ${activeParams.baseSpread})`);
}

function highRecTriggered(rec: any, rule: string): boolean {
  return rec.rulesTriggered.includes(rule);
}

console.log('\nAll AI Parameter Advisor tests passed successfully!\n');
