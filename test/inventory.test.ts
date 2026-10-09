/**
 * Unit Tests: Inventory Tracker & PnL Accounting Module
 */

import assert from 'node:assert';
import { InventoryTracker } from '../src/engine/inventory-tracker.js';
import { TradeFill } from '../src/types.js';

console.log('🧪 Running Inventory & PnL Accounting Tests...\n');

const tracker = new InventoryTracker();

// 1. Position tracking across sides
{
  const testFill1: TradeFill = {
    fillId: 'test_fill_1',
    outcomeId: 99001,
    side: 'buy_yes',
    price: 0.40,
    size: 50,
    notional: 20.0,
    takerFee: 0.007,
    builderFee: 0.02,
    deployerFeeShare: 0.0035,
    timestamp: Date.now(),
  };

  tracker.recordFill(testFill1);
  const inv1 = tracker.getInventory(99001);
  assert.strictEqual(inv1.netYesPosition, 50);
  assert.strictEqual(inv1.totalYesBought, 50);
  assert.strictEqual(inv1.totalYesSold, 0);

  // Partial sale
  const testFill2: TradeFill = {
    fillId: 'test_fill_2',
    outcomeId: 99001,
    side: 'sell_yes',
    price: 0.45,
    size: 20,
    notional: 9.0,
    takerFee: 0.003,
    builderFee: 0.009,
    deployerFeeShare: 0.0015,
    timestamp: Date.now(),
  };

  tracker.recordFill(testFill2);
  const inv2 = tracker.getInventory(99001);
  assert.strictEqual(inv2.netYesPosition, 30);
  assert.strictEqual(inv2.totalYesSold, 20);

  // Buy NO (equivalent to selling YES in unified book)
  const testFill3: TradeFill = {
    fillId: 'test_fill_3',
    outcomeId: 99001,
    side: 'buy_no',
    price: 0.55,
    size: 10,
    notional: 5.5,
    takerFee: 0.002,
    builderFee: 0.0055,
    deployerFeeShare: 0.001,
    timestamp: Date.now(),
  };

  tracker.recordFill(testFill3);
  const inv3 = tracker.getInventory(99001);
  assert.strictEqual(inv3.netYesPosition, 20); // 30 - 10 = 20

  console.log(`  ✅ Position Tracking: Correctly handles buy_yes, sell_yes, and buy_no net calculations`);
}

// 2. Portfolio PnL and fee revenue accumulation
{
  const portfolio = tracker.getPortfolioState();
  assert(portfolio.totalBuilderFeeRevenue > 0, 'Builder fee revenue must accumulate');
  assert(portfolio.totalDeployerFeeRevenue > 0, 'Deployer fee share must accumulate');
  assert(portfolio.fills.length >= 3, 'Fills ledger must retain transactions');

  console.log(`  ✅ Portfolio State: Builder Fee Revenue $${portfolio.totalBuilderFeeRevenue.toFixed(4)} | Fills: ${portfolio.fills.length}`);
}

console.log('\n🎉 All Inventory & PnL Accounting tests passed successfully!\n');
