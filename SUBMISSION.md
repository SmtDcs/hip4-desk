# HIP-4 Desk — Colosseum World's Fair Submission Package

> **Track:** Hyperliquid Track  
> **Submission Deadline:** **Oct 12, 2026 23:59 PT** (= **13 Eki 2026 09:59 TSİ**)  
> **Repository:** [`https://github.com/SmtDcs/hip4-desk`](https://github.com/SmtDcs/hip4-desk)  
> **Pitch Video (≤2–3 min):** `PITCH_VIDEO_URL=`  
> **Demo Video (≤3 min):** `DEMO_VIDEO_URL=`  

---

## 🚀 Project One-Liner

- **🇹🇷 TR:** *"HIP4 Tools ve hip4markets trader'lara HIP-4'ü satıyor; HIP-4 Desk ise deployer'lara likidite satıyor. Dayanak perp fiyatından türetilen adil olasılıkla, risk limitli, L1 dead-man korumalı ve AI danışmanlı otomatik kotasyon masası."*
- **🇬🇧 EN:** *"While existing tools sell HIP-4 to traders, HIP-4 Desk sells liquidity to deployers — an automated, risk-managed, AI-advised market-making desk that prices binary outcomes from live HyperCore perp marks to seed tight two-sided books from day one."*

---

## 🎯 Target User, Problem & Solution

### Target User
**HIP-4 Outcome Market Deployers** on Hyperliquid who stake 500k HYPE to create prediction venues and binary contracts, but struggle with barren orderbooks and zero trading volume.

### Problem
1. **Untradable Books:** Live mainnet reads on non-incentivized venues (`txyz`, `skew`) show **median spreads of ~0.55–0.89** — books can look filled and still be unusable for real trading.
2. **Zero Maker Rebates:** Unlike perpetual futures, Hyperliquid HIP-4 outcome markets pay **zero maker rebates**, removing organic incentives for generic market-making bots to seed liquidity.
3. **Ghost Town Venues:** Deployers lock substantial capital to deploy venues, but receive zero volume and zero protocol fees without active liquidity.

### Solution: HIP-4 Desk
A turnkey, open-source Liquidity-as-a-Service desk and order router tailored for HIP-4:
- **External Mark Fair-Value:** Calculates true mathematical probability $P(S_T > K) \approx N(d_2)$ via Black-Scholes binary pricing referencing HyperCore perp marks ($S$) and realized volatility ($\sigma$).
- **Two-Sided Quoting Engine:** Produces active Bid and Ask depth with inventory skewing, min notional enforcement ($10 USDH), and anti-gamma pullback near expiry.
- **AI Advisory with Deployer Gate:** Rule-based AI analyzes book depth, inventory skew, and volatility regime, suggesting parameter updates in natural language — strictly advisory with zero unconfirmed order authority.
- **HyperCore L1 Dead-Man Switch:** Integrates Hyperliquid exchange-level `scheduleCancel` heartbeat countdown and single-click emergency kill-switches.
- **Monetization via Builder Codes:** Trader interface routes orders with `{ b, f }` builder fees (0.10%) and shares venue deployer fees without requiring 500k HYPE stake.

---

## ⚡ Hyperliquid Track Integration Note

**HIP-4 Desk is natively integrated with HyperCore L1, NOT HyperEVM-only.**
- Integrates directly with Hyperliquid HyperCore L1 Info and Exchange APIs (`outcomeMeta`, `l2Book`, `metaAndAssetCtxs`).
- Leverages native HIP-4 outcome market orderbooks and settlement mechanics.
- Uses Hyperliquid native L1 exchange actions: `scheduleCancel` for dead-man switch protection.
- Implements Hyperliquid EIP-712 `ApproveBuilderFee` signed typed data and `{ b: builder, f: fee }` builder codes on HyperCore.

---

## 🏆 Colosseum Judging Criteria Mapping

- **Functionality (Green & Battle-Tested):**
  - 8 test suites (41 unit tests) covering pricing, quoting, AI advisory, risk bounds, dead-man switch, builder fee math, inventory, PPN, and safety locks.
  - Interactive terminal demo (`npm run demo`), web deployer dashboard & trader portal (`npm run serve`), and dry-run CLI engine (`npm run quote:dry-run`).
- **Potential Impact (Ecosystem Liquidity Catalyst):**
  - Directly tackles the single largest roadblock in HIP-4 adoption: illiquidity in non-subsidized outcome venues. Unlocks viable trading volume and fee generation for all market deployers.
- **Novelty (Supply-Side Liquidity-as-a-Service):**
  - First project targeting the *deployer (supply)* side instead of retail traders.
  - Replaces arbitrary mid-price quoting with Black-Scholes binary math anchored to live HyperCore perp marks.
- **User Experience (Deployer Cockpit & Safe UX):**
  - Minimalist, high-performance UI showing Before/After orderbooks, fill logs, inventory PnL, and live mainnet venue benchmark scores.
  - One-click deployer parameter confirmation with clear natural-language rationale for every adjustment.
- **Open-Source & Composability (%100 MIT, Zero BUSL):**
  - **Zero dependency on Outcome.xyz BUSL-1.1 SDK.**
  - Pure MIT-licensed codebase built on public Hyperliquid APIs, easily extensible by any developer in the Hyperliquid ecosystem.
- **Business Plan & Unit Economics (Sustainable MM Model):**
  - Multi-stream revenue model:
    1. Bid-Ask spread capture from market making.
    2. Proportional venue fee share via protocol `deployerFeeScale`.
    3. Recurring 10 bps builder fees via trader-routed builder codes (`{ b, f }`).

---

## 📦 Submission Package Checklist

- [ ] **Public GitHub Repository:** `https://github.com/SmtDcs/hip4-desk` (MIT — push pending Samet approval)
- [ ] **Pitch Video (≤2–3 min):** `PITCH_VIDEO_URL=` (placeholder until recorded)
- [ ] **Demo Video (≤3 min):** `DEMO_VIDEO_URL=` (placeholder until recorded)
- [x] **English Materials Included:** `SUBMISSION.md`, `README.md` (EN summary), `PITCH.md` (EN script), `DEMO.md` walkthrough.
- [x] **Verified Green Test Suite:** 8 test suites passing (`npm test`), clean build (`npm run build`).
- [x] **Zero Restrictive Licenses:** 100% MIT, zero BUSL dependencies.

---

## 🛡️ Critical Safety Notice

- **Mainnet Order Placement is STRICTLY BLOCKED:** All real mainnet order placement operations are hard-blocked at the code level via `assertSafeExecution`.
- **Mainnet Operations are Read-Only:** Scripts like `score:mainnet` only perform read-only market discovery and orderbook benchmarking.
- **Execution Environment:** All quoting execution, trades, and demo flows run strictly in dry-run mode or against Hyperliquid Testnet.
