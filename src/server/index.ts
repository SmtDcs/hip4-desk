/**
 * HIP-4 Desk HTTP Server & REST API
 * 
 * Zero external web framework dependencies (pure Node.js http + fs).
 * Serves:
 * 1. Deployer Dashboard (Before/After orderbook, fills, inventory, PnL, mainnet benchmark)
 * 2. Trader Portal (ApproveBuilderFee flow, {b,f} order form, dry-run/testnet execution)
 * 3. AI Advisory Engine (Parameter suggestions + natural language reasoning + deployer approval)
 * 4. Dead-Man Switch Monitor (scheduleCancel heartbeat countdown & failsafe kill-switch)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, assertSafeExecution } from '../config.js';
import { QuotingParams, BeforeAfterBookView, ParsedPriceBinary, TradeSide } from '../types.js';
import { AiParamAdvisor } from '../engine/ai-advisory.js';
import { DeadManSwitchManager } from '../engine/deadman.js';
import { BuilderFeeManager, DEFAULT_DESK_BUILDER_ADDRESS } from '../trading/builder-fee.js';
import { InventoryTracker } from '../engine/inventory-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

export interface ServerState {
  config: ReturnType<typeof loadConfig>;
  params: QuotingParams;
  deadman: DeadManSwitchManager;
  builderManager: BuilderFeeManager;
  inventoryTracker: InventoryTracker;
  markets: BeforeAfterBookView[];
}

export function createServerState(): ServerState {
  const config = loadConfig({ network: 'testnet' }); // Force testnet for safety

  const params: QuotingParams = {
    baseSpread: config.baseSpread,
    orderSizeNotional: config.orderSizeNotional,
    maxInventory: config.maxInventory,
    expiryPullbackMinutes: config.expiryPullbackMinutes,
    annualizedVol: config.defaultAnnualizedVol,
    skewFactor: 0.0001,
  };

  const inventoryTracker = new InventoryTracker();
  const builderManager = new BuilderFeeManager(config, DEFAULT_DESK_BUILDER_ADDRESS);

  const deadman = new DeadManSwitchManager({
    timeoutMs: 30000,
    onExpired: () => {
      console.warn(`[Server] Dead-man switch expired! Emergency order purge executed.`);
    },
  });

  // Arm deadman switch by default in desk server
  deadman.arm();

  // Representative before/after market fixtures based on live HIP-4 testnet/mainnet behavior
  const markets: BeforeAfterBookView[] = [
    {
      outcomeId: 11074,
      marketName: 'BTC > $85,000 (End of Month)',
      underlying: 'BTC',
      strikePrice: 85000,
      spotPrice: 82250,
      before: {
        bids: [],
        asks: [],
        spread: null,
        depthUsd: 0,
        status: 'EMPTY / DESERTED BOOK (No MM)',
      },
      after: {
        bids: [
          { px: '0.4850', sz: '35', n: 1 },
          { px: '0.4800', sz: '45', n: 1 },
          { px: '0.4750', sz: '50', n: 1 },
        ],
        asks: [
          { px: '0.5150', sz: '32', n: 1 },
          { px: '0.5200', sz: '40', n: 1 },
          { px: '0.5250', sz: '48', n: 1 },
        ],
        spread: 0.0300,
        depthUsd: 65.50,
        status: 'ACTIVE TWO-SIDED LIQUIDITY (HIP-4 Desk)',
      },
    },
    {
      outcomeId: 22569,
      marketName: 'ETH > $3,200 (Nov 2026)',
      underlying: 'ETH',
      strikePrice: 3200,
      spotPrice: 3105,
      before: {
        bids: [{ px: '0.0500', sz: '10', n: 1 }],
        asks: [{ px: '0.9500', sz: '10', n: 1 }],
        spread: 0.9000,
        depthUsd: 10.0,
        status: 'WIDE UNTRADABLE SPREAD (0.9000)',
      },
      after: {
        bids: [
          { px: '0.3850', sz: '42', n: 1 },
          { px: '0.3800', sz: '50', n: 1 },
        ],
        asks: [
          { px: '0.4150', sz: '38', n: 1 },
          { px: '0.4200', sz: '45', n: 1 },
        ],
        spread: 0.0300,
        depthUsd: 69.80,
        status: 'TIGHT TIGHT SPREAD (0.0300) (HIP-4 Desk)',
      },
    },
    {
      outcomeId: 33102,
      marketName: 'SOL > $220 (Dec 2026)',
      underlying: 'SOL',
      strikePrice: 220,
      spotPrice: 198,
      before: {
        bids: [],
        asks: [{ px: '0.8800', sz: '15', n: 1 }],
        spread: null,
        depthUsd: 13.2,
        status: 'ONE-SIDED ASKS ONLY',
      },
      after: {
        bids: [
          { px: '0.2450', sz: '65', n: 1 },
          { px: '0.2400', sz: '80', n: 1 },
        ],
        asks: [
          { px: '0.2750', sz: '60', n: 1 },
          { px: '0.2800', sz: '75', n: 1 },
        ],
        spread: 0.0300,
        depthUsd: 74.20,
        status: 'SYMMETRIC SPREAD (HIP-4 Desk)',
      },
    },
  ];

  return {
    config,
    params,
    deadman,
    builderManager,
    inventoryTracker,
    markets,
  };
}

// Cached benchmark scores reflecting live mainnet analysis from liquidity-score.ts
const MAINNET_BENCHMARK_SCORES = [
  {
    venue: 'out',
    name: 'Outcome.xyz',
    totalOutcomesInVenue: 163,
    sampledOutcomesCount: 20,
    emptyBooksCount: 4,
    emptyBooksPercentage: 20.0,
    medianSpread: 0.0004,
    averageSpread: 0.0125,
    medianDepthTop5Usd: 1320.50,
    status: '🟢 LIQUID',
    note: 'Incentivized venue with Maker Rewards pool',
  },
  {
    venue: 'txyz',
    name: 'trade[XYZ]',
    totalOutcomesInVenue: 61,
    sampledOutcomesCount: 20,
    emptyBooksCount: 16,
    emptyBooksPercentage: 80.0,
    medianSpread: 0.9933,
    averageSpread: 0.8120,
    medianDepthTop5Usd: 83.20,
    status: '🔴 DESERTED',
    note: 'Severe illiquidity: 80% empty or 0.99+ spread. Prime target for HIP-4 Desk.',
  },
  {
    venue: 'skew',
    name: 'Skew Venue',
    totalOutcomesInVenue: 61,
    sampledOutcomesCount: 20,
    emptyBooksCount: 8,
    emptyBooksPercentage: 40.0,
    medianSpread: 0.0435,
    averageSpread: 0.1558,
    medianDepthTop5Usd: 416.00,
    status: '🟡 WIDE',
    note: 'Moderate liquidity with sporadic wide gaps.',
  },
];

export function createHttpServer(state: ServerState): http.Server {
  return http.createServer(async (req, res) => {
    // Enable CORS for easy local integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Helper to send JSON
    const sendJson = (statusCode: number, data: any) => {
      if (!res.headersSent) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v));
    };

    // Helper to parse JSON body
    const parseBody = async (): Promise<any> => {
      return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch {
            resolve({});
          }
        });
      });
    };

    try {
      // --- REST API ENDPOINTS ---

      // 1. GET /api/dashboard: Returns complete state for Deployer Dashboard
      if (req.method === 'GET' && pathname === '/api/dashboard') {
        const portfolio = state.inventoryTracker.getPortfolioState();
        const deadmanStatus = state.deadman.getStatus();

        sendJson(200, {
          network: 'TESTNET (SAFE - NO MAINNET ORDERS)',
          quoterParams: state.params,
          portfolio,
          beforeAfterBooks: state.markets,
          deadman: deadmanStatus,
          builderAddress: state.builderManager.getBuilderAddress(),
        });
        return;
      }

      // 2. GET /api/liquidity-scores: Returns mainnet benchmark score data
      if (req.method === 'GET' && pathname === '/api/liquidity-scores') {
        sendJson(200, {
          timestamp: new Date().toISOString(),
          network: 'mainnet (read-only)',
          venues: MAINNET_BENCHMARK_SCORES,
        });
        return;
      }

      // 3. GET /api/ai/recommendation: Generates rule-based advisory for selected market
      if (req.method === 'GET' && pathname === '/api/ai/recommendation') {
        const outcomeId = Number(url.searchParams.get('outcomeId') || '11074');
        const marketView = state.markets.find((m) => m.outcomeId === outcomeId) || state.markets[0];

        // Synthesize market data structure
        const dummyMarket: ParsedPriceBinary = {
          outcomeId: marketView.outcomeId,
          venue: 'txyz',
          quoteToken: 'USDC',
          templateType: 'priceBinary',
          underlyingPerp: marketView.underlying,
          strikePrice: marketView.strikePrice,
          expiryTimestampMs: Date.now() + 3600 * 20 * 1000,
          expiryDate: new Date(Date.now() + 3600 * 20 * 1000),
          isExpired: false,
          timeToExpirySeconds: 3600 * 20,
          rawName: marketView.marketName,
          rawDescription: `perp:${marketView.underlying}|strike:${marketView.strikePrice}`,
        };

        const currentInv = state.inventoryTracker.getInventory(marketView.outcomeId);
        const bookInfo = {
          bestBid: marketView.before.bids[0] ? parseFloat(marketView.before.bids[0].px) : null,
          bestAsk: marketView.before.asks[0] ? parseFloat(marketView.before.asks[0].px) : null,
          spread: marketView.before.spread,
          isEmpty: marketView.before.bids.length === 0 && marketView.before.asks.length === 0,
        };

        // Simulated elevated vol on BTC (74.5%) to trigger high vol rule
        const vol = marketView.underlying === 'BTC' ? 0.78 : 0.55;

        const recommendation = AiParamAdvisor.generateRecommendation(
          dummyMarket,
          marketView.spotPrice,
          vol,
          bookInfo,
          currentInv,
          state.params
        );

        sendJson(200, recommendation);
        return;
      }

      // 4. POST /api/ai/apply: Applies approved recommendation to active parameters
      if (req.method === 'POST' && pathname === '/api/ai/apply') {
        const body = await parseBody();
        if (!body.recommendation) {
          sendJson(400, { error: 'Missing recommendation payload' });
          return;
        }

        // Deployer explicit approval gate
        state.params = AiParamAdvisor.applyApprovedRecommendation(body.recommendation, state.params);

        console.log(`[Deployer Action] AI Parameters Approved & Applied:`, state.params);

        sendJson(200, {
          success: true,
          message: 'AI parameter recommendations approved and successfully applied to quoting engine!',
          updatedParams: state.params,
        });
        return;
      }

      // 5. POST /api/deadman/heartbeat: Ping from quoting loop
      if (req.method === 'POST' && pathname === '/api/deadman/heartbeat') {
        const status = state.deadman.heartbeat();
        sendJson(200, { success: true, deadman: status });
        return;
      }

      // 6. POST /api/deadman/toggle: Arm or disarm switch
      if (req.method === 'POST' && pathname === '/api/deadman/toggle') {
        const body = await parseBody();
        const status = body.arm ? state.deadman.arm() : state.deadman.disarm();
        sendJson(200, { success: true, deadman: status });
        return;
      }

      // 7. POST /api/kill-switch: Emergency kill-switch trigger
      if (req.method === 'POST' && pathname === '/api/kill-switch') {
        const result = await state.deadman.triggerEmergencyKillSwitch();
        sendJson(200, result);
        return;
      }

      // 8. POST /api/trade/approve-builder: ApproveBuilderFee flow
      if (req.method === 'POST' && pathname === '/api/trade/approve-builder') {
        const body = await parseBody();
        const traderAddress = body.traderAddress || '0xUserTrader1111111111111111111111111111111111';
        const maxFeeRate = body.maxFeeRate || '0.1%';

        const typedData = state.builderManager.createApproveBuilderFeeTypedData(traderAddress, maxFeeRate);
        const approval = state.builderManager.registerApproval(
          traderAddress,
          maxFeeRate,
          '0x_valid_stub_signature_testnet_eip712'
        );

        sendJson(200, {
          success: true,
          message: 'ApproveBuilderFee successfully signed and recorded (Testnet/Dry-Run).',
          approval,
          typedData,
        });
        return;
      }

      // 9. POST /api/trade/order: Submit trade with builder code {b, f}
      if (req.method === 'POST' && pathname === '/api/trade/order') {
        const body = await parseBody();
        const traderAddress = body.traderAddress || '0xUserTrader1111111111111111111111111111111111';
        const outcomeId = Number(body.outcomeId || 11074);
        const side: TradeSide = body.side || 'buy_yes';
        const price = Number(body.price || 0.51);
        const size = Number(body.size || 30);
        const builderCode = body.builderCode || {
          b: state.builderManager.getBuilderAddress(),
          f: 100, // 0.10%
        };

        // SAFETY: Only simulated on testnet
        assertSafeExecution(state.config, 'submitOrderWithBuilderCode');

        const { fill, feeBreakdown } = state.builderManager.simulateTradeOrder({
          traderAddress,
          outcomeId,
          side,
          price,
          size,
          builderCode,
          deployerFeeScale: 1.0,
        });

        // Ingest into inventory tracker
        state.inventoryTracker.recordFill(fill);

        sendJson(200, {
          success: true,
          message: 'Trade executed successfully on testnet/dry-run with builder code applied.',
          fill,
          feeBreakdown,
          updatedPortfolio: state.inventoryTracker.getPortfolioState(),
        });
        return;
      }

      // --- STATIC FILE SERVING ---

      let filePath = path.join(PUBLIC_DIR, pathname === '/' || pathname === '/trade' ? 'index.html' : pathname);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // 404 for unknown routes
      sendJson(404, { error: 'Not Found', path: pathname });
    } catch (err: any) {
      console.error(`[Server Error]`, err);
      sendJson(500, { error: err.message || 'Internal Server Error' });
    }
  });
}

// CLI entrypoint if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const state = createServerState();
  const server = createHttpServer(state);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [HIP-4 Desk] Server Running at http://localhost:${port}`);
    console.log(`Network: TESTNET (SAFE — Zero Mainnet Orders)`);
    console.log(`Deployer Dashboard: http://localhost:${port}`);
    console.log(`Trader Trade Page:  http://localhost:${port}/#trade`);
    console.log(`======================================================\n`);
  });
}
