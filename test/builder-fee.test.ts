/**
 * Unit Tests: Builder Code & ApproveBuilderFee Flow Module
 */

import assert from 'node:assert';
import { BuilderFeeManager, DEFAULT_DESK_BUILDER_ADDRESS } from '../src/trading/builder-fee.js';
import { loadConfig } from '../src/config.js';

console.log('🧪 Running Builder Fee & Trade Execution Tests...\n');

const testnetConfig = loadConfig({ network: 'testnet' });
const builderManager = new BuilderFeeManager(testnetConfig, DEFAULT_DESK_BUILDER_ADDRESS);

// 1. Builder Code validation tests
{
  const validCode = { b: DEFAULT_DESK_BUILDER_ADDRESS, f: 100 }; // 0.10%
  const resValid = BuilderFeeManager.validateBuilderCode(validCode);
  assert.strictEqual(resValid.valid, true);

  // Boundary: f = 0 allowed
  const resF0 = BuilderFeeManager.validateBuilderCode({ b: DEFAULT_DESK_BUILDER_ADDRESS, f: 0 });
  assert.strictEqual(resF0.valid, true, 'f=0 must be allowed');

  // Boundary: f = 1000 (1.00% max cap) allowed
  const resF1000 = BuilderFeeManager.validateBuilderCode({ b: DEFAULT_DESK_BUILDER_ADDRESS, f: 1000 });
  assert.strictEqual(resF1000.valid, true, 'f=1000 (1.00%) must be allowed');

  // Boundary: f = 1001 (exceeds 1.00% max cap) rejected
  const resF1001 = BuilderFeeManager.validateBuilderCode({ b: DEFAULT_DESK_BUILDER_ADDRESS, f: 1001 });
  assert.strictEqual(resF1001.valid, false, 'f=1001 must be rejected');
  assert(resF1001.reason?.includes('exceeds max cap'));

  // Zero-address builder rejected
  const resZeroAddr = BuilderFeeManager.validateBuilderCode({
    b: '0x0000000000000000000000000000000000000000',
    f: 100,
  });
  assert.strictEqual(resZeroAddr.valid, false, 'Zero address builder must be rejected');
  assert(resZeroAddr.reason?.includes('Zero address'));

  const invalidAddress = { b: '0xInvalid', f: 100 };
  const resBadAddr = BuilderFeeManager.validateBuilderCode(invalidAddress);
  assert.strictEqual(resBadAddr.valid, false);

  const feeOverCap = { b: DEFAULT_DESK_BUILDER_ADDRESS, f: 1500 }; // 1.5% > 1.0% cap
  const resFeeCap = BuilderFeeManager.validateBuilderCode(feeOverCap);
  assert.strictEqual(resFeeCap.valid, false);
  assert(resFeeCap.reason?.includes('exceeds max cap'));

  console.log(`  ✅ Builder Code Validation: Correctly checks address format, zero-address rejection, and 1.00% fee cap boundaries`);
}

// 2. ApproveBuilderFee EIP-712 Typed Data struct test
{
  const trader = '0x1111111111111111111111111111111111111111';
  const typedData = builderManager.createApproveBuilderFeeTypedData(trader, '0.1%', 12345);

  assert.strictEqual(typedData.domain.name, 'HyperliquidSignTransaction');
  assert.strictEqual(typedData.domain.chainId, 1337);
  assert.strictEqual(typedData.primaryType, 'HyperliquidTransaction:ApproveBuilderFee');
  assert.strictEqual(typedData.message.builder, DEFAULT_DESK_BUILDER_ADDRESS);
  assert.strictEqual(typedData.message.maxFeeRate, '0.1%');
  assert.strictEqual(typedData.message.hyperliquidChain, 'Testnet');

  // Verify typedData types schema includes required fields
  const typeFields = typedData.types['HyperliquidTransaction:ApproveBuilderFee'];
  assert(Array.isArray(typeFields), 'Type definitions must be an array');
  const fieldNames = typeFields.map((field) => field.name);
  assert(fieldNames.includes('hyperliquidChain'), 'Typed data types must include hyperliquidChain');
  assert(fieldNames.includes('maxFeeRate'), 'Typed data types must include maxFeeRate');
  assert(fieldNames.includes('builder'), 'Typed data types must include builder');
  assert(fieldNames.includes('nonce'), 'Typed data types must include nonce');

  console.log(`  ✅ EIP-712 Typed Data: Correct Hyperliquid domain and ApproveBuilderFee schema with required fields`);
}

