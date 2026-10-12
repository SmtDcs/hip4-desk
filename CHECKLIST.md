# HIP-4 Desk — Feature freeze & submission checklist

**Event:** Colosseum Crypto World's Fair — Hyperliquid track  
**Feature freeze target:** 12 Eki 2026, 18:00 TSİ  
**Hard deadline:** 13 Eki 2026, 09:59 TSİ (12 Eki 2026 23:59 PT)  
**Status:** Code + docs ready; videos still pending

## Built

### Core
- [x] Direct Hyperliquid REST client (no Outcome BUSL SDK)
- [x] `priceBinary` discovery / filter (`market-discovery.ts`)
- [x] Black–Scholes binary fair value (`black-scholes.ts`)
- [x] Quoter + risk limits (`quoter.ts`, `risk-limits.ts`)
- [x] Mainnet read-only liquidity score (`liquidity-score.ts`)

### Desk / routing
- [x] Deployer panel + trader page (`public/`, `server/`)
- [x] Before/after book view, fills, inventory, PnL
- [x] Builder-code flow (`builder-fee.ts`)
- [x] Advisory engine with deployer gate (`ai-advisory.ts`)
- [x] Dead-man `scheduleCancel` + cancel-all

### Delivery
- [x] `npm run demo` end-to-end dry-run
- [x] DEMO.md / PITCH.md / SUBMISSION.md
- [x] MIT LICENSE; BUSL-free note
- [x] Optional PPN calculator only (no on-chain token)
- [x] Tests + `tsc` build

## Out of scope

| Item | Reason |
|------|--------|
| Mainnet live orders | Hard-blocked (`assertSafeExecution`) |
| Outcome.xyz BUSL SDK | Open-source track requirement |
| Heavy frontend frameworks | Keep Node + vanilla UI |
| On-chain PPN / vault | Calculator only |
| Sports / subjective markets | No external mark |
| Deploying our own venue | 500k HYPE stake out of scope |

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
