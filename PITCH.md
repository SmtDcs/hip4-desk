# HIP-4 Desk — Pitch Notları & Jüri Sunum Rehberi

---

## 🎯 Farklılaştırma Cümlesi (Temel Tez)

> **"HIP4 Tools ve hip4markets trader'lara HIP-4'ü satıyor; HIP-4 Desk ise deployer'lara likidite satıyor. Perp fiyatından türetilen adil olasılıkla, risk limitli ve AI ile açıklanan otomatik kotasyon sayesinde listelenen her outcome market'in defteri ilk günden iki taraflı olur."**

---

## 🇹🇷 Türkçe Pitch Dosyası (Detaylı Sunum)

### 1. Problem (The Market Opportunity)
- Hyperliquid'in HIP-4 standardı tahmin piyasaları ve ikili opsiyonlar için devrim niteliğinde: sıfır gas deploy, HyperCore L1 üzerinde tam teminatlı yerel defterler.
- **Acı Gerçek (Mainnet Verileriyle İspatlı):**
  - Bugün mainnet'te 3 deployer venue var (`out`, `txyz`, `skew`).
  - Hacmin ve likiditenin %94'ü teşvik programı olan `out` (Outcome.xyz) üzerinde toplanmış durumda.
  - `txyz` ve `skew` venue'larında medyan spread **0.55 – 0.89** aralığında; defter dolu görünse bile fiilen işlem yapılabilir değil.
  - **HIP-4'te Maker Rebate YOKTUR.** Protokol piyasa yapıcılara rebate ödemez. Dolayısıyla sıradan algoritmik botlar bu pazarlara kendiliğinden girmez.
  - Deployer kendi 500k HYPE stake'ini bağlamış, marketi listelemiş ama likidite sağlayamadığı için sıfır hacim ve sıfır fee geliri üretmektedir.

### 2. Çözüm: HIP-4 Desk
HIP-4 Desk, deployer'lar için anahtar teslim **"Likidite Masası & Piyasa Yapıcı Motoru"**dur.
1. **Dış Fiyat Referanslı Fair-Value:** Boş defterlerin sahte mid-fiyatına aldanmaz; HyperCore perp mark fiyatı + realize volatiliteden Black-Scholes binary call modeliyle adil fiyatı ($P(S_T > K) \approx N(d_2)$) türetir.
2. **İki Taraflı Dinamik Kotasyon:** Taban spread + envanter eğriltme (inventory skew) + gamma riskine karşı vadeye az kala geri çekilme (pullback).
3. **AI Parametre Danışmanı:** Volatilite patlamalarını, vade yakınlığını ve defter derinliğini izler; deployer'a doğal dilde açıklama ve parametre optimizasyonu önerir (Emir yetkisi deployer onayındadır).
4. **Validatör Düzeyi Güvenlik:** Hyperliquid L1 `scheduleCancel` dead-man switch ile ağ/bot kesintilerinde otomatik emir iptali; acil durum tek tık kill-switch.
5. **Trader Dağıtımı & Builder Code:** Trader'lar Desk'in trade arayüzünden işlem yaptıkça `{b, f}` builder code ile Desk'e ve deployer'a düzenli nakit akışı sağlar.

