# HIP-4 Desk — Colosseum Submission

**Track:** Hyperliquid  
**Deadline:** Oct 12, 2026 23:59 PT (13 Eki 2026 09:59 TSİ)  
**Repository:** https://github.com/SmtDcs/hip4-desk  
**Pitch video (≤2–3 min):** `PITCH_VIDEO_URL=`  
**Demo video (≤3 min):** `DEMO_VIDEO_URL=`

## One-liner

- **TR:** HIP4 Tools ve hip4markets trader'lara HIP-4 satıyor; HIP-4 Desk deployer'lara likidite satıyor — perp mark'tan adil olasılık, risk limitleri, L1 dead-man ve onaylı parametre önerisi.
- **EN:** Existing tools sell HIP-4 to traders; HIP-4 Desk sells liquidity to deployers — fair binary pricing from HyperCore perp marks, risk limits, L1 dead-man, and deployer-gated advisory.

## User / problem / solution

**User:** HIP-4 outcome market deployers.

**Problem:** Non-incentivized venues (`txyz`, `skew`) show wide median spreads (~0.55–0.89). Outcome markets pay no maker rebates, so books often stay untradable and deployer fees stay near zero.

**Solution:** Open-source liquidity desk that:
1. Prices YES via Black–Scholes binary \(P(S_T > K) \approx N(d_2)\) from HyperCore marks
2. Posts two-sided quotes with inventory skew and expiry pullback
3. Suggests parameters in plain language (no unilateral AI orders)
4. Uses Hyperliquid `scheduleCancel` + kill-switch
5. Routes trader flow with builder codes `{b,f}` (10 bps) and deployer fee share

## Hyperliquid track note

Built on **HyperCore L1** Info/Exchange APIs (`outcomeMeta`, `l2Book`, `metaAndAssetCtxs`), not HyperEVM-only. Uses native HIP-4 books, `scheduleCancel`, and EIP-712 `ApproveBuilderFee`.

## Judging map (short)

| Criterion | Evidence |
|-----------|----------|
| Functionality | 8 test suites, `npm run demo`, `npm run serve`, dry-run quoter |
| Impact | Targets deployer-side illiquidity on HIP-4 |
| Novelty | Supply-side desk + mark-anchored binary pricing |
| UX | Before/after books, fills/PnL, one-click parameter apply |
| Open source | MIT, no Outcome BUSL SDK |
| Business | Spread capture + deployer fee share + builder fees |

## Package checklist

- [x] Public GitHub: https://github.com/SmtDcs/hip4-desk (MIT)
- [ ] Pitch video ≤2–3 min — `PITCH_VIDEO_URL=`
- [ ] Demo video ≤3 min — `DEMO_VIDEO_URL=`
- [x] English materials: this file, README summary, PITCH/DEMO notes
- [x] Tests green (`npm test`), clean build (`npm run build`)
- [x] MIT only; no BUSL deps

## Safety

Mainnet orders are blocked in code. `score:mainnet` is read-only. Quoting/demo run dry-run or testnet.
