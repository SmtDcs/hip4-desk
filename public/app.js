/**
 * HIP-4 Desk — deployer desk and trader routing UI.
 * Talks to the local HTTP API in src/server/index.ts.
 * The desk never signs or submits orders; every figure here is simulated in-process.
 */

let currentMarketId = 11074;
let dashboardState = null;
let currentRecommendation = null;

const fmt = {
  usd: (n, dp = 2) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`,
  px: (n) => Number(n).toFixed(4),
  num: (n, dp = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  signed: (n, dp = 2) => `${n >= 0 ? '+' : '-'}$${Math.abs(Number(n)).toFixed(dp)}`,
  pct: (n) => `${Number(n).toFixed(0)}%`,
  clock: (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false }),
};

/** Small DOM helper so no value is ever interpolated into HTML. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function replace(node, ...children) {
  if (!node) return;
  node.replaceChildren(...children);
}

// ---------------------------------------------------------------- tab routing

function switchTab(tab) {
  const deployerBtn = document.getElementById('tab-deployer-btn');
  const traderBtn = document.getElementById('tab-trader-btn');
  const deployerView = document.getElementById('view-deployer');
  const traderView = document.getElementById('view-trader');

  const showTrader = tab === 'trader';
  deployerBtn.classList.toggle('is-active', !showTrader);
  traderBtn.classList.toggle('is-active', showTrader);
  deployerBtn.setAttribute('aria-selected', String(!showTrader));
  traderBtn.setAttribute('aria-selected', String(showTrader));
  deployerView.classList.toggle('is-active', !showTrader);
  traderView.classList.toggle('is-active', showTrader);
  window.location.hash = showTrader ? 'trade' : 'deployer';
}

if (window.location.hash === '#trade') switchTab('trader');

// Keep the view in step with the URL: deep links and back/forward both land here.
window.addEventListener('hashchange', () => {
  switchTab(window.location.hash === '#trade' ? 'trader' : 'deployer');
});

// ------------------------------------------------------------------ dashboard

async function fetchDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return;
    const data = await res.json();
    dashboardState = data;

    renderKpis(data.portfolio);
    renderDeadman(data.deadman);
    renderLadders(data.beforeAfterBooks);
    renderFills(data.portfolio.fills);
  } catch (err) {
    console.error('Dashboard fetch failed:', err);
  }
}

function renderKpis(portfolio) {
  if (!portfolio) return;

  const gross = portfolio.fills.reduce((sum, f) => sum + f.notional, 0);
  document.getElementById('kpi-volume').textContent = fmt.usd(gross);

  const inv = portfolio.netYesPosition;
  document.getElementById('kpi-inventory').textContent =
    `${inv >= 0 ? '+' : '−'}${fmt.num(Math.abs(inv))} YES`;

  const pnl = document.getElementById('kpi-pnl');
  pnl.textContent = fmt.signed(portfolio.totalRealizedPnl);
  pnl.style.color = portfolio.totalRealizedPnl >= 0 ? 'var(--bid)' : 'var(--warn)';

  document.getElementById('kpi-builder-fee').textContent = fmt.usd(portfolio.totalBuilderFeeRevenue, 4);
  document.getElementById('kpi-deployer-fee').textContent = fmt.usd(portfolio.totalDeployerFeeRevenue, 4);
}

function renderDeadman(deadman) {
  if (!deadman) return;
  const plate = document.getElementById('deadman-badge');

  if (deadman.armed) {
    plate.textContent = `Dead-man ${deadman.remainingSeconds}s`;
    plate.className = deadman.remainingSeconds < 10 ? 'plate plate--danger' : 'plate plate--warn';
  } else {
    plate.textContent = 'Dead-man off';
    plate.className = 'plate';
  }
}

async function sendHeartbeat() {
  try {
    const res = await fetch('/api/deadman/heartbeat', { method: 'POST' });
    const data = await res.json();
    if (data.deadman) renderDeadman(data.deadman);
  } catch (err) {
    console.error('Heartbeat failed:', err);
  }
}

async function triggerEmergencyKill() {
  if (!confirm('Cancel every quote on the desk and stop the quoting loop?')) return;
  try {
    const res = await fetch('/api/kill-switch', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    fetchDashboard();
  } catch (err) {
    alert(`Cancel-all failed: ${err.message}`);
  }
}

// -------------------------------------------------------------------- ladders

function ladderRung(kind, size, price) {
  const rung = el('div', `rung rung--${kind}`);
  rung.appendChild(el('span', 'rung__sz rung__sz--bid', kind === 'ask' ? '' : fmt.num(size)));
  rung.appendChild(el('span', 'rung__px', fmt.px(price)));
  rung.appendChild(el('span', 'rung__sz rung__sz--ask', kind === 'bid' ? '' : fmt.num(size)));
  return rung;
}

function renderLadders(markets) {
  if (!markets || !markets.length) return;
  const market = markets.find((m) => m.outcomeId === currentMarketId) || markets[0];

  // Before: a book with nothing resting on it.
  const beforeStatus = document.getElementById('book-before-status');
  const beforeSpread = document.getElementById('book-before-spread');
  const beforeRows = document.getElementById('book-before-body');
  const beforeEmpty = market.before.bids.length === 0 && market.before.asks.length === 0;

  beforeStatus.textContent = market.before.status;
  const beforeRungs = [];

  if (beforeEmpty) {
    beforeRungs.push(el('p', 'rung--empty-note', 'No resting orders on either side.'));
    beforeSpread.textContent = 'Spread — unquotable, nothing to cross';
  } else {
    market.before.asks.forEach((a) => beforeRungs.push(ladderRung('ask', a.sz, a.px)));
    market.before.bids.forEach((b) => beforeRungs.push(ladderRung('bid', b.sz, b.px)));
    beforeSpread.textContent = market.before.spread === null
      ? 'Spread — one-sided'
      : `Spread ${fmt.px(market.before.spread)} · depth posted ${fmt.usd(market.before.depthUsd)}`;
  }
  replace(beforeRows, ...beforeRungs);

  // After: asks stacked down toward the spread, the spread itself ruled out,
  // then bids. Reading order matches a dealing ladder.
  const afterRows = document.getElementById('book-after-body');
  document.getElementById('book-after-status').textContent = market.after.status;

  const afterRungs = [];
  [...market.after.asks].reverse().forEach((a) => afterRungs.push(ladderRung('ask', a.sz, a.px)));
  const spreadRung = el('div', 'rung rung--spread');
  spreadRung.appendChild(el('span', 'rung__spread-label', `spread ${fmt.px(market.after.spread)}`));
  afterRungs.push(spreadRung);
  market.after.bids.forEach((b) => afterRungs.push(ladderRung('bid', b.sz, b.px)));
  replace(afterRows, ...afterRungs);

  document.getElementById('book-after-spread').textContent =
    `Both sides live · top-of-book depth ${fmt.usd(market.after.depthUsd)}`;
}

function onMarketChange() {
  currentMarketId = Number(document.getElementById('market-select').value);
  if (dashboardState) renderLadders(dashboardState.beforeAfterBooks);
  fetchAiRecommendation();
}

// ---------------------------------------------------------------------- fills

function renderFills(fills) {
  const body = document.getElementById('fills-table-body');
  if (!fills || fills.length === 0) {
    const tr = el('tr');
    const td = el('td', 'empty-row', 'No fills yet. Send one from the trader tab.');
    td.colSpan = 9;
    tr.appendChild(td);
    replace(body, tr);
    return;
  }

  const sideLabel = { buy_yes: 'Buy YES', sell_yes: 'Sell YES', buy_no: 'Buy NO' };
  const sideClass = { buy_yes: 'side--buy', sell_yes: 'side--sell', buy_no: 'side--buy' };

  replace(body, ...fills.map((f) => {
    const tr = el('tr');
    tr.appendChild(el('td', 'mono', f.fillId.slice(-8)));
    tr.appendChild(el('td', null, `#${f.outcomeId}`));
    tr.appendChild(el('td', `side ${sideClass[f.side] || ''}`, sideLabel[f.side] || f.side));
    tr.appendChild(el('td', 'num', `$${fmt.px(f.price)}`));
    tr.appendChild(el('td', 'num', fmt.num(f.size)));
    tr.appendChild(el('td', 'num table__strong', fmt.usd(f.notional)));
    tr.appendChild(el('td', 'num pos', fmt.usd(f.builderFee, 4)));
    tr.appendChild(el('td', 'num', fmt.usd(f.deployerFeeShare, 4)));
    tr.appendChild(el('td', null, fmt.clock(f.timestamp)));
    return tr;
  }));
}

