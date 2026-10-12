# HIP-4 Desk

Liquidity desk for Hyperliquid HIP-4 outcome markets.

Market deployers can list venues easily; keeping a tradable two-sided book is harder. HIP-4 Desk quotes from HyperCore perp marks (Black–Scholes binary fair value), applies inventory/risk limits, and exposes a small deployer panel plus builder-code trade routing.

**Slogan:** Market'i listele, defter boş kalmasın.

## What it does

- Fair-value quoting for `priceBinary` markets from live HyperCore mark + realized vol
- Two-sided quotes with inventory skew, min notional, and pullback near expiry
- Deployer panel (before/after book, fills, inventory, PnL) and trader page with `{b,f}` builder fee
- Rule-based parameter suggestions (advisory only; deployer must approve)
- L1 `scheduleCancel` dead-man switch + cancel-all kill switch
- Mainnet is **read-only** (orders blocked in code)

No Outcome.xyz SDK (BUSL). MIT licensed, Hyperliquid public APIs only.

## Quick start

```bash
npm install
npm test
npm run build
npm run demo          # end-to-end dry-run in the terminal
npm run serve         # http://localhost:3000  and  /#trade
npm run score:mainnet # read-only venue spread/depth sample
```

Node.js 20+.

## Docs

| File | Purpose |
|------|---------|
| [SUBMISSION.md](./SUBMISSION.md) | Colosseum Hyperliquid track package |
| [DEMO.md](./DEMO.md) | Demo recording outline |
| [PITCH.md](./PITCH.md) | Pitch notes (TR/EN) |
| [CHECKLIST.md](./CHECKLIST.md) | Freeze / submission checklist |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contrib + safety notes |

## Layout

```
src/data/       Hyperliquid REST client, discovery, vol
src/model/      Black–Scholes binary + optional PPN calculator
src/engine/     Quoter, risk, AI advisory, dead-man, inventory
src/trading/    Builder fee helpers
src/server/     Local HTTP API for the panel
src/scripts/    demo, liquidity score, quoter CLI, cancel-all
public/         Deployer + trader UI
test/           Unit tests (node:assert)
```

## Safety

Mainnet order placement is hard-blocked via `assertSafeExecution`. Quoting and trade flows are dry-run / testnet. Do not put mainnet private keys in `.env`.

## License

[MIT](./LICENSE). No BUSL dependencies.
