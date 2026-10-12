# HIP-4 Desk — Demo outline (~3 min)

**Hook:** Market'i listele, defter boş kalmasın.  
**Shape:** Problem → fair value → before/after book → advisory approve → trader builder fee → kill-switch.

## Setup

```bash
npm run serve    # http://localhost:3000  and  /#trade
# optional parallel:
npm run demo
```

## Timeline

### 0:00–0:30 — Problem
Show mainnet score (`npm run score:mainnet` or panel table).  
`out` is tight; `txyz` / `skew` median spreads ~0.55–0.89. No maker rebates on outcomes.

> Venue açmak kolay; işlem yapılabilir defter tutmak değil. HIP-4 Desk tam burayı kapatıyor.

### 0:30–1:00 — Market + mark
Pick a `priceBinary` (e.g. BTC above strike). Show HyperCore mark, strike, T, vol.  
Fair value from \(P(S_T > K) \approx N(d_2)\), not empty-book mid.

### 1:00–1:30 — Before
Empty / unusable book panel.

### 1:30–2:00 — Advisory + approve
Show suggested params and rationale. Click deployer approve (AI cannot place orders alone).

### 2:00–2:30 — After
Tight two-sided depth; spread updates with mark / inventory skew.

### 2:30–3:00 — Trader + builder code
`/#trade`: ApproveBuilderFee, order with `{b,f}`, show fee split and fill on deployer ledger.

### 3:00–3:20 — Risk
Dead-man countdown / heartbeat; kill-switch or `npm run cancel-all`.

### Optional close
PPN calculator is stretch math only — no on-chain token.

## Four points for judges

1. MIT, no Outcome BUSL SDK  
2. Mark-anchored binary pricing + inventory skew  
3. Mainnet orders blocked; L1 dead-man + kill-switch  
4. Revenue: spread + deployer fee share + builder fee  
