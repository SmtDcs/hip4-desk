# HIP-4 Desk — Feature Freeze & Teslim Kontrol Listesi (Checklist)

> **Etkinlik:** Colosseum Crypto World's Fair — Hyperliquid Track  
> **Feature Freeze Hedefi:** 12 Ekim 2026, 18:00 TSİ  
> **Resmi Son Teslim Tarihi:** 13 Ekim 2026, 09:59 TSİ *(12 Ekim 2026 23:59 PT)*  
> **Durum:** ✅ Kod + doküman doğrulandı — ⏳ public repo push + video kaydı Samet'te

---

## 📋 1. Günlük Gelişim & Modül Doğrulama

### Gün 1: Çekirdek Quoting & Veri Katmanı
- [x] **Açık Kaynak Veri İstemcisi:** `@outcome.xyz/hip4` (BUSL-1.1) kullanılmadı. Saf Hyperliquid REST API istemcisi (`src/data/hl-client.ts`).
- [x] **Pazar Keşfi & Filtreleme:** `outcomeMeta` içinden subjektif spor/olaylar filtrelenip sadece `priceBinary` dayanaklı kontratlar ayrıştırıldı (`src/data/market-discovery.ts`).
- [x] **Black-Scholes Binary Modeli:** HyperCore perp mark fiyatı ($S$), strike ($K$), kalan süre ($T$) ve realize volatilite ($\sigma$) ile $P(S_T > K) \approx N(d_2)$ formülü (`src/model/black-scholes.ts`).
- [x] **Dinamik Quoter & Risk Limitleri:** Taban spread, envanter tavanı (inventory cap), envanter eğriltme (inventory skew) ve vadeye az kala geri çekilme (anti-gamma) (`src/engine/quoter.ts`, `src/engine/risk-limits.ts`).
- [x] **Mainnet Read-Only Likidite Analizi:** `out`, `txyz`, `skew` venue'larının medyan spread ve derinlik raporu (`src/scripts/liquidity-score.ts`).

### Gün 2: Deployer Paneli, Builder Fee, AI Advisory & Dead-Man Switch
- [x] **Deployer Paneli (Hafif Web UI):** Sıfır ağır framework bağımlılığı; vanilla HTML/CSS/JS + Node yerel HTTP sunucusu (`src/server/index.ts`, `public/`).
- [x] **Before vs After Defter Görünümü:** Boş/terk edilmiş defter ile Desk'in iki taraflı sıkı kotasyonu yan yana.
- [x] **Dolum, Envanter ve PnL Takibi:** Net YES pozisyonu, spread PnL'i, toplanan Builder Fee ve Deployer Fee gelir payları (`src/engine/inventory-tracker.ts`).
- [x] **Trader Builder-Code Yönlendirmesi:** Trader bir kez EIP-712 `ApproveBuilderFee` imzalar; emirlerde `{ "b": adres, "f": fee }` iliştirilir. Minimum 100 USDC perps bakiyesi kuralı teyit edildi; 500k HYPE stake gerekmez (`src/trading/builder-fee.ts`).
- [x] **AI Parametre Danışmanı (Advisory Engine):** Kural tabanlı volatilite ve gamma analizi; doğal dil açıklaması. **Emir yetkisi YOK**, Deployer Onay Kapısı zorunlu (`src/engine/ai-advisory.ts`).
- [x] **Dead-Man Switch (`scheduleCancel`):** Hyperliquid L1 validatör seviyesi otomatik iptal sayacı, heartbeat yenilemesi ve tek tık acil durum kill-switch (`src/engine/deadman.ts`, `src/scripts/cancel-all.ts`).

