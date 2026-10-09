# HIP-4 Desk — Demo Senaryosu & Video Kayıt Rehberi

> **Hedef Süre:** 3–4 Dakika  
> **Konsept:** Before → After Karşılaştırmalı Canlı Gösterim  
> **Ana Slogan:** *"Market'i listele, defter boş kalmasın."*  
> **Etkinlik:** Colosseum Crypto World's Fair — Hyperliquid Track

---

## 🎬 Demo Hazırlığı & Ekran Düzeni

### 1. Terminal ve Sunucu Kurulumu
1. **Sol Ekran / Terminal 1:**
   ```bash
   npm run serve
   # veya
   npm run desk
   ```
   Yerel port: `http://localhost:3000`

2. **Sağ Ekran / Tarayıcı:**
   - Sekme 1: `http://localhost:3000` (Deployer Masası)
   - Sekme 2: `http://localhost:3000/#trade` (Trader Alım-Satım Sayfası)

3. **Alternatif Hızlı CLI Demosu (Terminal 2):**
   ```bash
   npm run demo
   ```
   *(9 aşamalı uçtan uca akışı 10 saniyede terminalde renklendirilmiş olarak çalıştırır).*

---

## ⏱️ Adım Adım Zaman Çizelgesi & Sunum Metni

### [00:00 – 00:30] 1. Adım: Problem Ekranı (Mainnet Likidite Analizi)
- **Ekranda Ne Var:** Deployer Paneli altındaki **"Mainnet Read-Only Likidite Skoru Benchmarkı"** tablosu veya terminalde `npm run score:mainnet`.
- **Gösterilecek Metrikler:**
  - `out` (Outcome.xyz): Likit (medyan spread ~0, teşvikli).
  - `txyz`: Medyan spread **~0.89** — defter dolu görünse bile neredeyse işlem yapılamaz.
  - `skew`: Medyan spread **~0.55** — aynı problem, biraz daha az kötü.
- **Konuşma Metni:**
  > *"HIP-4'te venue açmak kolay, defteri işlem yapılabilir tutmak değil. Outcome marketlerde maker rebate yok. Canlı mainnet'te txyz ve skew'te medyan spread 0.55–0.89 bandında geziyor — trader girmiyor, deployer fee almıyor. HIP-4 Desk tam burayı kapatıyor: 'Market'i listele, defter boş kalmasın'."*

---

### [00:30 – 01:00] 2. Adım: Market Seçimi & Dış Referans Fiyatı
- **Ekranda Ne Var:** Deployer Masasında **Market Seçici** (`BTC > $85,000 End of Month`).
- **Gösterilecek Detaylar:**
  - Dayanak Varlık: BTC HyperCore Perp Mark Fiyatı ($82,250).
  - Strike: $85,000 | Kalan Vade: 48 Saat | Realize Volatilite: %55.
  - Subjektif spor/olay marketleri filtrelenir; sadece objektif `priceBinary` kotasyonu verilir.
- **Konuşma Metni:**
  > *"Desk, diğer botlar gibi defterin kendi mid fiyatına güvenmez; çünkü boş defterde mid fiyatı yoktur. HyperCore perp motorundan anlık mark fiyatını ve realize volatiliteyi alır. Black-Scholes binary call formülü $P(S_T > K) \approx N(d_2)$ ile adil olasılığı (fair value) matematiksel olarak hesaplar."*

---

### [01:00 – 01:30] 3. Adım: BEFORE — Boş / Terk Edilmiş Defter
- **Ekranda Ne Var:** Defter Karşılaştırma kartında sol taraftaki **"🔴 ÖNCE (Before HIP-4 Desk)"** paneli.
- **Görüntü:**
  - Alış (Bids): Boş
  - Satış (Asks): Boş
  - Spread: N/A (Emir Yok)
- **Konuşma Metni:**
  > *"Bakın: Market deploy edilmiş, ancak hiçbir piyasa yapıcı olmadığı için defter bomboş. Hiçbir trader buradan işlem yapamaz, deployer fee geliri elde edemez."*

---

### [01:30 – 02:00] 4. Adım: Desk ON, AI Danışmanı ve Deployer Onayı
- **Ekranda Ne Var:** Ortadaki mor **"🤖 AI Parametre Danışmanı"** kutusu.
- **Yapılacak İşlem:**
  1. AI'ın kural tabanlı önerisini ve doğal dil açıklamasını gösterin (`VOLATILITY_ELEVATED`, `DESERT_MARKET_OPPORTUNITY`).
  2. Spread'i $0.03'ten $0.05'e genişletme gerekçesini okuyun.
  3. **"✓ Deployer Onayı ile Parametreleri Uygula"** butonuna tıklayın.
- **Konuşma Metni:**
  > *"Desk devreye girdiğinde, AI Parametre Danışmanımız piyasa koşullarını inceler. Burada realize volatilite yüksek olduğu ve defter boş olduğu için spread'i hafif genişletmeyi önerdi. En kritik güvenlik kuralımız: AI'ın tek başına emir gönderme yetkisi YOKTUR. Deployer panodan öneriyi tek tıkla onaylar ve parametreler güvenle güncellenir."*

