/**
 * Builder Code & ApproveBuilderFee Flow Module
 * 
 * Implements Hyperliquid Builder Code mechanics for HIP-4 Outcome Markets.
 * 
 * Protocol Rules:
 * 1. Builder Code format: { "b": builderAddress, "f": feeInTenthsOfBips }
 * 2. Maximum fee on HIP-4 outcome markets is 1.00% (1000 tenths of a bip).
 * 3. Prerequisite: Builder MUST maintain at least 100 USDC in their perps balance.
 * 4. Staking: Builder codes DO NOT require 500k HYPE stake (unlike venue deployers).
 * 5. Trader Approval: Trader must sign `ApproveBuilderFee` (EIP-712 typed data) before fees apply.
 * 6. Safety: STRICT DRY-RUN / TESTNET ONLY. Mainnet order submission is categorically forbidden.
 */

import { AppConfig, assertSafeExecution } from '../config.js';
import { BuilderCodePayload, ApproveBuilderFeePayload, TradeFill, TradeSide } from '../types.js';

export const DEFAULT_DESK_BUILDER_ADDRESS = '0x999999cf1046e68e36e1aa2e0e07105eddd7d5b7';
export const DEFAULT_BUILDER_FEE_TENTHS = 100; // 10 bps = 0.10%

/**
 * EIP-712 signing chain per Hyperliquid docs: 42161 (Arbitrum) on mainnet,
 * 421614 (Arbitrum Sepolia) on testnet. The chain id is part of the domain
 * separator, so a wrong value recovers a different signer and the exchange
 * rejects the action.
 */
export const HYPERLIQUID_SIGNATURE_CHAIN_IDS = {
  mainnet: 42161,
  testnet: 421614,
} as const;

/**
 * Base outcome trading fee rate used for modelling only.
 * Hyperliquid's HIP-4 docs state outcome markets currently charge no trading
 * fee during initial testing, so this stands in for the rate once it applies.
 */
export const BASE_OUTCOME_FEE_RATE = 0.00035; // 3.5 bps

export interface FeeBreakdown {
  grossNotionalUsd: number;
  takerFeeUsd: number;         // Base protocol rate, before deployerFeeScale
  protocolFeeUsd: number;      // Base rate x max(scale, 1) — the protocol's share
  builderFeeUsd: number;       // Fee routed to Desk via builder code
  deployerFeeShareUsd: number; // Base rate x scale — the deployer's share
  deployerFeeScale: number;    // Outcome's deployerFeeScale from outcomeMeta
  totalUserFeeUsd: number;     // Base rate x (scale + max(scale, 1))
  netTraderTotalUsd: number;   // Notional plus builder fee plus total user fee
  effectiveFeeRatePct: number;
  baseRateAssumption: number;  // The rate the model assumed, see BASE_OUTCOME_FEE_RATE
}

export class BuilderFeeManager {
  private config: AppConfig;
  private builderAddress: string;
  private approvedTraders: Map<string, ApproveBuilderFeePayload> = new Map();

  constructor(config: AppConfig, builderAddress: string = DEFAULT_DESK_BUILDER_ADDRESS) {
    this.config = config;
    this.builderAddress = builderAddress.toLowerCase();
  }

  getBuilderAddress(): string {
    return this.builderAddress;
  }

  /**
   * Generates standard Hyperliquid EIP-712 typed data for ApproveBuilderFee
   */
  createApproveBuilderFeeTypedData(
    traderAddress: string,
    maxFeeRate: string = '0.1%',
    nonce: number = Date.now()
  ) {
    const chainName = this.config.isMainnet ? 'Mainnet' : 'Testnet';
    const chainId = this.config.isMainnet
      ? HYPERLIQUID_SIGNATURE_CHAIN_IDS.mainnet
      : HYPERLIQUID_SIGNATURE_CHAIN_IDS.testnet;

    const domain = {
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000' as const,
    };

    const types = {
      'HyperliquidTransaction:ApproveBuilderFee': [
        { name: 'hyperliquidChain', type: 'string' },
        { name: 'maxFeeRate', type: 'string' },
        { name: 'builder', type: 'address' },
        { name: 'nonce', type: 'uint64' },
      ],
    };

    const message = {
      hyperliquidChain: chainName,
      maxFeeRate,
      builder: this.builderAddress,
      nonce: BigInt(nonce),
    };

    return {
      domain,
      types,
      primaryType: 'HyperliquidTransaction:ApproveBuilderFee' as const,
      message,
    };
  }

  /**
   * Records or stubs an ApproveBuilderFee signature for a trader wallet
   */
  registerApproval(
    traderAddress: string,
    maxFeeRate: string = '0.1%',
    signature: string = '0x_simulated_eip712_signature_valid'
  ): ApproveBuilderFeePayload {
    const approval: ApproveBuilderFeePayload = {
      builder: this.builderAddress,
      maxFeeRate,
      signature,
      isApproved: true,
      timestamp: Date.now(),
    };

    this.approvedTraders.set(traderAddress.toLowerCase(), approval);
    return approval;
  }