### Gün 3: Teslim Hazırlığı & Stretch Modülü
- [x] **Uçtan Uca Dry-Run Scripti:** `npm run demo` komutu tek tıkla 10 adımlı akışı terminalde çalıştırır (`src/scripts/demo-flow.ts`).
- [x] **Demo Senaryo Rehberi (`DEMO.md`):** 3-4 dakikalık video kayıt çizelgesi, ekran yerleşimi, konuşma metinleri ve jüri odak noktaları.
- [x] **Pitch Sunum Notları (`PITCH.md`):** Türkçe kapsamlı pitch + İngilizce one-liner/video script, birim ekonomi ve jüri S&C rehberi.
- [x] **Açık Kaynak & Lisans Bildirimi:** `LICENSE` ve `README.md` dosyalarında MIT Lisansı ve Outcome SDK / BUSL içermediği açıkça vurgulandı.
- [x] **Stretch Hedef (PPN & Basket Hesaplayıcı):** Çoklu outcome'lu anapara korumalı not (PPN) matematik simülasyonu eklendi (`src/model/basket-ppn.ts`). **Sadece hesaplayıcı/simülasyon; akıllı kontrat veya token YOKTUR.**
- [x] **Testler & Derleme:** 8 test süiti (41 birim testi) yeşil; `tsc` derlemesi sıfır hata.

---

## 🚫 Kesin Kapsam Dışı Sınırları (Out of Scope Guardrails)

Aşağıdaki maddeler Colosseum kuralları ve güvenlik protokolü gereğince **kapsam dışı** bırakılmış ve kod seviyesinde engellenmiştir:

| Madde | Durum | Gerekçe / Açıklama |
|---|---|---|
| **Mainnet'e Gerçek Emir** | 🛑 **KESİNLİKLE YASAK** | `assertSafeExecution` fonksiyonu ile kod seviyesinde engellendi. Sadece testnet ve dry-run. |
| **Outcome.xyz BUSL-1.1 SDK** | 🛑 **YASAK** | Açık kaynak jüri kriteri gereği tamamen bağımsız HL REST API ile yazıldı. |
| **ROLET** | 🛑 **KAPSAM DIŞI** | Yarışma kurallarına ve temel plana sadık kalındı. |
| **Yeni Ağır Framework'ler** | 🛑 **KAPSAM DIŞI** | React/Next/Tailwind eklenmedi; hafif Node.js + Vanilla Web UI korundu. |
| **Gerçek PPN / Sepet Token'ı** | 🛑 **KAPSAM DIŞI** | Yalnızca matematik simülasyonu/hesaplayıcı yapıldı; zincir üstü token veya vault çıkarılmadı. |
| **Spor / Subjektif Marketler** | 🛑 **KAPSAM DIŞI** | Dış referans fiyatı olmayan subjektif olaylar filtrelendi; sadece `priceBinary` kotasyonu yapıldı. |
| **Kendi Venue'muzu Deploy Etmek** | 🛑 **KAPSAM DIŞI** | 500k HYPE stake ve validatör onay süreci gerektirdiği için mevcut venue'lar üzerinden kotasyon hedeflendi. |

---

## 🧪 Test & Derleme Kontrol Tablosu

Aşağıdaki komutların tamamı temiz ve yeşil çalışmaktadır:

```bash
# 1. Tüm Test Süitlerini Çalıştır (8 süit, 41 test)
npm test
# Çıktı: 🎉 All tests passed successfully!

# 2. TypeScript Derlemesi
npm run build
# Çıktı: Sıfır hata ile dist/ klasörüne derleme

# 3. Uçtan Uca Demo Akışı
npm run demo
# Çıktı: 10 adımlı görsel akış hatasız tamamlanır

# 4. Mainnet Read-Only Analizi
npm run score:mainnet
# Çıktı: Canlı Hyperliquid mainnet analizi

# 5. Yerel Sunucu
npm run serve
# Çıktı: http://localhost:3000 üzerinden deployer ve trader arayüzü
```

---

## 📦 Teslim Paketi Bileşenleri (Submission Checklist)

- [ ] **Açık Kaynak Kod Deposu:** GitHub public repo (MIT) — henüz push yok; Samet onayı bekleniyor.
- [x] **Dokümantasyon:**
  - `README.md`, `DEMO.md`, `PITCH.md`, `CHECKLIST.md`, `SUBMISSION.md`, `CONTRIBUTING.md`
- [ ] **Video Kaydı:** Pitch ≤2–3 dk + Demo ≤3 dk — henüz çekilmedi (`PITCH_VIDEO_URL=` / `DEMO_VIDEO_URL=`).
- [x] **Submission Formu Bilgileri (hazır metin):**
  - Track: Hyperliquid Track
  - Proje: HIP-4 Desk
  - Slogan: *"Market'i listele, defter boş kalmasın."*
  - Lisans: MIT