### 3. İş Modeli ve Birim Ekonomi (Nasıl Para Kazanılır?)
HIP-4'te maker rebate olmaması, gelir modelinin akıllıca kurgulanmasını gerektirir:
1. **Deployer Fee Share (Venue Gelir Paylaşımı):** HIP-4 protokolünde `deployerFeeScale` vardır (ör. 1.0x olduğunda toplanan fee'nin %50'si deployer'a kalır). HIP-4 Desk, sağladığı likidite sayesinde oluşan hacimden deployer ile gelir paylaşımı anlaşması yapar.
2. **Builder Code Geliri (`b, f`):** Trader akışı Desk arayüzü veya API'si üzerinden geçtiğinde işlem başına %0.10 (10 bps) builder ücreti Desk'e akar. Trader sadece bir kez EIP-712 onaylar.
3. **Desk-as-a-Service (Kurumsal Abonelik):** Yeni listeleme yapan kurumsal venue'lar için sabit aylık likidite yönetimi SaaS modeli.

### 4. Rekabet Analizi & Neden Biz Farklıyız?

| Kriter | hip4markets | HIP4 Tools | Outcome SDK | Chainstack Bot | **HIP-4 Desk** |
|---|---|---|---|---|---|
| **Hedef Kitle** | Trader | Trader | Geliştirici | Öğrenci/Eğitim | **Deployer (Arz)** |
| **Piyasa Yapıcılık** | ❌ Yok | ❌ Yok | ❌ Yok | İlkel (Mid-fiyat) | **✅ Fair-Value (BS Model)** |
| **Dış Perp Fiyatı** | ❌ Yok | ❌ Yok | ❌ Yok | ❌ Yok | **✅ HyperCore Perp Mark** |
| **Deployer Paneli** | ❌ Yok | ❌ Yok | ❌ Yok | ❌ Yok | **✅ Before/After + PnL** |
| **Risk Yönetimi** | ❌ Yok | ❌ Yok | Basit cancel | Ctrl+C | **✅ L1 Dead-Man + Skew + Kill** |
| **Lisanslama** | Kapalı | Kapalı | ⚠️ **BUSL-1.1** | Apache | **✅ %100 MIT Açık Kaynak** |

### 5. Neden Şimdi? (Why Now? — Colosseum Hyperliquid Track)
- Hyperliquid L1 üzerindeki en hızlı büyüyen dikeylerden biri HIP-4 tahmin piyasalarıdır.
- Ancak likidite tekeli (`out`) kırılmadıkça diğer venue'lar rekabet edemez.
- HIP-4 Desk, Colosseum World's Fair jürisinin aradığı:
  - Gerçek HyperCore/Hyperliquid entegrasyonu,
  - Ürün-pazar uyumu (Product-Market Fit),
  - Sıfır kısıtlayıcı lisans (%100 MIT composability),
  - Çalışan test edilmiş kod kriterlerini eksiksiz karşılar.

---

## 🇬🇧 Short English Pitch (For Judges & Global Audience)

### One-Liner
> **"While existing tools sell HIP-4 to traders, HIP-4 Desk sells liquidity to deployers. By deriving fair binary probabilities directly from HyperCore perp mark prices with AI-explained risk controls, we ensure every listed outcome market opens with a tight two-sided book from day one."**

### Problem
Hyperliquid's HIP-4 enables native, fully-collateralized outcome markets directly on HyperCore L1. However, **maker rebates are never paid on outcome markets**.
Live mainnet reads show liquidity clustered on the incentivized venue (`out`). On `txyz` and `skew`, **median spreads sit around 0.55–0.89** — books may not be empty, but they are barely tradable. Deployers lock capital and still get ghost-town venues.

### Solution
**HIP-4 Desk** is a complete, open-source Liquidity-as-a-Service infrastructure for HIP-4 deployers:
1. **External Fair-Value Model:** Prices binary calls via Black-Scholes $P(S_T > K) \approx N(d_2)$ using live HyperCore perp mark prices and realized volatility—no reliance on empty book mid-prices.
2. **Two-Sided Quoting Engine:** Dynamic spreads, inventory skewing, and automatic pullback before expiry to mitigate gamma risk.
3. **AI Advisory Engine:** Analyzes market volatility and depth, generating natural language suggestions with strict Deployer Approval Gates (AI cannot execute unilaterally).
4. **L1 Dead-Man Switch:** Integrates Hyperliquid L1 `scheduleCancel` heartbeat protection and single-click emergency kill-switches.
5. **Builder Code Monetization:** Captures 10 bps builder fees via EIP-712 `ApproveBuilderFee` and shares deployer fee revenue.

### Open-Source Integrity
Unlike competitors using Outcome.xyz's restrictive **BUSL-1.1** code, HIP-4 Desk is **100% MIT Licensed**, built directly on Hyperliquid public APIs, and fully composable for the ecosystem.

---

## ❓ Olası Jüri Soruları ve Cevapları (Judge Q&A Cheat Sheet)

**S: Outcome marketlerde maker rebate yoksa piyasa yapıcı nasıl kâr eder?**  
*C: HIP-4 Desk 3 kaynaktan gelir üretir: (1) İki taraflı kotasyon arasındaki spread kazancı, (2) Venue deployer'ının `deployerFeeScale` üzerinden Desk ile paylaştığı hacim bazlı gelir, (3) Desk trade arayüzünden geçen emirlerden toplanan %0.10 builder code ücreti.*

**S: AI neden doğrudan emir göndermiyor da onay bekliyor?**  
*C: Piyasa yapıcılıkta sermaye koruması 1 numaralı kuraldır. Hallusinasyon veya beklenmedik model çıktıları bir MM masasını dakikalar içinde batırabilir. AI'ın görevi volatilite ve defter anomalilerini tespit edip insan deployer'a anlaşılır gerekçeler ve parametre önerileri sunmaktır; nihai uygulama daima deployer onayına bağlıdır.*

**S: Neden spor ve seçim marketlerine kotasyon vermiyorsunuz?**  
*C: Spor ve subjektif olaylarda anlık objektif dış referans fiyatı yoktur. Desk, dayanağı HyperCore perp'lerinde işlem gören `priceBinary` marketlerine odaklanarak (ör. BTC > 85k, ETH > 3.2k) arbitraj riskini minimize eder ve matematiksel adil olasılık türetebilir.*
