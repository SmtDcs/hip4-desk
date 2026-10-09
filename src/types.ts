/**
 * HIP-4 Desk Core Type Definitions
 * Strict types for Hyperliquid outcome markets, market discovery,
 * Black-Scholes binary option pricing, and quoting engine.
 */

// --- Hyperliquid Info API Types ---

export interface OutcomeSideSpec {
  name: string;
}

export interface OutcomeMetaItem {
  outcome: number;
  name: string;
  description: string;
  sideSpecs: OutcomeSideSpec[];
  quoteToken: string;
  venue: string;
  deployerFeeScale?: string;
}

export interface OutcomeMetaResponse {
  outcomes: OutcomeMetaItem[];
}

export interface L2BookLevel {
  px: string;
  sz: string;
  n: number;
}

export interface L2BookResponse {
  coin: string;
  time: number;
  levels: [L2BookLevel[], L2BookLevel[]]; // [0] = bids, [1] = asks
}

export interface PerpUniverseItem {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  marginTableId?: number;
}

export interface PerpAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx?: string;
  impactPxs?: string[];
  dayBaseVlm: string;
}

export type MetaAndAssetCtxsResponse = [
  { universe: PerpUniverseItem[] },
  PerpAssetCtx[]
];

// --- Parsed Market Types ---

export type MarketTemplateType =
  | 'priceBinary'
  | 'binaryPrice'
  | 'binaryPriceExternal'
  | 'priceTouch'
  | 'unsupported';

export interface ParsedPriceBinary {
  outcomeId: number;
  venue: string;
  quoteToken: string;
  templateType: MarketTemplateType;
  underlyingPerp: string; // e.g. "BTC", "ETH"
  strikePrice: number;    // K
  expiryTimestampMs: number; // Unix epoch ms
  expiryDate: Date;
  isExpired: boolean;
  timeToExpirySeconds: number;
  rawName: string;
  rawDescription: string;
}

// --- Fair Value & Pricing Types ---

export interface FairValueResult {
  fairPriceYes: number; // P(S_T > K), bounded in (0.001, 0.999)
  fairPriceNo: number;  // 1 - P(Yes)
  d1: number;
  d2: number;
  spotPrice: number;    // S
  strikePrice: number;  // K
  timeToExpiryYears: number; // T
  annualizedVol: number;     // sigma
  isExpired: boolean;
}

// --- Quoting Engine Types ---

export interface QuotingParams {
  baseSpread: number;              // e.g. 0.03 (3 cents)
  orderSizeNotional: number;       // USDH/USDC notional per quote (min 10)
  maxInventory: number;            // max net contracts
  expiryPullbackMinutes: number;   // pull quotes X mins before expiry
  annualizedVol: number;           // fallback / default vol
  skewFactor?: number;             // spread shift per contract of inventory
}

export interface InventoryState {
  outcomeId: number;
  netYesPosition: number; // positive = long Yes, negative = short Yes
  totalYesBought: number;
  totalYesSold: number;
}

export type QuoteStatus =
  | 'active'
  | 'pulled_expiry'
  | 'pulled_inventory'
  | 'pulled_risk';

export interface GeneratedQuote {
  outcomeId: number;
  underlyingPerp: string;
  fairValueYes: number;
  fairValueNo: number;
  yesBidPx: number;
  yesBidSz: number;
  yesAskPx: number;
  yesAskSz: number;
  effectiveSpread: number;
  inventorySkew: number;
  status: QuoteStatus;
  reason?: string;
  timestamp: number;
}

// --- Liquidity Scoring Types ---

export interface LiquidityMetric {
  outcomeId: number;
  venue: string;
  name: string;
  description: string;
  quoteToken: string;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  depthTop5BidsUsd: number;
  depthTop5AsksUsd: number;
  totalDepthTop5Usd: number;
  bidLevelsCount: number;
  askLevelsCount: number;
  isEmpty: boolean;
}

export interface VenueLiquiditySummary {
  venue: string;
  totalOutcomesInVenue: number;
  sampledOutcomesCount: number;
  emptyBooksCount: number;
  emptyBooksPercentage: number;
  medianSpread: number | null;
  medianDepthTop5Usd: number;
  averageSpread: number | null;
  activeOrderBooksCount: number;
}

// --- Day 2 MVP Types ---

// AI Parameter Advisory Types
export type AiUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface AiRecommendation {
  marketId: number;
  marketName: string;
  underlyingPerp: string;
  currentParams: QuotingParams;
  suggestedParams: QuotingParams;
  rulesTriggered: string[];
  urgency: AiUrgency;
  confidence: number;
  explanation: string;
  timestamp: number;
}

// Dead-Man Switch Types
export interface DeadManStatus {
  armed: boolean;
  timeoutMs: number;
  scheduledCancelTimeMs: number | null;
  remainingSeconds: number;
  lastHeartbeatMs: number | null;
  statusText: string;
}

// Builder Fee Types
export interface BuilderCodePayload {
  b: string; // Builder address (must hold >= 100 USDC in perps account)
  f: number; // Fee rate in tenths of a bip (10 = 0.01%, 100 = 0.1%, max 1000 = 1.0%)
}

export interface ApproveBuilderFeePayload {
  builder: string;
  maxFeeRate: string; // e.g. "0.1%" or "1%"
  nonce?: number;
  signature?: string;
  isApproved: boolean;
  timestamp: number;
}

// Fills & Portfolio Accounting Types
export type TradeSide = 'buy_yes' | 'sell_yes' | 'buy_no';

export interface TradeFill {
  fillId: string;
  outcomeId: number;
  side: TradeSide;
  price: number;
  size: number;
  notional: number;
  takerFee: number;
  builderFee: number;
  deployerFeeShare: number;
  builderCode?: BuilderCodePayload;
  timestamp: number;
}

export interface DeskPortfolioState {
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalBuilderFeeRevenue: number;
  totalDeployerFeeRevenue: number;
  netYesPosition: number;
  fills: TradeFill[];
}

// Before & After Book Comparison Types
export interface OrderBookSideSnapshot {
  bids: L2BookLevel[];
  asks: L2BookLevel[];
  spread: number | null;
  depthUsd: number;
  status: string;
}

export interface BeforeAfterBookView {
  outcomeId: number;
  marketName: string;
  underlying: string;
  strikePrice: number;
  spotPrice: number;
  before: OrderBookSideSnapshot;
  after: OrderBookSideSnapshot;
}

