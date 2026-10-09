/**
 * Unit Tests: Black-Scholes Binary Option Pricing Model
 */

import assert from 'node:assert';
import { BlackScholesBinary } from '../src/model/black-scholes.js';

console.log('🧪 Running Black-Scholes Binary Tests...\n');

// 1. Normal CDF tests
{
  const cdfZero = BlackScholesBinary.normalCDF(0);
  assert(Math.abs(cdfZero - 0.5) < 1e-5, `N(0) should be 0.5, got ${cdfZero}`);

  const cdfHigh = BlackScholesBinary.normalCDF(1.96);
  assert(Math.abs(cdfHigh - 0.975) < 0.001, `N(1.96) should be ~0.975, got ${cdfHigh}`);

  const cdfLow = BlackScholesBinary.normalCDF(-1.96);
  assert(Math.abs(cdfLow - 0.025) < 0.001, `N(-1.96) should be ~0.025, got ${cdfLow}`);

  console.log('  ✅ normalCDF precision verified');
}

// 2. In-the-money test: Spot ($90,000) > Strike ($80,000), 7 days left, 50% vol
{
  const spot = 90000;
  const strike = 80000;
  const timeSeconds = 7 * 86400;
  const vol = 0.50;

  const result = BlackScholesBinary.calculateFairValue(spot, strike, timeSeconds, vol);
  assert(result.fairPriceYes > 0.70, `ITM Yes should be > 0.70, got ${result.fairPriceYes}`);
  assert(result.fairPriceNo < 0.30, `ITM No should be < 0.30, got ${result.fairPriceNo}`);
  assert(result.fairPriceYes + result.fairPriceNo === 1.0, 'Yes + No must equal 1.0');

  console.log(`  ✅ In-The-Money: Spot $90k > Strike $80k -> Fair YES = ${(result.fairPriceYes * 100).toFixed(1)}%`);
}

// 3. Out-of-the-money test: Spot ($70,000) < Strike ($80,000), 7 days left, 50% vol
{
  const spot = 70000;
  const strike = 80000;
  const timeSeconds = 7 * 86400;
  const vol = 0.50;

  const result = BlackScholesBinary.calculateFairValue(spot, strike, timeSeconds, vol);
  assert(result.fairPriceYes < 0.30, `OTM Yes should be < 0.30, got ${result.fairPriceYes}`);
  assert(result.fairPriceNo > 0.70, `OTM No should be > 0.70, got ${result.fairPriceNo}`);

  console.log(`  ✅ Out-Of-The-Money: Spot $70k < Strike $80k -> Fair YES = ${(result.fairPriceYes * 100).toFixed(1)}%`);
}

// 4. At-the-money test: Spot ($80,000) == Strike ($80,000), 30 days left
{
  const spot = 80000;
  const strike = 80000;
  const timeSeconds = 30 * 86400;
  const vol = 0.60;

  const result = BlackScholesBinary.calculateFairValue(spot, strike, timeSeconds, vol);
  // With drift=0, P(S_T > K) = N(-0.5*sigma*sqrt(T)) which is slightly below 0.5
  assert(result.fairPriceYes >= 0.40 && result.fairPriceYes <= 0.50, `ATM Yes should be ~0.45-0.50, got ${result.fairPriceYes}`);

  console.log(`  ✅ At-The-Money: Spot $80k == Strike $80k -> Fair YES = ${(result.fairPriceYes * 100).toFixed(1)}%`);
}

// 5. Expired boundary tests
{
  const expiredITM = BlackScholesBinary.calculateFairValue(85000, 80000, 0, 0.5);
  assert.strictEqual(expiredITM.fairPriceYes, 0.999, 'Expired ITM must clamp to 0.999');
  assert.strictEqual(expiredITM.isExpired, true);

  const expiredOTM = BlackScholesBinary.calculateFairValue(75000, 80000, -100, 0.5);
  assert.strictEqual(expiredOTM.fairPriceYes, 0.001, 'Expired OTM must clamp to 0.001');
  assert.strictEqual(expiredOTM.isExpired, true);

  console.log('  ✅ Boundary & Expired clamp conditions verified');
}

// 6. Edge cases: vol=0 (clamp), spot<=0 and strike<=0 (throw)
{
  // vol = 0 clamps internally to 0.01 without throwing
  const zeroVolResult = BlackScholesBinary.calculateFairValue(85000, 80000, 7 * 86400, 0);
  assert(zeroVolResult.fairPriceYes >= 0.001 && zeroVolResult.fairPriceYes <= 0.999);
  assert.strictEqual(zeroVolResult.isExpired, false);

  // spot <= 0 throws as implemented
  assert.throws(
    () => BlackScholesBinary.calculateFairValue(0, 80000, 7 * 86400, 0.5),
    /Invalid spot \(0\) or strike \(80000\): must be positive/
  );
  assert.throws(
    () => BlackScholesBinary.calculateFairValue(-500, 80000, 7 * 86400, 0.5),
    /Invalid spot \(-500\) or strike \(80000\): must be positive/
  );

  // strike <= 0 throws as implemented
  assert.throws(
    () => BlackScholesBinary.calculateFairValue(80000, 0, 7 * 86400, 0.5),
    /Invalid spot \(80000\) or strike \(0\): must be positive/
  );
  assert.throws(
    () => BlackScholesBinary.calculateFairValue(80000, -100, 7 * 86400, 0.5),
    /Invalid spot \(80000\) or strike \(-100\): must be positive/
  );

  console.log('  ✅ Edge cases: vol=0 clamped safely, non-positive spot/strike rejected with throw');
}

console.log('\n🎉 All Black-Scholes tests passed successfully!\n');
