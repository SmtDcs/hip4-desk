# HIP-4 Desk — demo outline (~3 min)

**Shape:** problem → fair value → the empty book → advisory gate → the book the desk leaves → trader routing → risk controls.

Keep one line in the narration honest: market data and pricing are live; order placement is simulated. Say it early so the rest of the demo needs no hedging.

## Setup

```bash
npm run serve    # http://localhost:3000, trader routing at /#trade
npm run demo     # optional, parallel terminal walkthrough
```

## Timeline

### 0:00–0:25 — The problem
Deployer desk, "Where the liquidity is missing" table. Read it as a saved 9 Oct 2026 sample.
`out` quotes 0.0004; `txyz` is 0.9933 with 80% of books empty; `skew` averages 0.1558.

> Listing a market is easy. Leaving it with a book someone can actually trade is the hard part.

### 0:25–0:55 — Market and mark
Run `npm run quote:dry-run` in the terminal. Point at one market: outcome id, venue, perp mark,
strike, hours to expiry, realized vol, then fair YES from `N(d2)` — not an empty-book mid.
This is live data.

### 0:55–1:20 — Before
Back to the desk. Left ladder: "No resting orders on either side." Nothing to cross.

### 1:20–1:50 — Advisory gate
Advisory panel: urgency, rules fired, and the reasoning in plain text. Point at the diff
(`0.03 → 0.0508`). Press **Apply as deployer** and say why the gate exists: the advisor holds no
order authority.

### 1:50–2:20 — After
Right ladder fills in: asks stacked above the spread rule, bids below, both sides sized over the
$10 notional floor. Same market, same ladder, now two-sided.

### 2:20–2:45 — Trader routing
Trader routing tab. **Record approval** (say the signature is a stub), then **Simulate fill**.
Receipt shows the builder fee, the deployer share, and the protocol share at
`base × (scale + max(scale, 1))`.

### 2:45–3:05 — Risk
Heartbeat plate advances the dead-man countdown, then **Cancel all orders**.
Say what is real: the `scheduleCancel` payload and the countdown. Say what is not: the transport.

### Optional close
PPN calculator is a stretch feature: maths only, no token, no vault.

## Four points for judges

1. MIT, no BUSL SDK anywhere in the stack
2. Fair binary pricing from HyperCore marks, not book midpoints
3. Inventory, expiry and notional limits, with a deployer approval gate
4. Revenue: spread capture now, deployer fee share and 0.10% builder fee as the protocol fee lands
