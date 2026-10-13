# HIP-4 Desk — Feature freeze & submission checklist

**Event:** Colosseum Crypto World's Fair — Hyperliquid track  
**Feature freeze target:** 12 Eki 2026, 18:00 TSİ  
**Hard deadline:** 13 Eki 2026, 09:59 TSİ (12 Eki 2026 23:59 PT)  
**Status:** Code + docs ready; videos still pending. English UI. See SUBMISSION.md for the verified / not-implemented table.

## Built

### Core
- [x] Direct Hyperliquid REST client (no Outcome BUSL SDK)
- [x] `priceBinary` discovery / filter (`market-discovery.ts`)
- [x] HIP-3 `dex`-scoped perp marks, so `xyz:*` underlyings resolve
- [x] Black–Scholes binary fair value (`black-scholes.ts`)
- [x] Quoter + risk limits (`quoter.ts`, `risk-limits.ts`)
- [x] Mainnet read-only liquidity score (`liquidity-score.ts`)

### Desk / routing
- [x] Deployer desk + trader routing, English, responsive (`public/`, `server/`)
- [x] Before/after book ladder, fills, inventory, PnL (example data, labelled)
- [x] Builder-code fee model per the documented `deployerFeeScale` rule
- [x] Correct EIP-712 domain for `ApproveBuilderFee` (payload composed, not signed)
- [x] Advisory engine with deployer gate (`ai-advisory.ts`)
- [x] Dead-man `scheduleCancel` payload + cancel-all control

### Delivery
- [x] `npm run demo` end-to-end dry-run
- [x] DEMO.md / PITCH.md / SUBMISSION.md
- [x] MIT LICENSE; BUSL-free note
- [x] Optional PPN calculator only (no on-chain token)
- [x] Tests + `tsc` build

## Out of scope

| Item | Reason |
|------|--------|
| Order placement / cancellation transport | Not implemented; payloads and controls exist, no exchange client |
| EIP-712 signing | Payload composed and displayed; no signer wired |
| Live market data in the panel | Desk server holds no Hyperliquid client; the ladder is illustrative |
| Deploying our own venue | Deployer staking requirement is out of scope |
| Outcome.xyz BUSL SDK | Open-source track requirement |
| Heavy frontend frameworks | Keep Node + vanilla UI |
| On-chain PPN / vault | Calculator only |
| Sports / subjective markets | No external mark |

## Verify locally

```bash
npm test
npm run build
npm run demo
npm run score:mainnet   # read-only
npm run serve           # http://localhost:3000
```

## Submission package

- [x] Public repo: https://github.com/SmtDcs/hip4-desk
- [x] Docs: README, DEMO, PITCH, CHECKLIST, SUBMISSION, CONTRIBUTING
- [ ] Pitch video ≤2–3 min (`PITCH_VIDEO_URL=`)
- [ ] Demo video ≤3 min (`DEMO_VIDEO_URL=`)
- [x] Form copy ready: Hyperliquid track · HIP-4 Desk · *"Market'i listele, defter boş kalmasın."* · MIT
