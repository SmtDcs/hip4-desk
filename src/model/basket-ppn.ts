/**
 * Principal-Protected Note (PPN) & Outcome Basket Simulator
 * 
 * Pure mathematical simulation and scenario analysis engine.
 * STRETCH FEATURE (H2) for HIP-4 Desk:
 * Allows deployers or structured product architects to package multiple HIP-4 binary outcomes
 * into a principal-protected note with guaranteed capital preservation floor and upside participation.
 * 
 * ZERO TOKENS / ZERO SMART CONTRACTS (Simulation only).
 */

export interface BasketLeg {
  outcomeId: number;
  marketName: string;
  underlying: string;
  strikePrice: number;
  yesPrice: number; // Current market price of YES token [0.001 - 0.999]
  weight: number;   // Weight within the risk budget (sums to 1.0)
}

export interface PpnBasketConfig {
  totalInvestmentUsd: number;       // e.g. $1,000 USD
  capitalProtectionPercent: number; // e.g. 0.90 for 90% capital floor (max 10% loss)
  legs: BasketLeg[];
}

export interface ScenarioPayoff {
  scenarioId: string;
  description: string;
  winningLegs: number[];            // outcomeIds that settle to YES (1.00)
  capitalFloorUsd: number;          // Guaranteed preserved capital
  riskPayoffUsd: number;            // Payout from the binary outcomes
  totalValueUsd: number;            // capitalFloor + riskPayoff
  netPnlUsd: number;                // totalValue - totalInvestment
  roiPercent: number;               // (netPnl / totalInvestment) * 100
}

export interface PpnSimulationResult {
  totalInvestmentUsd: number;
  capitalFloorUsd: number;
  capitalProtectionPercent: number;
  riskBudgetUsd: number;
  maxLossUsd: number;
  maxLossPercent: number;
  maxUpsideUsd: number;
  maxUpsidePercent: number;
  legs: Array<BasketLeg & {
    allocatedBudgetUsd: number;
    contractsBought: number;
    maxLegPayoutUsd: number;
  }>;
  scenarios: ScenarioPayoff[];
  breakevenScenariosCount: number;
}

export class PpnBasketCalculator {
  /**
   * Simulates a Principal-Protected Note allocation across a basket of HIP-4 outcomes.
   * 
   * Mechanics:
   * 1. Safe Allocation = totalInvestment * capitalProtectionPercent (held in cash/yield)
   * 2. Risk Budget = totalInvestment * (1 - capitalProtectionPercent)
   * 3. Risk Budget is distributed among basket legs according to weights to purchase YES contracts.
   * 4. Evaluates all 2^N binary settlement permutations to compute payoff profile.
   */
  public static simulatePpn(config: PpnBasketConfig): PpnSimulationResult {
    if (config.totalInvestmentUsd <= 0) {
      throw new Error('Total investment must be greater than zero');
    }
    if (config.capitalProtectionPercent < 0 || config.capitalProtectionPercent > 1.0) {
      throw new Error('Capital protection percent must be between 0.0 and 1.0 (e.g. 0.90 for 90%)');
    }
    if (config.legs.length === 0) {
      throw new Error('Basket must contain at least one leg');
    }

    // Normalize weights
    const totalWeight = config.legs.reduce((sum, leg) => sum + leg.weight, 0);
    const normalizedLegs = config.legs.map((leg) => ({
      ...leg,
      weight: totalWeight > 0 ? leg.weight / totalWeight : 1 / config.legs.length,
    }));

    const capitalFloorUsd = Number((config.totalInvestmentUsd * config.capitalProtectionPercent).toFixed(2));
    const riskBudgetUsd = Number((config.totalInvestmentUsd - capitalFloorUsd).toFixed(2));
    const maxLossUsd = Number((config.totalInvestmentUsd - capitalFloorUsd).toFixed(2));
    const maxLossPercent = Number(((1 - config.capitalProtectionPercent) * 100).toFixed(2));

    // Calculate position sizes per leg
    const detailedLegs = normalizedLegs.map((leg) => {
      const allocatedBudgetUsd = Number((riskBudgetUsd * leg.weight).toFixed(2));
      const clampedPrice = Math.max(0.001, Math.min(0.999, leg.yesPrice));
      const contractsBought = Number((allocatedBudgetUsd / clampedPrice).toFixed(4));
      // When YES settles to 1.00 USD
      const maxLegPayoutUsd = Number((contractsBought * 1.0).toFixed(2));

      return {
        ...leg,
        allocatedBudgetUsd,
        contractsBought,
        maxLegPayoutUsd,
      };
    });

    const maxRiskPayoutUsd = detailedLegs.reduce((sum, leg) => sum + leg.maxLegPayoutUsd, 0);
    const maxUpsideUsd = Number((capitalFloorUsd + maxRiskPayoutUsd - config.totalInvestmentUsd).toFixed(2));
    const maxUpsidePercent = Number(((maxUpsideUsd / config.totalInvestmentUsd) * 100).toFixed(2));

    // Generate all 2^N settlement scenarios (for up to 6 legs)
    const n = Math.min(detailedLegs.length, 6);
    const totalScenarios = Math.pow(2, n);
    const scenarios: ScenarioPayoff[] = [];

    for (let i = 0; i < totalScenarios; i++) {
      const winningOutcomeIds: number[] = [];
      let scenarioRiskPayoff = 0;
      const legStates: string[] = [];

      for (let bit = 0; bit < n; bit++) {
        const isYes = ((i >> bit) & 1) === 1;
        const leg = detailedLegs[bit];
        if (isYes) {
          winningOutcomeIds.push(leg.outcomeId);
          scenarioRiskPayoff += leg.maxLegPayoutUsd;
          legStates.push(`${leg.underlying}: YES`);
        } else {
          legStates.push(`${leg.underlying}: NO`);
        }
      }

      const totalValueUsd = Number((capitalFloorUsd + scenarioRiskPayoff).toFixed(2));
      const netPnlUsd = Number((totalValueUsd - config.totalInvestmentUsd).toFixed(2));
      const roiPercent = Number(((netPnlUsd / config.totalInvestmentUsd) * 100).toFixed(2));

      scenarios.push({
        scenarioId: `S-${i.toString(2).padStart(n, '0')}`,
        description: legStates.join(' | '),
        winningLegs: winningOutcomeIds,
        capitalFloorUsd,
        riskPayoffUsd: Number(scenarioRiskPayoff.toFixed(2)),
        totalValueUsd,
        netPnlUsd,
        roiPercent,
      });
    }

    const breakevenScenariosCount = scenarios.filter((s) => s.netPnlUsd >= 0).length;

    return {
      totalInvestmentUsd: config.totalInvestmentUsd,
      capitalFloorUsd,
      capitalProtectionPercent: config.capitalProtectionPercent,
      riskBudgetUsd,
      maxLossUsd,
      maxLossPercent,
      maxUpsideUsd,
      maxUpsidePercent,
      legs: detailedLegs,
      scenarios,
      breakevenScenariosCount,
    };
  }
}
