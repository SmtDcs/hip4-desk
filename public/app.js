/**
 * HIP-4 Desk Frontend Application
 * Interacts with REST API for Dashboard, AI Advisory, Builder Fee, and Dead-Man switch.
 */

let currentMarketId = 11074;
let dashboardState = null;
let currentRecommendation = null;

// Tab switcher
function switchTab(tab) {
  const deployerTabBtn = document.getElementById('tab-deployer-btn');
  const traderTabBtn = document.getElementById('tab-trader-btn');
  const deployerView = document.getElementById('view-deployer');
  const traderView = document.getElementById('view-trader');

  if (tab === 'trader') {
    deployerTabBtn.classList.remove('active');
    traderTabBtn.classList.add('active');
    deployerView.classList.remove('active');
    traderView.classList.add('active');
    window.location.hash = 'trade';
  } else {
    traderTabBtn.classList.remove('active');
    deployerTabBtn.classList.add('active');
    traderView.classList.remove('active');
    deployerView.classList.add('active');
    window.location.hash = 'deployer';
  }
}

// Initial hash routing
if (window.location.hash === '#trade') {
  switchTab('trader');
}

// Fetch dashboard state
async function fetchDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return;
    const data = await res.json();
    dashboardState = data;

    renderKpis(data.portfolio);
    renderDeadman(data.deadman);
    renderOrderBook(data.beforeAfterBooks);
    renderFills(data.portfolio.fills);
  } catch (err) {
    console.error('Failed to fetch dashboard:', err);
  }
}

// Render KPIs
function renderKpis(portfolio) {
  if (!portfolio) return;
  const grossVol = portfolio.fills.reduce((sum, f) => sum + f.notional, 0);
  document.getElementById('kpi-volume').innerText = `$${grossVol.toFixed(2)}`;
  
  const invStr = portfolio.netYesPosition >= 0 ? `+${portfolio.netYesPosition}` : `${portfolio.netYesPosition}`;
  document.getElementById('kpi-inventory').innerText = `${invStr} YES`;

  const pnlVal = portfolio.totalRealizedPnl;
  const pnlStr = pnlVal >= 0 ? `+$${pnlVal.toFixed(2)}` : `-$${Math.abs(pnlVal).toFixed(2)}`;
  document.getElementById('kpi-pnl').innerText = pnlStr;
  document.getElementById('kpi-pnl').style.color = pnlVal >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  document.getElementById('kpi-builder-fee').innerText = `$${portfolio.totalBuilderFeeRevenue.toFixed(4)}`;
  document.getElementById('kpi-deployer-fee').innerText = `$${portfolio.totalDeployerFeeRevenue.toFixed(4)}`;
}

// Render Dead-Man Switch
function renderDeadman(deadman) {
  if (!deadman) return;
  const badge = document.getElementById('deadman-badge');
  if (deadman.armed) {
    badge.innerText = `⏳ DEAD-MAN: ${deadman.remainingSeconds}s`;
    badge.style.background = deadman.remainingSeconds < 10 ? 'rgba(239, 68, 68, 0.2)' : 'var(--accent-blue-bg)';
    badge.style.color = deadman.remainingSeconds < 10 ? 'var(--accent-red)' : 'var(--accent-blue)';
  } else {
    badge.innerText = `⏹️ DEAD-MAN: DISARMED`;
    badge.style.background = 'rgba(255,255,255,0.05)';
    badge.style.color = 'var(--text-muted)';
  }
}

// Send Heartbeat ping
async function sendHeartbeat() {
  try {
    const res = await fetch('/api/deadman/heartbeat', { method: 'POST' });
    const data = await res.json();
    if (data.deadman) {
      renderDeadman(data.deadman);
    }
  } catch (err) {
    console.error('Failed to send heartbeat:', err);
  }
}