---

### [02:00 – 02:30] 5. Adım: AFTER — İki Taraflı Sıkı Kotasyon
- **Ekranda Ne Var:** Sağ taraftaki **"🟢 SONRA (With HIP-4 Desk Active)"** paneli.
- **Görüntü:**
  - Alışlar: 3 seviye derinlik ($0.4850, $0.4800, $0.4750)
  - Satışlar: 3 seviye derinlik ($0.5150, $0.5200, $0.5250)
  - Spread: Sadece **$0.0300 (3 sent)**! Toplam Derinlik: ~$125.
- **Konuşma Metni:**
  > *"Ve sonuç: Bomboş duran defter, saniyeler içinde iki taraflı, sıkı ve işlem yapılabilir bir derinliğe kavuştu. Fiyatlar HyperCore perp fiyatı değiştikçe dinamik olarak güncellenir, envanter skew'i ile pozisyon riski dengelenir."*

---

### [02:30 – 03:00] 6. Adım: Trader Akışı & Builder-Code Entegrasyonu
- **Ekranda Ne Var:** Üst menüden **"🛒 Trader Alım-Satım"** sekmesine geçin (`#trade`).
- **Yapılacak İşlem:**
  1. **"ApproveBuilderFee İmzala"** butonuna tıklayın (EIP-712 Typed Data onaylandı).
  2. **Emir Formunda:** `YES Al`, 30 kontrat @ $0.5150, Builder Code `{ "b": desk_address, "f": 100 }` görünür.
  3. **"🚀 Emri İlet"** butonuna basın.
  4. Dekontta **Builder Fee (+$0.0155)** ve **Deployer Gelir Payı (+$0.0027)** satırlarını gösterin.
  5. Deployer sekmesine dönüp **"Dolumlar ve Envanter Defteri"** tablosuna işlemin anında yansıdığını gösterin.
- **Konuşma Metni:**
  > *"Şimdi trader tarafına geçelim. Trader ana cüzdanıyla bir defaya mahsus ApproveBuilderFee imzalar. Emrini ilettiğinde {b, f} builder code otomatik iliştirilir. 500k HYPE stake gerekmez! Hem Desk recurring builder fee (%0.10) kazanır, hem de venue deployer'ı kendi fee payını tahsil eder."*

---

### [03:00 – 03:20] 7. Adım: Risk Yönetimi & Kill-Switch
- **Ekranda Ne Var:** Sağ üst köşedeki **"⏳ DEAD-MAN: 30s"** sayacı ve **"🚨 KILL-SWITCH"** butonu.
- **Yapılacak İşlem:**
  1. Heartbeat butonuna basarak sayacın yenilendiğini gösterin (Hyperliquid L1 `scheduleCancel`).
  2. Kırmızı **KILL-SWITCH** butonuna basın veya terminalde `npm run cancel-all` çalıştırın.
  3. Tüm açık emirlerin tek tıkla validatör seviyesinde iptal edildiğini doğrulayın.
- **Konuşma Metni:**
  > *"Piyasa yapıcılıkta güvenlik esastır. Desk, Hyperliquid L1 validatör seviyesinde 'scheduleCancel' dead-man switch kullanır. Sunucu çökse bile 30 saniye içinde emirler iptal olur. Acil durumlarda deployer tek tıkla kill-switch'e basarak tüm emirleri milisaniyeler içinde iptal edebilir."*

---

### [03:20 – 03:45] 8. Adım: (Stretch) PPN Sepet Simülatörü & Kapanış
- **Ekranda Ne Var:** Terminalde `npm run demo` çıktısının 10. adımı veya slayt.
- **Konuşma Metni:**
  > *"Son olarak yapılandırılmış ürünler için geliştirdiğimiz PPN hesaplayıcı modülümüz: Deployer birden fazla outcome'u %90 anapara korumalı tek bir not halinde paketleyebilir. 0 temerrüt riskiyle +%24 getiri potansiyeli sunar.*
  >
  > *Özetle: HIP4 Tools ve hip4markets trader'lara araç satarken, HIP-4 Desk deployer'lara likidite satıyor. BUSL kodu içermeyen, %100 açık kaynak MIT lisanslı HIP-4 Desk, Hyperliquid ekosisteminde yeni prediction venue'larının can damarıdır. Teşekkürler!"*

---

## 💡 Jüriye Vurgulanacak 4 Ana Teknik Nokta

1. **Açık Kaynak Bütünlüğü:** Outcome.xyz SDK (BUSL-1.1) kullanılmamıştır; saf Node.js + Hyperliquid REST API mimarisiyle sıfır tescilli kısıtlama.
2. **Matematiksel Sağlamlık:** Black-Scholes binary model, realize volatilite penceresi ve envanter eğriltme (inventory skew).
3. **Sermaye Güvenliği:** Mainnet'e kesinlikle emir gönderilmez (`assertSafeExecution`), L1 validatör seviyesinde Dead-Man Switch ve anında kill-switch.
4. **Gerçek İş Modeli:** Sadece bot değil; Deployer Fee Scale gelir paylaşımı + Builder Code (%0.10) nakit akış mekanizması.
