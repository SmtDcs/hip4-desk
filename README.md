# HIP-4 Desk

Liquidity desk for Hyperliquid [HIP-4 outcome markets](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-4-outcome-markets).

A deployer can list an outcome market in minutes. Keeping a tradable two-sided book on it is the hard part. HIP-4 Desk quotes both sides from the HyperCore perp mark (Black–Scholes binary fair value), applies inventory and expiry limits, and routes trader flow through builder codes.

## What runs on live data

- Market discovery from `outcomeMeta`, including the typed description format used for outcome templates
- Perp marks from `metaAndAssetCtxs`, including `dex`-scoped requests for HIP-3 perps such as `xyz:XYZ100`
- Realized volatility from `candleSnapshot`
- Fair value (`P(Yes) = N(d2)`) and two-sided quotes with inventory skew, expiry pullback and min-notional sizing
- A read-only mainnet venue benchmark

## What is simulated

Order placement, cancellation, EIP-712 signing, and the fills/inventory/PnL shown on the panel are simulated in-process. The desk composes the correct `scheduleCancel` and builder-code `{ b, f }` payloads but does not send them; there is no exchange client in this repository yet. `SUBMISSION.md` carries the full verified / not-implemented table.

## Quick start

```bash
npm install
npm test              # 8 suites: pricing, quoting, risk, fees, dead-man, advisory, PPN, safety
npm run build         # tsc
npm run serve         # http://localhost:3000  (deployer desk, and /#trade for trader routing)
npm run demo          # end-to-end walkthrough in the terminal
npm run quote:dry-run # live testnet discovery + marks + quotes, engine output, no orders
npm run score:mainnet # read-only venue liquidity benchmark on mainnet
```

Node.js 20+.

Data flows through Hyperliquid's public APIs only. No private key is required for any command above.

## Docs

| File | Purpose |
|------|---------|
| [SUBMISSION.md](./SUBMISSION.md) | Colosseum Hyperliquid track package, with verified / not-implemented status |
| [DEMO.md](./DEMO.md) | Demo recording outline |
| [PITCH.md](./PITCH.md) | Pitch notes (EN / TR) |
| [CHECKLIST.md](./CHECKLIST.md) | Feature freeze and submission checklist |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contributing and safety notes |

## Layout

```
src/data/       Hyperliquid REST client, market discovery, volatility
src/model/      Black–Scholes binary, optional PPN calculator
src/engine/     Quoter, risk limits, advisory, dead-man switch, inventory
src/trading/    Builder-code fee helpers
src/server/     Local HTTP API for the panel
src/scripts/    demo, liquidity score, quoter CLI, cancel-all
public/         Deployer desk and trader routing UI
test/           Unit tests (node:assert)
```

## Safety

Mainnet order placement throws via `assertSafeExecution`. `score:mainnet` is read-only, and the quoting loop forces dry-run on mainnet even if `--live` is passed. Keep mainnet keys out of `.env`; the testnet-only variable exists so a future execution path has somewhere to read from.

## License

MIT. No BUSL-licensed dependency ([LICENSE](./LICENSE)).