// ------------------------------------------------------------------- advisory

async function fetchAiRecommendation() {
  try {
    const res = await fetch(`/api/ai/recommendation?outcomeId=${currentMarketId}`);
    if (!res.ok) return;
    const data = await res.json();
    currentRecommendation = data;

    document.getElementById('ai-explanation-text').textContent = data.explanation;
    document.getElementById('ai-urgency-tag').textContent =
      `Urgency ${data.urgency.toUpperCase()} · confidence ${fmt.pct(data.confidence * 100)}`;
    document.getElementById('ai-rules-triggered').textContent =
      `Rules fired: ${data.rulesTriggered.join(' · ')}`;

    const cur = data.currentParams;
    const sug = data.suggestedParams;
    const rows = [
      ['Base spread', cur.baseSpread, sug.baseSpread, (v) => v],
      ['Order notional', cur.orderSizeNotional, sug.orderSizeNotional, (v) => `$${v}`],
      ['Inventory cap', cur.maxInventory, sug.maxInventory, (v) => fmt.num(v)],
      ['Expiry pullback', cur.expiryPullbackMinutes, sug.expiryPullbackMinutes, (v) => `${v} min`],
    ];

    replace(document.getElementById('ai-diff-grid'), ...rows.map(([label, from, to, unit]) => {
      const item = el('div', 'diff__item');
      item.appendChild(el('div', 'diff__label', label));
      const val = el('div', 'diff__val');
      val.appendChild(el('span', 'diff__from', unit(from)));
      val.appendChild(el('span', 'diff__arrow', '→'));
      val.appendChild(el('span', 'diff__to', unit(to)));
      item.appendChild(val);
      return item;
    }));
  } catch (err) {
    console.error('Advisory fetch failed:', err);
  }
}

