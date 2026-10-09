/**
 * HIP-4 Desk Configuration Module
 * Manages API URLs, network selection, quoting defaults, and safety enforcements.
 */

export interface AppConfig {
  network: 'testnet' | 'mainnet';
  apiUrl: string;
  isMainnet: boolean;
  baseSpread: number;
  orderSizeNotional: number;
  maxInventory: number;
  expiryPullbackMinutes: number;
  defaultAnnualizedVol: number;
  tickIntervalMs: number;
  targetVenue?: string;
  targetOutcomeId?: number;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const networkEnv = (process.env.HIP4_NETWORK || 'testnet').toLowerCase();
  const network: 'testnet' | 'mainnet' = networkEnv === 'mainnet' ? 'mainnet' : 'testnet';

  const mainnetUrl = process.env.HYPERLIQUID_MAINNET_API_URL || 'https://api.hyperliquid.xyz';
  const testnetUrl = process.env.HYPERLIQUID_TESTNET_API_URL || 'https://api.hyperliquid-testnet.xyz';

  const apiUrl = network === 'mainnet' ? mainnetUrl : testnetUrl;

  const baseSpread = Number(process.env.DEFAULT_BASE_SPREAD || '0.03');
  const orderSizeNotional = Number(process.env.DEFAULT_ORDER_SIZE || '15'); // Minimum 10 on HIP-4
  const maxInventory = Number(process.env.DEFAULT_MAX_INVENTORY || '200');
  const expiryPullbackMinutes = Number(process.env.DEFAULT_EXPIRY_PULLBACK_MINUTES || '30');
  const defaultAnnualizedVol = Number(process.env.DEFAULT_ANNUAL_VOLATILITY || '0.60');
  const tickIntervalMs = Number(process.env.TICK_INTERVAL_MS || '5000');

  const targetVenue = process.env.TARGET_VENUE || undefined;
  const targetOutcomeId = process.env.TARGET_OUTCOME_ID ? Number(process.env.TARGET_OUTCOME_ID) : undefined;

  const config: AppConfig = {
    network,
    apiUrl,
    isMainnet: network === 'mainnet',
    baseSpread,
    orderSizeNotional: Math.max(10, orderSizeNotional),
    maxInventory,
    expiryPullbackMinutes,
    defaultAnnualizedVol,
    tickIntervalMs,
    targetVenue,
    targetOutcomeId,
    ...overrides,
  };

  return config;
}

/**
 * STRICT SAFETY ENFORCEMENT
 * Throws immediately if an attempt is made to execute trades on mainnet.
 */
export function assertSafeExecution(config: AppConfig, operationName: string): void {
  if (config.isMainnet || config.network === 'mainnet') {
    throw new Error(
      `[HIP-4 DESK CRITICAL SAFETY VIOLATION] Execution operation '${operationName}' is STRICTLY PROHIBITED on mainnet! ` +
      `HIP-4 Desk only executes orders on testnet.`
    );
  }
}