// 3. Approval registration & status test
{
  const trader = '0x2222222222222222222222222222222222222222';
  assert.strictEqual(builderManager.isTraderApproved(trader), false);

  const approval = builderManager.registerApproval(trader, '0.1%');
  assert.strictEqual(approval.isApproved, true);
  assert.strictEqual(builderManager.isTraderApproved(trader), true);

  console.log(`  ✅ Trader Approval: Successfully recorded trader approval state`);
}

// 4. Fee breakdown calculation test
{
  const notional = 100.0; // $100 trade
  const feeBreakdown = builderManager.calculateFeeBreakdown(notional, 100, 1.0); // 10 bps builder fee, 1.0 scale

  assert.strictEqual(feeBreakdown.grossNotionalUsd, 100.0);
  assert.strictEqual(feeBreakdown.builderFeeUsd, 0.10); // 0.10% of 100 = $0.10
  assert.strictEqual(feeBreakdown.takerFeeUsd, 0.035); // 0.035% of 100 = $0.035
  assert(feeBreakdown.deployerFeeShareUsd > 0);
  assert(feeBreakdown.netTraderTotalUsd > 100.0);

  console.log(`  ✅ Fee Calculation: $100 order -> Builder Fee $${feeBreakdown.builderFeeUsd} (0.10%), Taker Fee $${feeBreakdown.takerFeeUsd}`);
}

// 5. Testnet Order Simulation test
{
  const trader = '0x3333333333333333333333333333333333333333';
  const orderResult = builderManager.simulateTradeOrder({
    traderAddress: trader,
    outcomeId: 11074,
    side: 'buy_yes',
    price: 0.50,
    size: 30, // 30 * 0.50 = $15 notional (valid > $10)
  });

  assert.strictEqual(orderResult.fill.outcomeId, 11074);
  assert.strictEqual(orderResult.fill.notional, 15.0);
  assert.strictEqual(orderResult.fill.builderFee, 0.015);
  assert.strictEqual(orderResult.fill.builderCode?.b, DEFAULT_DESK_BUILDER_ADDRESS);

  console.log(`  ✅ Testnet Order Simulation: Processed simulated fill with attached builder code`);
}

// 6. Minimum notional gate enforcement
{
  assert.throws(() => {
    builderManager.simulateTradeOrder({
      traderAddress: '0x4444444444444444444444444444444444444444',
      outcomeId: 11074,
      side: 'buy_yes',
      price: 0.50,
      size: 10, // 10 * 0.50 = $5 notional (< $10 threshold)
    });
  }, /Minimum order size on HIP-4 is 10/);

  console.log(`  ✅ Min Notional Gate: Rejection enforced for orders < 10 USDH`);
}

// 7. Safety gate against mainnet execution
{
  const mainnetConfig = loadConfig({ network: 'mainnet' });
  const unsafeManager = new BuilderFeeManager(mainnetConfig);

  assert.throws(() => {
    unsafeManager.simulateTradeOrder({
      traderAddress: '0x5555555555555555555555555555555555555555',
      outcomeId: 11074,
      side: 'buy_yes',
      price: 0.50,
      size: 40,
    });
  }, /CRITICAL SAFETY VIOLATION/);

  console.log(`  ✅ Critical Safety Gate: Execution strictly blocked on mainnet`);
}

console.log('\nAll Builder Fee tests passed successfully!\n');
