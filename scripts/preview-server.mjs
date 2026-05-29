/**
 * 商品プレビューサーバー（ローカル専用）
 * 使い方: node scripts/preview-server.mjs
 * → http://localhost:3001 でプレビューUI が開く
 * → 採用/不採用ボタンが即座に data/products.json に保存される
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PORT      = 3001;
const DATA_FILE = path.resolve('data/products.json');

const PRICE_TIER_GAP = 1500;
const TOP_PERCENT    = 0.30;
const NO_DEDUP_TYPES = new Set([
  'カードゲーム','チェスセット','ジグソーパズル','ダイスセット','カードスリーブ','ボードゲーム',
]);

function loadProducts() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function curate(all) {
  const under10k = all.filter(p => p.active !== false && parseFloat(p.price_jpy) <= 10000);
  const scored   = under10k
    .map(p => ({ ...p, _score: (Number(p.sales_count)||0) * (parseFloat(p.evaluate_rate)||0) }))
    .sort((a, b) => b._score - a._score);
  const topN    = Math.max(10, Math.ceil(scored.length * TOP_PERCENT));
  const popular = new Set(scored.slice(0, topN));
  const seen    = new Set();
  const result  = [];
  for (const p of scored) {
    const isPopular = popular.has(p);
    const ptype     = p.product_type ?? p.tag ?? 'その他';
    if (NO_DEDUP_TYPES.has(ptype)) {
      if (isPopular) result.push(p);
      continue;
    }
    const tier = Math.floor(parseFloat(p.price_jpy) / PRICE_TIER_GAP);
    const key  = `${ptype}_${tier}`;
    if (isPopular && !seen.has(key)) {
      seen.add(key); result.push(p);
    } else if (!isPopular && !result.some(q => (q.product_type ?? q.tag) === ptype)) {
      seen.add(key); result.push(p);
    }
  }
  return result;
}

// ── API ハンドラ ──────────────────────────────────────────
function handleApi(req, res) {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // GET /api/products → 絞り込み済みリストを返す
  if (req.method === 'GET' && pathname === '/api/products') {
    const all      = loadProducts();
    const curated  = curate(all);
    // approved フィールドを付けて返す
    const withStatus = curated.map(p => ({
      product_id:      p.product_id,
      title:           p.title_short ?? p.title,
      title_full:      p.title,
      price_jpy:       p.price_jpy,
      original_price:  p.original_price_jpy,
      image_url:       p.image_url,
      affiliate_link:  p.affiliate_link,
      evaluate_rate:   p.evaluate_rate,
      sales_count:     p.sales_count,
      commission_rate: p.commission_rate,
      product_type:    p.product_type,
      tag:             p.tag,
      approved:        p.approved ?? null,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(withStatus));
    return;
  }

  // PATCH /api/products/:id → approved 更新
  const match = pathname.match(/^\/api\/products\/(.+)$/);
  if (req.method === 'PATCH' && match) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { approved } = JSON.parse(body);
      const id       = match[1];
      const products = loadProducts();
      const product  = products.find(p => String(p.product_id) === id);
      if (!product) {
        res.writeHead(404); res.end('Not Found'); return;
      }
      product.approved = approved;
      saveProducts(products);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id, approved }));
    });
    return;
  }

  res.writeHead(404); res.end('Not Found');
}

// ── HTML UI ──────────────────────────────────────────────
const UI_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>商品プレビュー（ローカルサーバー）</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans JP','Hiragino Sans',sans-serif;background:#f5f5f5;color:#1a1a1a}
  header{background:#e8253a;color:#fff;padding:14px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  header h1{font-size:1.1rem;font-weight:700}
  .stats{display:flex;gap:8px;margin-left:auto;font-size:.8rem;flex-wrap:wrap}
  .stat{background:rgba(255,255,255,.2);border-radius:999px;padding:3px 10px;white-space:nowrap}
  .stat-ok{background:rgba(16,185,129,.4)}
  .stat-ng{background:rgba(0,0,0,.2)}
  .controls{background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 24px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .filter-btn{border:1px solid #e8253a;color:#e8253a;background:#fff;padding:5px 14px;border-radius:999px;font-size:.8rem;cursor:pointer;transition:all .15s}
  .filter-btn:hover,.filter-btn.active{background:#e8253a;color:#fff}
  .filter-btn.sf{border-color:#6b7280;color:#6b7280}
  .filter-btn.sf:hover,.filter-btn.sf.active{background:#6b7280;color:#fff}
  .filter-btn.sf[data-s="approved"]{border-color:#10b981;color:#10b981}
  .filter-btn.sf[data-s="approved"]:hover,.filter-btn.sf[data-s="approved"].active{background:#10b981;color:#fff}
  .search{border:1px solid #e5e7eb;border-radius:8px;padding:6px 12px;font-size:.85rem;width:200px}
  .count{font-size:.8rem;color:#6b7280;margin-left:auto}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;padding:20px}
  .card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07);transition:box-shadow .2s;position:relative}
  .card:hover{box-shadow:0 4px 20px rgba(232,37,58,.13)}
  .card.hidden{display:none}
  .card[data-approved="true"]{box-shadow:0 0 0 3px #10b981,0 2px 12px rgba(0,0,0,.07)}
  .card[data-approved="false"]{opacity:.4}
  .badge{position:absolute;top:10px;right:10px;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;display:none;z-index:10}
  .card[data-approved="true"] .badge{display:block;background:#10b981;color:#fff}
  .card[data-approved="true"] .badge::before{content:'✅ 採用済み'}
  .card[data-approved="false"] .badge{display:block;background:#9ca3af;color:#fff}
  .card[data-approved="false"] .badge::before{content:'❌ 不採用'}
  .card-img{height:190px;background:#f9f9f9;overflow:hidden}
  .card-img img{width:100%;height:100%;object-fit:cover}
  .card-body{padding:14px}
  .tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}
  .tag{font-size:.7rem;padding:2px 9px;border-radius:999px;font-weight:700}
  .tag-main{background:#fee2e2;color:#e8253a}
  .tag-type{background:#ede9fe;color:#7c3aed}
  .title{font-size:.95rem;font-weight:700;line-height:1.5;margin-bottom:3px}
  .title-orig{font-size:.7rem;color:#9ca3af;margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .price{display:flex;align-items:baseline;gap:8px;margin-bottom:7px}
  .price-now{font-size:1.25rem;font-weight:900;color:#e8253a}
  .price-orig{font-size:.76rem;color:#9ca3af;text-decoration:line-through}
  .meta{font-size:.76rem;color:#6b7280;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:11px}
  .commission{color:#059669;font-weight:700}
  .links{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px}
  .btn-aff{background:#e8253a;color:#fff;text-decoration:none;padding:7px 13px;border-radius:8px;font-size:.76rem;font-weight:700}
  .btn-copy{border:1px solid #e5e7eb;background:#fff;color:#374151;padding:7px 13px;border-radius:8px;font-size:.76rem;cursor:pointer}
  .decision{display:flex;gap:7px;margin-bottom:11px;flex-wrap:wrap}
  .btn-ok{background:#10b981;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer}
  .btn-ok:hover{background:#059669}
  .btn-ng{background:#fff;color:#9ca3af;border:1px solid #e5e7eb;padding:8px 18px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer}
  .btn-ng:hover{background:#f3f4f6}
  .btn-undo{background:#fff;color:#6b7280;border:1px solid #e5e7eb;padding:8px 14px;border-radius:8px;font-size:.76rem;cursor:pointer}
  .saving{position:fixed;bottom:20px;right:20px;background:#10b981;color:#fff;padding:8px 18px;border-radius:999px;font-size:.82rem;font-weight:700;opacity:0;transition:opacity .3s;pointer-events:none}
  .saving.show{opacity:1}
</style>
</head>
<body>
<header>
  <h1>🛍 商品プレビュー（ローカルサーバー）</h1>
  <div class="stats">
    <span class="stat stat-ok" id="stat-ok">採用 0件</span>
    <span class="stat" id="stat-un">未決定 …</span>
    <span class="stat stat-ng" id="stat-ng">不採用 0件</span>
  </div>
</header>
<div class="controls">
  <button class="filter-btn active" onclick="filterTag(null)">すべて</button>
  <span id="tag-btns"></span>
  <span style="color:#e5e7eb">｜</span>
  <button class="filter-btn sf active" data-s="all"      onclick="filterStatus('all')">全ステータス</button>
  <button class="filter-btn sf" data-s="approved"  onclick="filterStatus('approved')">✅ 採用</button>
  <button class="filter-btn sf" data-s="undecided" onclick="filterStatus('undecided')">⏳ 未決定</button>
  <button class="filter-btn sf" data-s="rejected"  onclick="filterStatus('rejected')">❌ 不採用</button>
  <input class="search" type="text" placeholder="タイトルで検索…" oninput="filterSearch(this.value)">
  <span class="count" id="count">読み込み中…</span>
</div>
<div class="grid" id="grid"></div>
<div class="saving" id="saving">保存しました</div>

<script>
let products=[], activeTag=null, activeStatus='all', searchQ='';

async function load(){
  const res = await fetch('/api/products');
  products = await res.json();
  render();
}

function render(){
  const grid = document.getElementById('grid');
  const tags  = [...new Set(products.map(p=>p.tag).filter(Boolean))];
  document.getElementById('tag-btns').innerHTML = tags.map(t=>
    \`<button class="filter-btn tag-f" onclick="filterTag('\${t}')">\${t}</button>\`
  ).join('');

  grid.innerHTML = products.map(p => {
    const comm = p.commission_rate ? \`<span class="commission">💰 \${p.commission_rate}</span>\` : '';
    return \`
    <div class="card" data-id="\${p.product_id}" data-tag="\${p.tag??''}" data-approved="\${p.approved===true?'true':p.approved===false?'false':'null'}">
      <div class="card-img"><img src="\${p.image_url}" loading="lazy" onerror="this.style.display='none'"></div>
      <div class="badge"></div>
      <div class="card-body">
        <div class="tags">
          \${p.tag ? \`<span class="tag tag-main">\${p.tag}</span>\` : ''}
          \${p.product_type&&p.product_type!==p.tag ? \`<span class="tag tag-type">\${p.product_type}</span>\` : ''}
        </div>
        <div class="title">\${p.title}</div>
        <div class="title-orig">\${p.title_full}</div>
        <div class="price">
          <span class="price-now">¥\${Number(p.price_jpy).toLocaleString()}</span>
          <span class="price-orig">元値 ¥\${Number(p.original_price).toLocaleString()}</span>
        </div>
        <div class="meta">
          <span>⭐ \${p.evaluate_rate??'N/A'}</span>
          <span>📦 \${p.sales_count??0}件</span>
          \${comm}
        </div>
        <div class="links">
          <a href="\${p.affiliate_link}" target="_blank" class="btn-aff">AliExpressで見る →</a>
          <button class="btn-copy" onclick="navigator.clipboard.writeText('\${p.affiliate_link}').then(()=>this.textContent='✓ コピー完了')">リンクをコピー</button>
        </div>
        <div class="decision">
          <button class="btn-ok"   onclick="setStatus('\${p.product_id}',true)">✅ 採用</button>
          <button class="btn-ng"   onclick="setStatus('\${p.product_id}',false)">❌ 不採用</button>
          <button class="btn-undo" onclick="setStatus('\${p.product_id}',null)">↩ 未決定</button>
        </div>
      </div>
    </div>\`;
  }).join('');
  updateStats();
  update();
}

async function setStatus(id, approved){
  await fetch(\`/api/products/\${id}\`, {
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({approved})
  });
  const p = products.find(x=>String(x.product_id)===String(id));
  if(p) p.approved = approved;
  const card = document.querySelector(\`.card[data-id="\${id}"]\`);
  if(card) card.dataset.approved = approved===true?'true':approved===false?'false':'null';
  updateStats();
  update();
  const s=document.getElementById('saving');
  s.classList.add('show');
  setTimeout(()=>s.classList.remove('show'),1200);
}

function updateStats(){
  const ok=products.filter(p=>p.approved===true).length;
  const ng=products.filter(p=>p.approved===false).length;
  const un=products.length-ok-ng;
  document.getElementById('stat-ok').textContent=\`採用 \${ok}件\`;
  document.getElementById('stat-un').textContent=\`未決定 \${un}件\`;
  document.getElementById('stat-ng').textContent=\`不採用 \${ng}件\`;
}

function update(){
  const cards=document.querySelectorAll('.card');
  let shown=0;
  cards.forEach(c=>{
    const tagOk = !activeTag || c.dataset.tag===activeTag;
    const a=c.dataset.approved;
    const statusOk = activeStatus==='all'
      || (activeStatus==='approved'  && a==='true')
      || (activeStatus==='rejected'  && a==='false')
      || (activeStatus==='undecided' && a==='null');
    const kwOk = !searchQ || c.querySelector('.title').textContent.toLowerCase().includes(searchQ);
    const show = tagOk && statusOk && kwOk;
    c.classList.toggle('hidden',!show);
    if(show) shown++;
  });
  document.getElementById('count').textContent=shown+'件表示';
}

function filterTag(tag){
  activeTag=tag;
  document.querySelectorAll('.filter-btn:not(.sf):not(.tag-f)').forEach(b=>b.classList.toggle('active',!tag));
  document.querySelectorAll('.filter-btn.tag-f').forEach(b=>b.classList.toggle('active',b.textContent===tag));
  update();
}
function filterStatus(s){
  activeStatus=s;
  document.querySelectorAll('.filter-btn.sf').forEach(b=>b.classList.toggle('active',b.dataset.s===s));
  update();
}
function filterSearch(q){ searchQ=q.toLowerCase(); update(); }

load();
</script>
</body>
</html>`;

// ── サーバー起動 ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
    const filePath = path.join(path.resolve('public'), urlPath === '/' ? '/index.html' : urlPath);
    if (urlPath !== '/' && fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                     '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                     '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                     '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' }[ext] ?? 'application/octet-stream';
      const charset = mime.startsWith('text/') ? '; charset=utf-8' : '';
      res.writeHead(200, { 'Content-Type': mime + charset });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(UI_HTML);
    }
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🚀 プレビューサーバー起動: ${url}`);
  console.log('   採用/不採用ボタンが即座に data/products.json に保存されます');
  console.log('   終了: Ctrl+C\n');
  // ブラウザを自動で開く
  try {
    execSync(`start ${url}`, { stdio: 'ignore' });
  } catch {}
});
