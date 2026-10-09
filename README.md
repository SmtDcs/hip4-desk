# HIP-4 Desk — Hyperliquid Outcome Markets Liquidity Desk

> **"Market'i listele, defter boş kalmasın."**  
> Hyperliquid HIP-4 outcome market deployer'ları için dış referans fiyatlı, risk limitli, AI danışmanlı ve açık kaynaklı likidite sağlama masası & trader yönlendirme motoru.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()
[![Test Suite](https://img.shields.io/badge/Tests-8%2F8%20Passed-brightgreen.svg)]()
[![Colosseum Hackathon](https://img.shields.io/badge/Colosseum-Hyperliquid%20Track-purple.svg)]()
[![Submission Status](https://img.shields.io/badge/Status-Submission%20Ready-brightgreen.svg)]()

---

### 🌐 What is HIP-4 Desk? (For English Readers & Judges)

> **HIP-4 Desk** is an open-source, risk-managed Liquidity Desk and Market-Making Engine purpose-built for Hyperliquid HIP-4 Outcome Markets. While existing ecosystem tools focus on retail traders, HIP-4 Desk addresses the root supply-side challenge: **non-incentivized venues often show untradable 0.55–0.89 median spreads** (even when books are not empty). By computing Black-Scholes fair probabilities directly from live HyperCore perp mark prices ($P(S_T > K) \approx N(d_2)$), applying inventory skew and gamma protections, and explaining adjustments via an advisory AI with strict deployer gates, HIP-4 Desk guarantees tight, two-sided liquidity from day one—100% MIT-licensed with zero BUSL dependencies.

---

## 🎯 Temel Farklılaştırma Tezi

> *"HIP4 Tools ve hip4markets trader'lara HIP-4'ü satıyor; HIP-4 Desk ise deployer'lara likidite satıyor. Perp fiyatından türetilen adil olasılıkla, risk limitli ve AI ile açıklanan otomatik kotasyon sayesinde listelenen her outcome market'in defteri ilk günden iki taraflı olur."*

---

## ⚡ 10 Saniyede Hızlı Başlangıç (Quickstart)

```bash
# Tek komutla demo (One-line demo):
npm install && npm run demo
```

Veya adım adım çalıştırma:

```bash
# 1. Uçtan Uca İnteraktif Demoyu Çalıştır (Terminal)
npm run demo

# 2. Deployer Masası ve Trader Web UI'ını Başlat
npm run serve
# Tarayıcıda aç: http://localhost:3000

# 3. Test Süitini Çalıştır (8 süit, 30+ birim testi)
npm test

# 4. TypeScript Projesini Derle
npm run build
```

---

## 📚 Teslim Dokümantasyonu

- 🏆 [**SUBMISSION.md**](./SUBMISSION.md): Colosseum Hyperliquid Track teslim paketi (kriter eşlemesi, video ve repo bağlantıları, teslim kontrol listesi).
- 🎬 [**DEMO.md**](./DEMO.md): 3–4 dakikalık jüri video kayıt rehberi, ekran yerleşimi ve adım adım konuşma metni.
- 🎤 [**PITCH.md**](./PITCH.md): Türkçe kapsamlı pitch rehberi, İngilizce one-liner/video scripti, birim ekonomi ve jüri S&C notları.
- 📋 [**CHECKLIST.md**](./CHECKLIST.md): Feature freeze ve teslim kontrol listesi (12 Eki 18:00 TSİ dondurma hedefi, 13 Eki 09:59 TSİ son teslim).
- 🤝 [**CONTRIBUTING.md**](./CONTRIBUTING.md): Katkı kuralları, test çalıştırma rehberi ve güvenlik prensipleri.
- 📜 [**LICENSE**](./LICENSE): MIT Lisansı ve Outcome.xyz BUSL-1.1 içermediğine dair açık kaynak taahhüdü.

---

## 📌 Mimari ve MVP Gelişim Özeti

```
========================================================================================
                          HIP-4 DESK — SYSTEM ARCHITECTURE
========================================================================================

   +--------------------------------------------------------------------------------+
   |                             DEPLOYER CONTROL PANEL                             |
   |   (Before/After Books | Fill & Inventory Ledger | PnL | AI Recommendation UI)  |
   +---------------------------------------+----------------------------------------+
                                           | Explicit Approval Gate
                                           v
   +--------------------------------------------------------------------------------+
   |                             AI ADVISORY ENGINE                                 |
   |     (Volatility Regime | Expiry Gamma Proximity | Book Depth & Skew Heuristics)    |
   +---------------------------------------+----------------------------------------+
                                           | Advisory Parameters
                                           v
   +--------------------------------------------------------------------------------+
   |                           TWO-SIDED QUOTING ENGINE                             |
   |       (Spread Multiplier | Inventory Skew | Min Notional | Gamma Pullback)     |
   +-------------------+---------------------------------------+--------------------+
                       |                                       |
                       v                                       v
   +---------------------------------------+   +------------------------------------+
   |        FAIR-VALUE MODEL (BS)          |   |       DEAD-MAN SWITCH & SAFETY     |
   |  P(YES) = N(d2) via HyperCore Mark Px |   |   L1 scheduleCancel Heartbeat ping |
   |  Realized Volatility σ & Expiry T     |   |   Emergency One-Click Kill-Switch  |
   +-------------------+-------------------+   +-----------------+------------------+
                       |                                         |
                       +-------------------+---------------------+
                                           |
                                           v
   +--------------------------------------------------------------------------------+
   |                         HYPERLIQUID HYPERCORE L1                               |
   |        - Info REST API: outcomeMeta, l2Book, metaAndAssetCtxs (Marks)          |
   |        - Exchange Actions: Order Placement, Cancellations, scheduleCancel      |
   +---------------------------------------+----------------------------------------+
                                           ^
                                           | Trader Order Flow with { b, f }
   +---------------------------------------+----------------------------------------+
   |                     BUILDER TRADE ROUTING & APPROVAL                           |
   |     (EIP-712 ApproveBuilderFee | 10 bps Builder Fee | Deployer Fee Share)      |
   +--------------------------------------------------------------------------------+
========================================================================================
```

HIP-4 Desk, tahmin piyasalarında ve ikili opsiyonlarda en büyük problem olan **likidite parçalanması ve boş emir defterleri** sorununu deployer (arz) tarafından çözer.

### Gün 1 Çekirdek (9–10 Ekim)
1. **Açık Kaynak & Bağımsız Veri Katmanı:** Outcome.xyz SDK (BUSL lisanslı) kesinlikle **kullanılmamıştır**. Doğrudan Hyperliquid Info REST API'si (`outcomeMeta`, `l2Book`, `metaAndAssetCtxs`) ile çalışır.
2. **Fair-Value Modeli (priceBinary):** Dayanak perp mark fiyatı ($S$), strike ($K$), kalan süre ($T$) ve realize volatilite ($\sigma$) kullanılarak Black-Scholes binary call formülü $P(S_T > K) \approx N(d_2)$ ile adil fiyat hesaplanır.
3. **Spor/Olay Filtresi:** Dış referans fiyatı olmayan subjektif olay ve spor marketleri elenir. Kotasyon **sadece dayanak varlıklı `priceBinary` marketlerine** verilir.
4. **Quoting Motoru:** Dinamik spread, envanter eğriltme (inventory skew), vadeye az kala otomatik geri çekilme (anti-gamma) ve envanter tavanı (inventory cap).
5. **Mainnet Read-Only Likidite Skoru:** Canlı mainnet venue'larındaki (`out`, `txyz`, `skew`) medyan spread ve derinlikleri analiz eden analitik raporu.

### Gün 2 MVP Genişletmesi (11 Ekim)
1. **Deployer Paneli (Hafif Web UI & Node HTTP Sunucu):**
   - **Before / After Defter Görünümü:** Boş/uçurum spread'li pazar defteri ile HIP-4 Desk aktif iki taraflı sıkı defter karşılaştırması.
   - **Dolum, Envanter ve PnL Özeti:** Net YES pozisyonu, gerçekleşen spread PnL'i, toplanan Builder Fee ve Deployer Fee gelir payları.
   - **Mainnet Benchmark Gösterimi:** `out`, `txyz`, `skew` venue'larının canlı likidite skoru ve pazar fırsat analizleri.
   - Sıfır ağır framework bağımlılığı (vanilla HTML/CSS/JS + yerel Node HTTP sunucusu).
2. **Builder-Code Trader Trade Sayfası:**
   - **ApproveBuilderFee Akışı:** Trader ana cüzdanıyla bir defalık EIP-712 imza yetkilendirmesi (Testnet/dry-run odaklı stub & doğrulama).
   - **Builder Code `{ b, f }` Emir Formu:** Her emirde builder adresi ve fee oranı (`f = 100` -> %0.10) iliştirilerek yönlendirme.
   - 📌 **Protokol Kuralı:** Builder hesabının Perps bakiyesinde minimum **100 USDC** bulunmalıdır. Builder code için **500k HYPE stake gerekmez** (venue deployer'larından farklı olarak açık ve erişilebilirdir).
3. **AI Parametre Danışmanı (Advisory Engine):**
   - **SADECE ÖNERİ & AÇIKLAMA:** AI modülü emir verme yetkisine sahip değildir.
   - **Deterministik Kural Tabanlı:**
     - *Yüksek Volatilite ($σ > 75\%$):* Arbitrajcı süpürmesini önlemek için taban spread'i genişletme önerisi.
     - *Vade Yakınlığı ($< 45$ dk):* Gamma ve pin-riskini sınırlamak için geri çekilme (pullback) penceresini uzatma ve spread genişletme.
     - *Boş Defter Fırsatı:* Rakipsiz pazarda cazip iki taraflı derinlik sağlamak için half-spread önerisi.
     - *Envanter Dengesizliği ($> \%65$ tavan):* Skew katsayısını artırarak ters yönlü akışı teşvik etme.
   - **Deployer Onay Kapısı:** Önerilen parametreler panodaki *"Deployer Onayı ile Parametreleri Uygula"* butonuna basılmadığı sürece aktif sisteme geçirilmez.
4. **Dead-Man Switch (`scheduleCancel`):**
   - Hyperliquid L1 validatör seviyesinde çalışan otomatik iptal emri mekanizması (`{ type: "scheduleCancel", time: now + 30s }`).
   - Quoting botu aktifken her 10 saniyede bir heartbeat göndererek süreyi uzatır.
   - Bot çökerse, bağlantı koparsa veya donarsa, validatörler belirlenen sürede tüm emirleri otomatik iptal eder.
   - Acil durum tek-tık `cancel-all` (kill-switch) entegrasyonu mevcuttur.

### Gün 3 Teslim Katmanı & Stretch MVP (12–13 Ekim)
1. **Uçtan Uca Dry-Run / Demo Betiği (`npm run demo`):**
   - Mainnet benchmark -> Pazar seçimi -> BEFORE boş defter -> Quoting motoru -> AI önerisi -> Deployer onayı -> AFTER sıkı defter -> Trader builder-code akışı -> Dead-man kill-switch -> PPN sepet hesaplayıcı akışını tek komutla terminalde sergiler.
2. **Stretch Modül: Principal-Protected Note (PPN) & Sepet Simülatörü:**
   - Çoklu outcome'lu portföyleri %90 anapara korumalı yapılandırılmış ürün haline getiren matematiksel simülatör (`src/model/basket-ppn.ts`).
   - $2^N$ çözüm olasılığını hesaplar, maksimum kayıp kesin olarak taban ile sınırlıdır (%0 iflas riski). Sadece hesaplayıcı/simülasyondur; akıllı kontrat veya token içermez.
3. **Açık Kaynak & BUSL-Free Bildirimi:**
   - Jüri açık kaynak kriteri gereğince Outcome SDK veya BUSL-1.1 bağımlılığı sıfırdır; tam MIT lisanslı ve composable altyapıdır.

---

## 🛡️ Güvenlik İlkeleri

> [!CAUTION]
> **MAINNET'E EMİR GÖNDERME KESİNLİKLE YASAKTIR VE KOD DÜZEYİNDE ENGELLENMİŞTİR.**
> 
> HIP-4 Desk'in ana kuralı sermaye korumasıdır:
> - Mainnet üzerinde çalışan tüm betikler **tamamen read-only** (salt okunur) çalışır.
> - Canlı emir yürütme teşebbüsleri `assertSafeExecution` fonksiyonu ile anında hata fırlatarak durdurulur.
> - Kotasyon motoru ve trade modülleri testnet ve dry-run odaklıdır.

---

## 💻 Kullanım ve Komutlar

### 1. Uçtan Uca İnteraktif Demo
Tüm ürün tezini ve modülleri adım adım terminalde görselleştirir:
```bash
npm run demo
```

### 2. Web Panelini Başlatma (Deployer Masası + Trader Sayfası)
Yerel HTTP sunucusunu ve REST API'yi başlatır:
```bash
npm run serve
# veya
npm run desk
```
Tarayıcınızda açın:
- **Deployer Masası:** [http://localhost:3000](http://localhost:3000) (Before/After defter, AI parametre önerisi, dolum/envanter, PnL ve mainnet skoru)
- **Trader Trade Sayfası:** [http://localhost:3000/#trade](http://localhost:3000/#trade) (ApproveBuilderFee onayı ve `{b, f}` builder code emir formu)

### 3. Mainnet Read-Only Likidite Skoru
Mainnet'teki tüm HIP-4 deployer venue'larını (`out`, `txyz`, `skew`) inceler, spread ve derinlik tablosu üretir:
```bash
npm run score:mainnet
```
*Örnek çıktı (9 Eki 2026 canlı ölçüm; sayılar değişir):*
```
-------------------------------------------------------------------------------------------------------
| VENUE    |  TOTAL |  SAMPLED |  EMPTY % |  MEDIAN SPREAD |  AVG SPREAD |  MEDIAN DEPTH | STATUS     |
-------------------------------------------------------------------------------------------------------
| out      |    163 |       15 |      20% |         0.0000 |      0.0079 |       $663.80 | 🟢 LIQUID  |
| txyz     |     61 |       15 |    13.3% |         0.8900 |      0.6150 |       $117.20 | 🟡 WIDE    |
| skew     |     61 |       15 |       0% |         0.5567 |      0.5164 |       $117.69 | 🟡 WIDE    |
-------------------------------------------------------------------------------------------------------
```
Tez: `txyz`/`skew` defterleri boş olmasa bile medyan spread 0.55–0.89 — trader için fiilen kullanılamaz.

### 4. Quoting Motoru (Dry-Run Simülasyonu)
Hyperliquid Testnet'teki aktif `priceBinary` marketlerini keşfeder, perp fiyatı ve volatiliteden kotasyon üretir:
```bash
# Tek bir döngü çalıştırıp çıktıyı inceleme:
npm run quote:dry-run -- --single-tick --limit=3

# Sürekli döngü:
npm run quote:dry-run
```

### 5. Acil Durum Kill-Switch & Dead-Man Switch
- **Manuel Kill-Switch:** Açık tüm outcome emirlerini anında iptal eder:
  ```bash
  npm run cancel-all
  ```
- **Dead-Man Switch (`scheduleCancel`):** Web panelinde veya bot çalışma döngüsünde entegredir; 30 saniye boyunca heartbeat gelmezse validatörler emirleri iptal eder.

### 6. Testleri Çalıştırma
8 test süitini (Black-Scholes, Quoting, AI Danışmanı, Dead-Man, Builder Fee, Envanter, PPN, Safety) çalıştırır:
```bash
npm test
```
*41 birim testi, harici mock kütüphanesi olmadan yerel `node:assert` ile yeşil.*

### 7. TypeScript Derleme
```bash
npm run build
```

---

## 📐 Klasör ve Modül Yapısı

```
hip4-desk/
├── LICENSE                    # MIT Açık Kaynak Lisansı (+ BUSL-free notu)
├── package.json               # Bağımlılıklar ve npm scriptleri
├── tsconfig.json              # TypeScript derleyici yapılandırması
├── .env.example               # Örnek çevre değişkenleri
├── README.md                  # Proje dokümantasyonu ve genel bakış
├── DEMO.md                    # 3-4 dakikalık demo video kayıt senaryosu
├── PITCH.md                   # Türkçe & İngilizce jüri pitch ve iş modeli rehberi
├── CHECKLIST.md               # Feature freeze & teslim kontrol listesi
├── SUBMISSION.md              # Colosseum teslim paketi (repo/video URL placeholder)
├── CONTRIBUTING.md            # Katkı + güvenlik notları
├── public/                    # Deployer Paneli ve Trader Sayfası (Hafif Web UI)
│   ├── index.html             # Vanilla UI (Deployer + Trader sekmeleri)
│   ├── style.css              # Terminal/finans temalı dark-mode stiller
│   └── app.js                 # REST API bağlantısı, AI onayı, form kontrolü
├── src/
│   ├── index.ts               # Kütüphane exportları
│   ├── types.ts               # OutcomeMeta, AI, Deadman, Builder, Fills, PPN tipleri
│   ├── config.ts              # Ağ ve risk konfigürasyonu, safety assertion
│   ├── data/
│   │   ├── hl-client.ts       # Doğrudan HL REST API istemcisi (BUSL-free)
│   │   ├── market-discovery.ts# outcomeMeta ayrıştırma, priceBinary tespiti
│   │   └── volatility.ts      # Realized vol hesaplayıcı ve fallbackler
│   ├── model/
│   │   ├── black-scholes.ts   # P(S_T > K) ≈ N(d2) binary opsiyon modeli
│   │   └── basket-ppn.ts      # Principal-Protected Note (PPN) simülatörü (Stretch H2)
│   ├── engine/
│   │   ├── risk-limits.ts     # Envanter tavanı, gamma koruması, min notional
│   │   ├── quoter.ts          # Fair value -> bid/ask spread + inventory skew
│   │   ├── runner.ts          # Quoting döngüsü (fetch -> price -> diff -> quote)
│   │   ├── ai-advisory.ts     # AI parametre danışmanı (öneri & açıklama)
│   │   ├── deadman.ts         # Dead-man switch (scheduleCancel) yöneticisi
│   │   └── inventory-tracker.ts# Envanter defteri, dolumlar, PnL muhasebesi
│   ├── trading/
│   │   └── builder-fee.ts     # ApproveBuilderFee EIP-712 ve {b, f} mekaniği
│   ├── server/
│   │   └── index.ts           # Yerel Node HTTP sunucusu ve REST API uçları
│   └── scripts/
│       ├── demo-flow.ts       # Uçtan uca 10 adımlı dry-run demo betiği
│       ├── liquidity-score.ts # Mainnet read-only likidite analizi
│       ├── run-quoter.ts      # Quoting CLI yürütücüsü
│       └── cancel-all.ts      # Kill-switch acil iptal scripti
└── test/
    ├── black-scholes.test.ts  # Fair-value binary opsiyon model testleri
    ├── quoter.test.ts         # Quoter ve risk limitleri testleri
    ├── ai-advisor.test.ts     # AI parametre önerisi ve onay kapısı testleri
    ├── deadman.test.ts        # scheduleCancel ve heartbeat testleri
    ├── builder-fee.test.ts    # Builder fee EIP-712 ve fee bölüşüm testleri
    ├── inventory.test.ts      # Pozisyon takibi ve PnL testleri
    ├── basket-ppn.test.ts     # PPN & sepet simülasyon testleri
    └── safety.test.ts         # Mainnet kilit + config fallback
```

---

## 📈 Fair-Value Matematik Modeli

HIP-4 nakit uzlaşmalı binary opsiyonlarda vade sonunda dayanak varlık fiyatı $S_T > K$ ise YES token $1.00$ değerine, aksi halde $0.00$ değerine ulaşır.

Standart Black-Scholes formülasyonu ($r \approx 0$ varsayımı altında):
$$d_1 = \frac{\ln(S / K) + \frac{1}{2} \sigma^2 T}{\sigma \sqrt{T}}$$
$$d_2 = d_1 - \sigma \sqrt{T} = \frac{\ln(S / K) - \frac{1}{2} \sigma^2 T}{\sigma \sqrt{T}}$$
$$P(\text{YES}) = N(d_2)$$
$$P(\text{NO}) = 1 - P(\text{YES})$$

Burada:
- $S$: Dayanak Hyperliquid perp mark fiyatı (`metaAndAssetCtxs` üzerinden anlık)
- $K$: Outcome tanımındaki strike fiyatı (`threshold` veya `target`)
- $T$: Yıllıklandırılmış kalan vade süresi
- $\sigma$: Dayanak varlığın yıllıklandırılmış realize volatilitesi

Fiyatlar Hyperliquid kuralı gereğince `[0.001, 0.999]` aralığına kırpılır.

---

## ⚖️ Açık Kaynak Lisansı & BUSL Muafiyeti

Bu proje **MIT Lisansı** altında lisanslanmıştır.
- Outcome.xyz'nin kısıtlayıcı **BUSL-1.1** lisanslı SDK'sı (`@outcome.xyz/hip4`) kod tabanında kesinlikle bulunmamaktadır.
- Tamamen resmi ve herkese açık Hyperliquid Info ve Exchange API'leri ile geliştirilmiştir.
- Colosseum hackathon jürisi, geliştiriciler ve ekosistem için %100 açık kaynaklı ve serbestçe birleştirilebilir (composable) bir altyapıdır.