async function applyAiRecommendation() {
  if (!currentRecommendation) return;

  const btn = document.getElementById('btn-apply-ai');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Applying…';

  try {
    const res = await fetch('/api/ai/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation: currentRecommendation }),
    });
    const data = await res.json();
    if (data.success) {
      fetchDashboard();
      fetchAiRecommendation();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert(`Apply failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// --------------------------------------------------------------- mainnet snapshot

async function fetchMainnetScores() {
  try {
    const res = await fetch('/api/liquidity-scores');
    if (!res.ok) return;
    const data = await res.json();

    const statusClass = (venue) => {
      if (venue.status.includes('LIQUID')) return 'plate plate--live';
      if (venue.status.includes('DESERTED')) return 'plate plate--danger';
      return 'plate plate--warn';
    };

    replace(document.getElementById('mainnet-score-table-body'),
      ...data.venues.map((v) => {
        const tr = el('tr');
        tr.appendChild(el('td', 'mono table__strong', v.venue));
        tr.appendChild(el('td', null, v.name));
        tr.appendChild(el('td', 'num', fmt.num(v.totalOutcomesInVenue)));
        tr.appendChild(el('td', 'num', v.emptyBooksPercentage > 50 ? 'neg' : null, fmt.pct(v.emptyBooksPercentage)));
        tr.appendChild(el('td', 'num', v.medianSpread === null ? '—' : fmt.px(v.medianSpread)));
        tr.appendChild(el('td', 'num', fmt.usd(v.medianDepthTop5Usd)));
        const tag = el('td');
        tag.appendChild(el('span', statusClass(v), v.status));
        tr.appendChild(tag);
        tr.appendChild(el('td', null, v.note));
        return tr;
      }));
  } catch (err) {
    console.error('Benchmark fetch failed:', err);
  }
}

// --------------------------------------------------------------------- trader

async function approveBuilderFee() {
  const traderAddress = document.getElementById('trader-address-input').value;
  try {
    const res = await fetch('/api/trade/approve-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderAddress, maxFeeRate: '0.1%' }),
    });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || 'Approval failed.');
      return;
    }

    const status = document.getElementById('builder-approval-status');
    status.textContent = 'Approved';
    status.className = 'plate plate--live';

    const receipt = document.getElementById('approval-receipt');
    const head = el('strong', null, 'Approval recorded (stub signature)');
    const rows = [
      ['Builder', data.approval.builder],
      ['Max fee rate', data.approval.maxFeeRate],
      ['Chain', data.typedData.message.hyperliquidChain],
      ['EIP-712 chainId', data.typedData.domain.chainId],
      ['Signature', data.approval.signature],
    ].map(([k, v]) => {
      const line = el('div');
      line.appendChild(el('span', 'k', `${k}: `));
      line.appendChild(el('span', 'v', v));
      return line;
    });

    replace(receipt, head, ...rows);
    receipt.hidden = false;
  } catch (err) {
    alert(`Approval failed: ${err.message}`);
  }
}

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
      body: JSON.stringify({ outcomeId, side, price, size, traderAddress }),
    });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || 'Order rejected.');
      return;
    }

    const box = document.getElementById('trade-receipt-box');
    const head = el('strong', null, 'Fill simulated — no order was sent');
    const rows = [
      ['Fill', data.fill.fillId],
      ['Notional', `${fmt.usd(data.fill.notional)} · ${fmt.num(data.fill.size)} contracts @ $${fmt.px(data.fill.price)}`],
      ['Base protocol fee', fmt.usd(data.feeBreakdown.takerFeeUsd, 4)],
      ['Builder fee', `${fmt.usd(data.feeBreakdown.builderFeeUsd, 4)} (0.10%)`],
      ['Deployer share', `${fmt.usd(data.feeBreakdown.deployerFeeShareUsd, 4)} (scale ${data.feeBreakdown.deployerFeeScale})`],
      ['Builder code', `{ b: ${data.fill.builderCode.b}, f: ${data.fill.builderCode.f} }`],
    ].map(([k, v]) => {
      const line = el('div');
      line.appendChild(el('span', 'k', `${k}: `));
      line.appendChild(el('span', 'v', v));
      return line;
    });

    replace(box, head, ...rows);
    box.hidden = false;

    fetchDashboard();
  } catch (err) {
    alert(`Order failed: ${err.message}`);
  }
}

// --------------------------------------------------------------------- boot

fetchDashboard();
fetchAiRecommendation();
fetchMainnetScores();

setInterval(fetchDashboard, 3000);
