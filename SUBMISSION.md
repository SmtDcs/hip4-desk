# HIP-4 Desk — Colosseum submission

**Track:** Hyperliquid (Crypto World's Fair, 14 Sep – 12 Oct 2026)
**Submission deadline:** 12 Oct 2026 23:59 PT — 13 Oct 2026 09:59 TSİ (`2026-10-13T06:59Z`)
**Repository:** https://github.com/SmtDcs/hip4-desk (MIT)
**Pitch video:** `PITCH_VIDEO_URL=`
**Demo video:** `DEMO_VIDEO_URL=`

## One-liner

Existing HIP-4 tooling sells outcome markets to traders. HIP-4 Desk sells liquidity to the deployers who list them: fair binary prices off the HyperCore perp mark, inventory and expiry limits, and a deployer approval gate.

**TR:** HIP4 Tools ve hip4markets trader'lara HIP-4 satıyor; HIP-4 Desk deployer'lara likidite satıyor — perp mark'tan adil olasılık, risk limitleri ve onay kapısı.

## What is verified, and what is not

We would rather a judge read this table than find it themselves.

| Capability | Status | How to check |
|---|---|---|
| Mainnet venue liquidity benchmark | **Live, read-only** | `npm run score:mainnet` — 327 outcomes across `out`, `txyz`, `skew` |
| Outcome metadata + `priceBinary` discovery | **Live** | 638 testnet outcomes fetched, templates parsed from the on-chain description format |
| HyperCore perp mark, incl. HIP-3 dex perps (`xyz:*`) | **Live** | `npm run quote:dry-run` — mark, realized vol and quote per market |
| Black–Scholes binary fair value | **Live maths, 8 test suites** | `npm test` |
| Two-sided quote generation, inventory skew, expiry pullback, min-notional sizing | **Live maths** | `npm run quote:dry-run`, `npm test` |
| Rule-based parameter advisory + deployer gate | **Live** | Deployer desk in `npm run serve` |
| L1 `scheduleCancel` payload and builder-code `{b, f}` payload | **Payload only** | `test/deadman.test.ts`, `test/builder-fee.test.ts` |
| Order placement on Hyperliquid | **Not implemented** | No exchange client exists; `--live` runs the tick without sending anything |
| Order cancellation / cancel-all | **Not implemented** | Logs the intent; no cancel action is sent |
| EIP-712 signing of `ApproveBuilderFee` | **Not implemented** | The typed data is composed and displayed; the signature is a stub |
| Deployer desk reads live market data | **Not wired** | The panel server holds no Hyperliquid client; the books shown are illustrative |
| Fills, inventory and PnL on the panel | **Seeded example data** | `src/engine/inventory-tracker.ts` seeds three sample fills |
| Deployer fee revenue | **Forward-looking model** | Outcome markets currently charge no trading fee ([HIP-4 docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-4-outcome-markets)); the model assumes a 3.5 bps base rate |

The product thesis rests on the three rows at the top. The rest is scaffolding we are honest about.

## User, problem, solution

**User:** teams that deploy HIP-4 outcome markets on HyperCore.

**Problem:** listing a market is easy; keeping a tradable two-sided book is not. Our own read-only sample of mainnet found `txyz` quoting a median spread of 0.99 and `skew` averaging 0.16, while `out` — the venue with real depth — sat at 0.001. Outcome markets pay no maker rebate, so no one is paid to be the resting side, and a deployer's fee line stays at zero without one.

**Solution:** an open-source liquidity desk that

1. prices YES as `P(Yes) = N(d2)` from the HyperCore perp mark and realized vol,
2. posts both sides with inventory skew, min-notional sizing and an expiry pullback,
3. proposes parameter changes in plain language and waits for the deployer to apply them,
4. carries an L1 dead-man switch design plus a cancel-all control,
5. routes trader flow through builder codes at 0.10%.

## Hyperliquid specifics

Built on **HyperCore L1** Info/Exchange shapes, not HyperEVM:

- `outcomeMeta` for the market list; outcome assets are `#` + `10 * outcome + side` per [Asset IDs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids)
- `l2Book` per outcome side, `metaAndAssetCtxs` for marks (including `dex`-scoped requests for HIP-3 perps)
- `candleSnapshot` for realized vol
- `scheduleCancel` dead-man action and the `order.builder` `{ b, f }` field per the [Exchange endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint)
- `deployerFeeScale` semantics per [HIP-4 deployer actions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-4-deployer-actions): the user pays `base × (scale + max(scale, 1))`, the deployer receives `base × scale`

## Judging map

| Criterion | Evidence |
|---|---|
| Functionality | `npm run score:mainnet` (live), `npm run quote:dry-run` (live engine), `npm run demo`, `npm run serve`, 8 test suites |
| Insight | Supply-side liquidity is the missing half of the HIP-4 market; no maker rebate means a deployer must either run this desk or leave the book empty |
| Novelty | Mark-anchored binary pricing plus a deployer-facing desk and approval gate; MIT with no BUSL SDK |
| UX | Deployer desk and trader routing, English UI, keyboard focus, reduced-motion respected, responsive to 390px |
| Business | Spread capture, deployer fee share, 0.10% builder fee on routed flow |
| Traction | None yet. The panel shows seeded examples, labelled as such |

## Package checklist

- [x] Public GitHub repo, MIT, no BUSL dependency
- [x] Live read-only market data path (`score:mainnet`, `quote:dry-run`)
- [x] Tests green (`npm test`), clean build (`npm run build`)
- [x] English UI and English materials
- [x] Honest status table (above) linked from README
- [ ] Pitch video ≤ 2–3 min — `PITCH_VIDEO_URL=`
- [ ] Demo video ≤ 3 min — `DEMO_VIDEO_URL=`

## Safety

Mainnet order placement is blocked in code by `assertSafeExecution`. `score:mainnet` is read-only. Quoting and the trader flow run dry-run against public APIs. No private key is needed to run anything in this repository, and none is stored here.