  /**
   * Checks if a trader has approved the builder fee
   */
  isTraderApproved(traderAddress: string): boolean {
    return this.approvedTraders.has(traderAddress.toLowerCase());
  }

  /**
   * Validates builder code parameters
   */
  static validateBuilderCode(code: BuilderCodePayload): { valid: boolean; reason?: string } {
    if (!code.b || !code.b.startsWith('0x') || code.b.length !== 42) {
      return { valid: false, reason: 'Invalid builder Ethereum address format (must be 0x + 40 hex chars)' };
    }

    if (/^0x0{40}$/i.test(code.b)) {
      return { valid: false, reason: 'Zero address is not allowed as builder' };
    }

    if (typeof code.f !== 'number' || isNaN(code.f) || code.f < 0) {
      return { valid: false, reason: 'Builder fee f must be a non-negative number' };
    }

    // HIP-4 max builder fee is 1.00% = 1000 tenths of a basis point
    if (code.f > 1000) {
      return { valid: false, reason: 'Builder fee exceeds max cap of 1.00% (1000 tenths of a bip)' };
    }

    return { valid: true };
  }

  /**
   * Computes the fee split for a trade with builder fee attached.
   *
   * Per HIP-4 deployer actions, a user trading an outcome pays the base outcome
   * fee rate times `scale + max(scale, 1)`: the deployer receives the `scale`
   * component and the protocol takes max(scale, 1). With scale 0 the user pays
   * the base rate and the deployer receives nothing.
   */
  calculateFeeBreakdown(
    notionalUsd: number,
    builderFeeTenths: number = DEFAULT_BUILDER_FEE_TENTHS,
    deployerFeeScale: number = 1.0
  ): FeeBreakdown {
    // 1 bip = 0.0001; 1 tenth of a bip = 0.00001
    const builderFeeRate = builderFeeTenths * 0.00001; // e.g. 100 -> 0.001 (0.10%)
    const builderFeeUsd = Number((notionalUsd * builderFeeRate).toFixed(4));

    const safeScale = Math.max(0, deployerFeeScale);
    const baseFeeUsd = notionalUsd * BASE_OUTCOME_FEE_RATE;
    const takerFeeUsd = Number(baseFeeUsd.toFixed(4));
    const deployerFeeShareUsd = Number((baseFeeUsd * safeScale).toFixed(4));
    const protocolFeeUsd = Number((baseFeeUsd * Math.max(safeScale, 1)).toFixed(4));
    const totalUserFeeUsd = Number((deployerFeeShareUsd + protocolFeeUsd).toFixed(4));

    const netTraderTotalUsd = Number((notionalUsd + builderFeeUsd + totalUserFeeUsd).toFixed(4));
    const effectiveFeeRatePct = Number((((totalUserFeeUsd + builderFeeUsd) / notionalUsd) * 100).toFixed(4));

    return {
      grossNotionalUsd: notionalUsd,
      takerFeeUsd,
      protocolFeeUsd,
      builderFeeUsd,
      deployerFeeShareUsd,
      deployerFeeScale: safeScale,
      totalUserFeeUsd,
      netTraderTotalUsd,
      effectiveFeeRatePct,
      baseRateAssumption: BASE_OUTCOME_FEE_RATE,
    };
  }

  /**
   * Executes a simulated trade on testnet with builder code attached
   * STRICT ENFORCEMENT: Never submits real orders on mainnet.
   */
  simulateTradeOrder(params: {
    traderAddress: string;
    outcomeId: number;
    side: TradeSide;
    price: number;
    size: number;
    builderCode?: BuilderCodePayload;
    deployerFeeScale?: number;
  }): { fill: TradeFill; feeBreakdown: FeeBreakdown } {
    // Safety check
    assertSafeExecution(this.config, 'simulateTradeOrder');

    const builderCode = params.builderCode || {
      b: this.builderAddress,
      f: DEFAULT_BUILDER_FEE_TENTHS,
    };

    const validation = BuilderFeeManager.validateBuilderCode(builderCode);
    if (!validation.valid) {
      throw new Error(`Invalid builder code: ${validation.reason}`);
    }

    const notional = Number((params.price * params.size).toFixed(4));
    if (notional < 10.0) {
      throw new Error(`Minimum order size on HIP-4 is 10 USDH/USDC (current: $${notional})`);
    }

    const fees = this.calculateFeeBreakdown(notional, builderCode.f, params.deployerFeeScale ?? 1.0);

    const fill: TradeFill = {
      fillId: `fill_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      outcomeId: params.outcomeId,
      side: params.side,
      price: params.price,
      size: params.size,
      notional,
      takerFee: fees.takerFeeUsd,
      builderFee: fees.builderFeeUsd,
      deployerFeeShare: fees.deployerFeeShareUsd,
      builderCode,
      timestamp: Date.now(),
    };

    return { fill, feeBreakdown: fees };
  }
}
