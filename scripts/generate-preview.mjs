/**
 * data/products.json からローカルプレビューHTMLを生成
 * 使い方: node scripts/generate-preview.mjs
 * → preview.html が生成される（.gitignoreで非公開）
 */

import fs from 'fs';
import path from 'path';

const allProducts = JSON.parse(fs.readFileSync(path.resolve('data/products.json'), 'utf8'));

// 非表示（削除済み・アフィリエイト対象外）を除外してから¥10,000以下に絞り込み
const under10k = allProducts.filter(p => p.active !== false && parseFloat(p.price_jpy) <= 10000);

// 人気順ソート: 販売数 × 評価率スコア
const products = under10k.sort((a, b) => {
  const scoreA = (Number(a.sales_count) || 0) * (parseFloat(a.evaluate_rate) || 0);
  const scoreB = (Number(b.sales_count) || 0) * (parseFloat(b.evaluate_rate) || 0);
  return scoreB - scoreA;
});

console.log(`全${allProducts.length}件 → ¥10,000以下: ${products.length}件`);

const cards = products.map(p => {
  const desc = (p.description_ja ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const descHtml = desc
    .replace(/^#{1,3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  const commissionHtml = p.commission_rate
    ? `<span class="commission">💰 アフィリエイト率 ${p.commission_rate}</span>`
    : '';

  return `
  <div class="card" data-id="${p.product_id}" data-tag="${p.tag ?? ''}" data-keyword="${p.keyword ?? ''}" data-status="undecided">
    <div class="card-img">
      <img src="${p.image_url}" alt="${p.title}" loading="lazy" onerror="this.style.display='none'">
    </div>
    <div class="status-badge"></div>
    <div class="card-body">
      <div class="tags">
        ${p.tag ? `<span class="tag tag-main">${p.tag}</span>` : ''}
        <span class="tag tag-kw">${p.keyword}</span>
      </div>
      <h2 class="title">${p.title}</h2>
      <div class="price">
        <span class="price-now">¥${Number(p.price_jpy).toLocaleString()}</span>
        <span class="price-orig">元値 ¥${Number(p.original_price_jpy).toLocaleString()}</span>
      </div>
      <div class="meta">
        <span>⭐ ${p.evaluate_rate ?? 'N/A'}</span>
        <span>📦 ${p.sales_count ?? 0}件</span>
        <span>🆔 ${p.product_id}</span>
        ${commissionHtml}
      </div>
      <div class="links">
        <a href="${p.affiliate_link}" target="_blank" class="btn-aff">アフィリエイトリンクを開く →</a>
        <button class="btn-copy" onclick="navigator.clipboard.writeText('${p.affiliate_link}').then(()=>this.textContent='✓ コピー完了')">リンクをコピー</button>
        <button class="btn-copy" onclick="navigator.clipboard.writeText('${p.image_url}').then(()=>this.textContent='✓ コピー完了')">画像URLをコピー</button>
      </div>
      <div class="decision-btns">
        <button class="btn-approve" onclick="setStatus('${p.product_id}', 'approved')">✅ 採用</button>
        <button class="btn-reject"  onclick="setStatus('${p.product_id}', 'rejected')">❌ 不採用</button>
        <button class="btn-undecide" onclick="setStatus('${p.product_id}', 'undecided')">↩ 未決定に戻す</button>
      </div>
      ${p.description_ja ? `<details class="desc"><summary>紹介文を見る</summary><div class="desc-body">${descHtml}</div></details>` : ''}
    </div>
  </div>`;
}).join('\n');

const tags = [...new Set(products.map(p => p.tag).filter(Boolean))];
const tagButtons = tags.map(t =>
  `<button class="filter-btn tag-filter" data-filter-type="tag" onclick="filterTag('${t}')">${t}</button>`
).join('');

const productsJson = JSON.stringify(products); // ¥10,000以下・人気順済み

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>商品プレビュー（ローカル）</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; background: #f5f5f5; color: #1a1a1a; }
  header { background: #e8253a; color: #fff; padding: 16px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header h1 { font-size: 1.1rem; font-weight: 700; }
  .header-meta { font-size: 0.8rem; opacity: 0.85; }
  .stats { display: flex; gap: 10px; margin-left: auto; font-size: 0.8rem; flex-wrap: wrap; }
  .stat { background: rgba(255,255,255,0.2); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .stat-approved { background: rgba(16,185,129,0.35); }
  .stat-rejected { background: rgba(0,0,0,0.2); }
  .controls { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 12px 24px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .filter-btn { border: 1px solid #e8253a; color: #e8253a; background: #fff; padding: 5px 14px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
  .filter-btn:hover, .filter-btn.active { background: #e8253a; color: #fff; }
  .filter-btn.status-filter { border-color: #6b7280; color: #6b7280; }
  .filter-btn.status-filter:hover, .filter-btn.status-filter.active { background: #6b7280; color: #fff; }
  .filter-btn.status-filter[data-status="approved"] { border-color: #10b981; color: #10b981; }
  .filter-btn.status-filter[data-status="approved"]:hover,
  .filter-btn.status-filter[data-status="approved"].active { background: #10b981; color: #fff; }
  .filter-btn.status-filter[data-status="rejected"] { border-color: #9ca3af; color: #9ca3af; }
  .filter-btn.status-filter[data-status="rejected"]:hover,
  .filter-btn.status-filter[data-status="rejected"].active { background: #9ca3af; color: #fff; }
  .search { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; width: 200px; }
  .btn-export { margin-left: auto; background: #10b981; color: #fff; border: none; padding: 6px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .btn-export:hover { background: #059669; }
  .count { font-size: 0.82rem; color: #6b7280; }
  .divider { color: #e5e7eb; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding: 24px; }
  .card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); transition: box-shadow 0.2s; position: relative; }
  .card:hover { box-shadow: 0 4px 24px rgba(232,37,58,0.15); }
  .card.hidden { display: none; }
  .card[data-status="approved"] { box-shadow: 0 0 0 3px #10b981, 0 2px 12px rgba(0,0,0,0.07); }
  .card[data-status="rejected"] { opacity: 0.45; }
  .status-badge { position: absolute; top: 10px; right: 10px; font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; display: none; z-index: 10; }
  .card[data-status="approved"] .status-badge { display: block; background: #10b981; color: #fff; content: '採用'; }
  .card[data-status="approved"] .status-badge::before { content: '✅ 採用済み'; }
  .card[data-status="rejected"] .status-badge { display: block; background: #9ca3af; color: #fff; }
  .card[data-status="rejected"] .status-badge::before { content: '❌ 不採用'; }
  .card-img { height: 200px; background: #f9f9f9; overflow: hidden; }
  .card-img img { width: 100%; height: 100%; object-fit: cover; }
  .card-body { padding: 16px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .tag { font-size: 0.72rem; padding: 2px 10px; border-radius: 999px; font-weight: 700; }
  .tag-main { background: #fee2e2; color: #e8253a; }
  .tag-kw { background: #f3f4f6; color: #6b7280; }
  .title { font-size: 0.88rem; font-weight: 700; line-height: 1.5; margin-bottom: 10px; }
  .price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .price-now { font-size: 1.3rem; font-weight: 900; color: #e8253a; }
  .price-orig { font-size: 0.78rem; color: #9ca3af; text-decoration: line-through; }
  .meta { font-size: 0.78rem; color: #6b7280; display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .commission { color: #059669; font-weight: 700; }
  .links { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .btn-aff { background: #e8253a; color: #fff; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; }
  .btn-copy { border: 1px solid #e5e7eb; background: #fff; color: #374151; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; cursor: pointer; }
  .btn-copy:hover { background: #f9fafb; }
  .decision-btns { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .btn-approve { background: #10b981; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
  .btn-approve:hover { background: #059669; }
  .btn-reject { background: #fff; color: #9ca3af; border: 1px solid #e5e7eb; padding: 8px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
  .btn-reject:hover { background: #f3f4f6; }
  .btn-undecide { background: #fff; color: #6b7280; border: 1px solid #e5e7eb; padding: 8px 18px; border-radius: 8px; font-size: 0.78rem; cursor: pointer; }
  .btn-undecide:hover { background: #f3f4f6; }
  .card[data-status="approved"] .btn-approve { background: #059669; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4); }
  .card[data-status="rejected"] .btn-reject { background: #9ca3af; color: #fff; }
  .desc summary { font-size: 0.82rem; color: #6b7280; cursor: pointer; padding: 4px 0; }
  .desc-body { font-size: 0.82rem; line-height: 1.7; color: #374151; margin-top: 8px; padding: 12px; background: #f9fafb; border-radius: 8px; }
  .desc-body h3 { font-size: 0.88rem; margin: 8px 0 4px; color: #1a1a1a; }
</style>
</head>
<body>
<header>
  <h1>🛍 商品プレビュー（ローカル専用）</h1>
  <span class="header-meta">¥10,000以下 ${products.length} 件（全${allProducts.length}件中）／ 人気順 ／ 生成: ${new Date().toLocaleString('ja-JP')}</span>
  <div class="stats">
    <span class="stat stat-approved" id="stat-approved">採用 0件</span>
    <span class="stat" id="stat-undecided">未決定 ${products.length}件</span>
    <span class="stat stat-rejected" id="stat-rejected">不採用 0件</span>
  </div>
</header>
<div class="controls">
  <button class="filter-btn active" onclick="filterTag(null)">すべて</button>
  ${tagButtons}
  <span class="divider">｜</span>
  <button class="filter-btn status-filter active" data-status="all" onclick="filterStatus('all')">全ステータス</button>
  <button class="filter-btn status-filter" data-status="approved" onclick="filterStatus('approved')">✅ 採用</button>
  <button class="filter-btn status-filter" data-status="undecided" onclick="filterStatus('undecided')">⏳ 未決定</button>
  <button class="filter-btn status-filter" data-status="rejected" onclick="filterStatus('rejected')">❌ 不採用</button>
  <input class="search" type="text" placeholder="タイトルで検索..." oninput="filterSearch(this.value)">
  <span class="count" id="count">${products.length}件表示</span>
  <button class="btn-export" onclick="exportApproved()">⬇ 採用リストをダウンロード</button>
</div>
<div class="grid" id="grid">
${cards}
</div>
<script>
const STORAGE_KEY = 'product_preview_status';
let activeTag = null;
let activeStatus = 'all';
let searchQuery = '';

const allProducts = ${productsJson};

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setStatus(id, status) {
  const state = loadState();
  state[id] = status;
  saveState(state);
  const card = document.querySelector('.card[data-id="' + id + '"]');
  if (card) card.dataset.status = status;
  updateStats();
  update();
}

function updateStats() {
  const state = loadState();
  const cards = document.querySelectorAll('.card');
  let approved = 0, rejected = 0, undecided = 0;
  cards.forEach(c => {
    const s = c.dataset.status;
    if (s === 'approved') approved++;
    else if (s === 'rejected') rejected++;
    else undecided++;
  });
  document.getElementById('stat-approved').textContent = '採用 ' + approved + '件';
  document.getElementById('stat-undecided').textContent = '未決定 ' + undecided + '件';
  document.getElementById('stat-rejected').textContent = '不採用 ' + rejected + '件';
}

function update() {
  const cards = document.querySelectorAll('.card');
  let shown = 0;
  cards.forEach(c => {
    const tagMatch = !activeTag || c.dataset.tag === activeTag;
    const statusMatch = activeStatus === 'all' || c.dataset.status === activeStatus;
    const kwMatch = !searchQuery || c.querySelector('.title').textContent.toLowerCase().includes(searchQuery);
    const show = tagMatch && statusMatch && kwMatch;
    c.classList.toggle('hidden', !show);
    if (show) shown++;
  });
  document.getElementById('count').textContent = shown + '件表示';
}

function filterTag(tag) {
  activeTag = tag;
  document.querySelectorAll('.filter-btn.tag-filter').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn:not(.tag-filter):not(.status-filter)').forEach(b => {
    if (!tag && b.textContent === 'すべて') b.classList.add('active');
  });
  if (tag) {
    document.querySelectorAll('.filter-btn.tag-filter').forEach(b => {
      if (b.textContent === tag) b.classList.add('active');
    });
  } else {
    document.querySelector('.filter-btn:not(.tag-filter):not(.status-filter)').classList.add('active');
  }
  update();
}

function filterStatus(status) {
  activeStatus = status;
  document.querySelectorAll('.filter-btn.status-filter').forEach(b => {
    b.classList.toggle('active', b.dataset.status === status);
  });
  update();
}

function filterSearch(q) {
  searchQuery = q.toLowerCase();
  update();
}

function exportApproved() {
  const state = loadState();
  const approvedIds = new Set(Object.entries(state).filter(([,v]) => v === 'approved').map(([k]) => k));
  const approved = allProducts.filter(p => approvedIds.has(String(p.product_id)));
  if (!approved.length) { alert('採用済みの商品がありません'); return; }
  const blob = new Blob([JSON.stringify(approved, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'approved-products-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// 起動時にlocalStorageからステータスを復元
(function init() {
  const state = loadState();
  document.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    if (state[id]) card.dataset.status = state[id];
  });
  updateStats();
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.resolve('preview.html'), html, 'utf8');
console.log(`✅ preview.html を生成しました（${products.length}件）`);
console.log('   ブラウザで開いてください: file://' + path.resolve('preview.html').replace(/\\/g, '/'));