// Trigger Emergency Kill-Switch
async function triggerEmergencyKill() {
  if (!confirm('TÜM KOTASYONLARI İPTAL ETMEK VE KİLL-SWİTCH ÇALIŞTIRMAK İSTİYOR MUSUNUZ?')) return;
  try {
    const res = await fetch('/api/kill-switch', { method: 'POST' });
    const data = await res.json();
    alert(`🚨 Acil Durum İptali: ${data.message}`);
    fetchDashboard();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Render Before / After Order Book
function renderOrderBook(markets) {
  if (!markets) return;
  const market = markets.find(m => m.outcomeId === currentMarketId) || markets[0];
  if (!market) return;

  // Before panel
  const beforeBody = document.getElementById('book-before-body');
  document.getElementById('book-before-status').innerText = market.before.status;

  if (market.before.bids.length === 0 && market.before.asks.length === 0) {
    beforeBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Defterde emir yok (Deserted Book)</td></tr>`;
    document.getElementById('book-before-spread').innerText = 'Mevcut Piyasa Spread\'i: N/A (Emir Yok)';
  } else {
    let rows = '';
    market.before.asks.forEach(a => {
      const notional = (parseFloat(a.px) * parseFloat(a.sz)).toFixed(2);
      rows += `<tr><td class="text-ask">$${parseFloat(a.px).toFixed(4)}</td><td>${a.sz}</td><td>$${notional}</td></tr>`;
    });
    market.before.bids.forEach(b => {
      const notional = (parseFloat(b.px) * parseFloat(b.sz)).toFixed(2);
      rows += `<tr><td class="text-bid">$${parseFloat(b.px).toFixed(4)}</td><td>${b.sz}</td><td>$${notional}</td></tr>`;
    });
    beforeBody.innerHTML = rows;
    const spdStr = market.before.spread !== null ? `$${market.before.spread.toFixed(4)}` : 'N/A';
    document.getElementById('book-before-spread').innerText = `Mevcut Piyasa Spread'i: ${spdStr} (Uçurum)`;
  }

  // After panel
  const afterBody = document.getElementById('book-after-body');
  document.getElementById('book-after-status').innerText = market.after.status;

  let afterRows = '';
  // Asks descending
  const sortedAsks = [...market.after.asks].reverse();
  sortedAsks.forEach(a => {
    const notional = (parseFloat(a.px) * parseFloat(a.sz)).toFixed(2);
    afterRows += `<tr><td class="text-ask">$${parseFloat(a.px).toFixed(4)}</td><td>${a.sz}</td><td>$${notional}</td></tr>`;
  });
  // Bids descending
  market.after.bids.forEach(b => {
    const notional = (parseFloat(b.px) * parseFloat(b.sz)).toFixed(2);
    afterRows += `<tr><td class="text-bid">$${parseFloat(b.px).toFixed(4)}</td><td>${b.sz}</td><td>$${notional}</td></tr>`;
  });
  afterBody.innerHTML = afterRows;

  document.getElementById('book-after-spread').innerText = `Desk Spread: $${market.after.spread.toFixed(4)} | Derinlik: ~$${market.after.depthUsd.toFixed(2)}`;
}

// On Market Selection changed
function onMarketChange() {
  const select = document.getElementById('market-select');
  currentMarketId = Number(select.value);
  if (dashboardState) {
    renderOrderBook(dashboardState.beforeAfterBooks);
  }
  fetchAiRecommendation();
}

// Render Fills Ledger
function renderFills(fills) {
  const tbody = document.getElementById('fills-table-body');
  if (!fills || fills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 1rem;">Henüz işlem gerçekleşmedi.</td></tr>`;
    return;
  }

  tbody.innerHTML = fills.map(f => {
    const timeStr = new Date(f.timestamp).toLocaleTimeString();
    const sideBadge = f.side === 'buy_yes'
      ? '<span style="color: var(--accent-green); font-weight: 600;">YES AL</span>'
      : (f.side === 'sell_yes'
        ? '<span style="color: var(--accent-red); font-weight: 600;">YES SAT</span>'
        : '<span style="color: var(--accent-amber); font-weight: 600;">NO AL</span>');

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${f.fillId.slice(-8)}</td>
        <td>Outcome #${f.outcomeId}</td>
        <td>${sideBadge}</td>
        <td style="font-family: var(--font-mono);">$${f.price.toFixed(4)}</td>
        <td style="font-family: var(--font-mono);">${f.size}</td>
        <td style="font-family: var(--font-mono); font-weight: 600;">$${f.notional.toFixed(2)}</td>
        <td style="font-family: var(--font-mono); color: #c084fc;">+$${f.builderFee.toFixed(4)}</td>
        <td style="font-family: var(--font-mono); color: #60a5fa;">+$${f.deployerFeeShare.toFixed(4)}</td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${timeStr}</td>
      </tr>
    `;
  }).join('');
}

// Fetch AI Parameter Recommendation
async function fetchAiRecommendation() {
  try {
    const res = await fetch(`/api/ai/recommendation?outcomeId=${currentMarketId}`);
    if (!res.ok) return;
    const data = await res.json();
    currentRecommendation = data;

    // Render explanation
    document.getElementById('ai-explanation-text').innerText = data.explanation;
    document.getElementById('ai-urgency-tag').innerText = `URGENCY: ${data.urgency.toUpperCase()} (Güven: %${(data.confidence * 100).toFixed(0)})`;
    document.getElementById('ai-rules-triggered').innerText = `Tetiklenen Kurallar: ${data.rulesTriggered.join(', ')}`;

    // Render diff grid
    const cur = data.currentParams;
    const sug = data.suggestedParams;

    const diffGrid = document.getElementById('ai-diff-grid');
    diffGrid.innerHTML = `
      <div class="ai-diff-item">
        <div class="ai-diff-label">Taban Spread (baseSpread)</div>
        <div class="ai-diff-val">
          <span>${cur.baseSpread}</span>
          <span class="ai-diff-arrow">→</span>
          <span style="color: #c084fc;">${sug.baseSpread}</span>
        </div>
      </div>
      <div class="ai-diff-item">
        <div class="ai-diff-label">Emir Büyüklüğü (Notional)</div>
        <div class="ai-diff-val">
          <span>$${cur.orderSizeNotional}</span>
          <span class="ai-diff-arrow">→</span>
          <span style="color: #c084fc;">$${sug.orderSizeNotional}</span>
        </div>
      </div>
      <div class="ai-diff-item">
        <div class="ai-diff-label">Envanter Tavanı (maxInventory)</div>
        <div class="ai-diff-val">
          <span>${cur.maxInventory}</span>
          <span class="ai-diff-arrow">→</span>
          <span style="color: #c084fc;">${sug.maxInventory}</span>
        </div>
      </div>
      <div class="ai-diff-item">
        <div class="ai-diff-label">Vade Geri Çekilme (Pullback)</div>
        <div class="ai-diff-val">
          <span>${cur.expiryPullbackMinutes} dk</span>
          <span class="ai-diff-arrow">→</span>
          <span style="color: #c084fc;">${sug.expiryPullbackMinutes} dk</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to fetch AI recommendation:', err);
  }
}

// Deployer applies AI recommendation
async function applyAiRecommendation() {
  if (!currentRecommendation) return;

  const btn = document.getElementById('btn-apply-ai');
  btn.disabled = true;
  btn.innerText = 'Uygulanıyor...';

  try {
    const res = await fetch('/api/ai/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation: currentRecommendation }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Başarılı!\n${data.message}`);
      fetchDashboard();
      fetchAiRecommendation();
    } else {
      alert('Hata: ' + data.error);
    }
  } catch (err) {
    alert('Hata: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>✓</span> Deployer Onayı ile Parametreleri Uygula';
  }
}

// Fetch Mainnet Liquidity Scores
async function fetchMainnetScores() {
  try {
    const res = await fetch('/api/liquidity-scores');
    if (!res.ok) return;
    const data = await res.json();

    const tbody = document.getElementById('mainnet-score-table-body');
    tbody.innerHTML = data.venues.map(v => {
      const spreadStr = v.medianSpread !== null ? v.medianSpread.toFixed(4) : 'N/A';
      return `
        <tr>
          <td><strong style="font-family: var(--font-mono);">${v.venue}</strong></td>
          <td>${v.name}</td>
          <td>${v.totalOutcomesInVenue}</td>
          <td style="color: ${v.emptyBooksPercentage > 50 ? 'var(--accent-red)' : 'inherit'}; font-weight: 600;">${v.emptyBooksPercentage}%</td>
          <td style="font-family: var(--font-mono);">${spreadStr}</td>
          <td style="font-family: var(--font-mono);">$${v.medianDepthTop5Usd.toFixed(2)}</td>
          <td><span class="badge" style="background: rgba(255,255,255,0.05);">${v.status}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${v.note}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to fetch mainnet scores:', err);
  }
}

// Trader: Approve Builder Fee
async function approveBuilderFee() {
  const traderAddress = document.getElementById('trader-address-input').value;
  try {
    const res = await fetch('/api/trade/approve-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderAddress, maxFeeRate: '0.1%' }),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('builder-approval-status').innerText = '✅ ONAYLANDI (AKTİF)';
      document.getElementById('builder-approval-status').style.background = 'var(--accent-green-bg)';
      document.getElementById('builder-approval-status').style.color = 'var(--accent-green)';
      
      const receipt = document.getElementById('approval-receipt');
      receipt.style.display = 'block';
      receipt.innerHTML = `
        <strong>✅ ApproveBuilderFee EIP-712 İmzası Başarılı:</strong><br>
        • Builder: ${data.approval.builder}<br>
        • Max Fee: ${data.approval.maxFeeRate}<br>
        • Signature: ${data.approval.signature}
      `;
    }
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Trader: Submit Trade Order with Builder Code
async function submitTradeOrder(event) {
  event.preventDefault();

  const outcomeId = Number(document.getElementById('trade-market-select').value);
  const side = document.getElementById('trade-side-select').value;
  const price = parseFloat(document.getElementById('trade-price-input').value);
  const size = parseInt(document.getElementById('trade-size-input').value, 10);
  const traderAddress = document.getElementById('trader-address-input').value;

  try {
    const res = await fetch('/api/trade/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcomeId,
        side,
        price,
        size,
        traderAddress,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const receiptBox = document.getElementById('trade-receipt-box');
      receiptBox.style.display = 'block';
      receiptBox.innerHTML = `
        <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 0.5rem;">
          İşlem Testnet/Dry-Run Üzerinde Gerçekleşti!
        </div>
        <div>• Fill ID: ${data.fill.fillId}</div>
        <div>• Tutar: $${data.fill.notional.toFixed(2)} (${data.fill.size} kontrat @ $${data.fill.price})</div>
        <div>• Taker Fee: $${data.feeBreakdown.takerFeeUsd.toFixed(4)}</div>
        <div style="color: #c084fc; font-weight: 600;">• Builder Fee (%0.10 Desk Geliri): +$${data.feeBreakdown.builderFeeUsd.toFixed(4)}</div>
        <div style="color: #60a5fa;">• Deployer Fee Payı: +$${data.feeBreakdown.deployerFeeShareUsd.toFixed(4)}</div>
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
          Builder Code { b: "${data.fill.builderCode.b}", f: ${data.fill.builderCode.f} } başarıyla uygulandı.
        </div>
      `;

      // Refresh dashboard
      fetchDashboard();
    } else {
      alert('İşlem Hatası: ' + data.error);
    }
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

// Initial bootstrap
fetchDashboard();
fetchAiRecommendation();
fetchMainnetScores();

// 3-second polling for dead-man countdown & dashboard metrics
setInterval(fetchDashboard, 3000);
