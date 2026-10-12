# HIP-4 Desk — Pitch notes

## Differentiation

HIP4 Tools and hip4markets sell HIP-4 to traders; HIP-4 Desk sells liquidity to deployers. Fair probability from perp marks, risk limits, and deployer-approved parameter advice so listed outcome markets open with a two-sided book.

## TR — short pitch

**Problem.** HIP-4 venues deploy on HyperCore, but outcome markets pay no maker rebate. Live reads: liquidity clusters on incentivized `out`; `txyz` / `skew` median spreads ~0.55–0.89 — barely tradable. Deployers stake capital and still get empty fee flow.

**Solution.** Turnkey liquidity desk:
1. Fair value from HyperCore mark + vol (Black–Scholes binary)
2. Two-sided quotes with inventory skew and expiry pullback
3. Advisory suggestions only; deployer gate required
4. L1 `scheduleCancel` + kill-switch
5. Builder-code trader routing (`{b,f}`)

**Unit economics.** Spread capture; deployer fee share via `deployerFeeScale`; ~10 bps builder fees on routed flow. Optional SaaS for institutional venues later.

**Why us.** Competitors target traders or ship BUSL SDK surface area. Desk is MIT, mark-anchored MM for the supply side.

## EN — one-liner

While existing tools sell HIP-4 to traders, HIP-4 Desk sells liquidity to deployers — fair binary probabilities from HyperCore marks, risk controls, and a deployer cockpit so every listed outcome market can open with a tight two-sided book.

## Competitive snapshot

| | hip4markets / HIP4 Tools | Outcome SDK | Chainstack sample | HIP-4 Desk |
|--|--------------------------|-------------|-------------------|------------|
| Audience | Traders | Devs | Education | Deployers |
| MM | No | No | Mid-based | Fair-value BS |
| HyperCore mark | No | — | No | Yes |
| Deployer UI | No | No | No | Yes |
| Risk | — | Basic cancel | Manual | Dead-man + skew + kill |
| License | Closed | BUSL-1.1 | Apache | MIT |

## Judge Q&A

**No maker rebate — how do you earn?** Spread, deployer fee share, builder fees on routed flow.

**Why must AI wait for approval?** MM capital risk; advisory only, deployer applies params.

**Why skip sports markets?** Need an external objective mark; Desk sticks to `priceBinary` with HyperCore underlyings.
