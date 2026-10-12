import assert from 'node:assert';
import { PpnBasketCalculator, PpnBasketConfig } from '../src/model/basket-ppn.js';

console.log('🧪 Running Principal-Protected Note (PPN) & Basket Tests...\n');

// Test 1: Capital Floor Guarantee & Max Loss Bounds
{
  const config: PpnBasketConfig = {
    totalInvestmentUsd: 1000,
    capitalProtectionPercent: 0.90, // 90% capital guarantee
    legs: [
      {
        outcomeId: 101,
        marketName: 'BTC > $90,000',
        underlying: 'BTC',
        strikePrice: 90000,
        yesPrice: 0.30,
        weight: 0.5,
      },
      {
        outcomeId: 102,
        marketName: 'ETH > $3,500',
        underlying: 'ETH',
        strikePrice: 3500,
        yesPrice: 0.25,
        weight: 0.5,
      },
    ],
  };

  const result = PpnBasketCalculator.simulatePpn(config);

  assert.strictEqual(result.capitalFloorUsd, 900.0, 'Capital floor must equal exactly $900 for 90% protection');
  assert.strictEqual(result.riskBudgetUsd, 100.0, 'Risk budget must equal remaining $100');
  assert.strictEqual(result.maxLossUsd, 100.0, 'Max loss must be strictly bounded to $100');
  assert.strictEqual(result.maxLossPercent, 10.0, 'Max loss percent must be strictly bounded to 10%');

  // Verify all scenarios respect capital floor
  for (const scenario of result.scenarios) {
    assert(
      scenario.totalValueUsd >= result.capitalFloorUsd,
      `Scenario ${scenario.scenarioId} total value ($${scenario.totalValueUsd}) must not breach capital floor ($${result.capitalFloorUsd})`
    );
  }

  console.log('  ✅ Capital Floor Guarantee: $1,000 investment with 90% floor guarantees minimum $900 return in worst-case');
}

// Test 2: Maximum Upside & Scenario Payoff Distribution
{
  const config: PpnBasketConfig = {
    totalInvestmentUsd: 1000,
    capitalProtectionPercent: 0.95, // 95% capital guarantee, $50 risk budget
    legs: [
      {
        outcomeId: 11074,
        marketName: 'BTC > $85,000',
        underlying: 'BTC',
        strikePrice: 85000,
        yesPrice: 0.20, // 5x payout if YES
        weight: 1.0,
      },
    ],
  };

  const result = PpnBasketCalculator.simulatePpn(config);

  // When YES wins: $50 budget / 0.20 = 250 contracts. Payout = $250.
  // Total value = $950 (floor) + $250 = $1200.
  // Net PnL = +$200 (+20% ROI).
  const winScenario = result.scenarios.find((s) => s.winningLegs.includes(11074));
  assert(winScenario, 'Winning scenario must exist');
  assert.strictEqual(winScenario.riskPayoffUsd, 250.0, 'Payoff from $50 at $0.20 must be $250');
  assert.strictEqual(winScenario.totalValueUsd, 1200.0, 'Total return must be $1,200');
  assert.strictEqual(winScenario.roiPercent, 20.0, 'Net ROI must be +20%');

  const lossScenario = result.scenarios.find((s) => !s.winningLegs.includes(11074));
  assert(lossScenario, 'Losing scenario must exist');
  assert.strictEqual(lossScenario.totalValueUsd, 950.0, 'Worst case payout must equal exactly capital floor of $950');
  assert.strictEqual(lossScenario.roiPercent, -5.0, 'Worst case loss must equal -5%');

  console.log(`  ✅ Upside Participation: Win ROI = +${winScenario.roiPercent}% | Loss bounded to ${lossScenario.roiPercent}%`);
}

// Test 3: Multi-Leg Permutation Coverage (2^3 = 8 scenarios)
{
  const config: PpnBasketConfig = {
    totalInvestmentUsd: 2000,
    capitalProtectionPercent: 0.90, // $1800 floor, $200 risk budget
    legs: [
      { outcomeId: 1, marketName: 'BTC > 90k', underlying: 'BTC', strikePrice: 90000, yesPrice: 0.40, weight: 1 },
      { outcomeId: 2, marketName: 'ETH > 3k', underlying: 'ETH', strikePrice: 3000, yesPrice: 0.50, weight: 1 },
      { outcomeId: 3, marketName: 'SOL > 200', underlying: 'SOL', strikePrice: 200, yesPrice: 0.25, weight: 1 },
    ],
  };

  const result = PpnBasketCalculator.simulatePpn(config);
  assert.strictEqual(result.scenarios.length, 8, '3-leg basket must produce exactly 8 permutations (2^3)');
  assert(result.maxUpsidePercent > 0, 'Max upside must be positive');

  console.log(`  ✅ 3-Leg Basket: 8 resolution scenarios calculated. Max upside = +${result.maxUpsidePercent}% with 0% insolvency risk`);
}

// Test 4: Validation Guards
{
  assert.throws(() => {
    PpnBasketCalculator.simulatePpn({
      totalInvestmentUsd: 0,
      capitalProtectionPercent: 0.9,
      legs: [],
    });
  }, /Total investment must be greater than zero/);

  assert.throws(() => {
    PpnBasketCalculator.simulatePpn({
      totalInvestmentUsd: 1000,
      capitalProtectionPercent: 1.5,
      legs: [],
    });
  }, /Capital protection percent must be between 0.0 and 1.0/);

  console.log('  ✅ Validation Guards: Correctly rejects invalid parameters');
}

console.log('\nAll Principal-Protected Note & Basket tests passed successfully!\n');
