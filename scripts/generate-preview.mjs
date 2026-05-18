/**
 * data/products.json からローカルプレビューHTMLを生成
 * 使い方: node scripts/generate-preview.mjs
 * → preview.html が生成される（.gitignoreで非公開）
 */

import fs from 'fs';
import path from 'path';

const products = JSON.parse(fs.readFileSync(path.resolve('data/products.json'), 'utf8'));

const cards = products.map(p => {
  const desc = (p.description_ja ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const descHtml = desc
    .replace(/^#{1,3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  return `
  <div class="card" data-tag="${p.tag ?? ''}" data-keyword="${p.keyword ?? ''}">
    <div class="card-img">
      <img src="${p.image_url}" alt="${p.title}" loading="lazy" onerror="this.style.display='none'">
    </div>
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
      </div>
      <div class="links">
        <a href="${p.affiliate_link}" target="_blank" class="btn-aff">アフィリエイトリンクを開く →</a>
        <button class="btn-copy" onclick="navigator.clipboard.writeText('${p.affiliate_link}').then(()=>this.textContent='✓ コピー完了')">リンクをコピー</button>
        <button class="btn-copy" onclick="navigator.clipboard.writeText('${p.image_url}').then(()=>this.textContent='✓ コピー完了')">画像URLをコピー</button>
      </div>
      ${p.description_ja ? `<details class="desc"><summary>紹介文を見る</summary><div class="desc-body">${descHtml}</div></details>` : ''}
    </div>
  </div>`;
}).join('\n');

const tags = [...new Set(products.map(p => p.tag).filter(Boolean))];
const tagButtons = tags.map(t =>
  `<button class="filter-btn" onclick="filterTag('${t}')">${t}</button>`
).join('');

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
  header span { font-size: 0.8rem; opacity: 0.85; }
  .controls { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 12px 24px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .filter-btn { border: 1px solid #e8253a; color: #e8253a; background: #fff; padding: 5px 14px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
  .filter-btn:hover, .filter-btn.active { background: #e8253a; color: #fff; }
  .search { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; width: 200px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding: 24px; }
  .card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.07); transition: box-shadow 0.2s; }
  .card:hover { box-shadow: 0 4px 24px rgba(232,37,58,0.15); }
  .card.hidden { display: none; }
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
  .links { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
  .btn-aff { background: #e8253a; color: #fff; text-decoration: none; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; }
  .btn-copy { border: 1px solid #e5e7eb; background: #fff; color: #374151; padding: 7px 14px; border-radius: 8px; font-size: 0.78rem; cursor: pointer; }
  .btn-copy:hover { background: #f9fafb; }
  .desc summary { font-size: 0.82rem; color: #6b7280; cursor: pointer; padding: 4px 0; }
  .desc-body { font-size: 0.82rem; line-height: 1.7; color: #374151; margin-top: 8px; padding: 12px; background: #f9fafb; border-radius: 8px; }
  .desc-body h3 { font-size: 0.88rem; margin: 8px 0 4px; color: #1a1a1a; }
  .count { font-size: 0.82rem; color: #6b7280; margin-left: auto; }
</style>
</head>
<body>
<header>
  <h1>🛍 商品プレビュー（ローカル専用）</h1>
  <span>全 ${products.length} 件 ／ 生成: ${new Date().toLocaleString('ja-JP')}</span>
</header>
<div class="controls">
  <button class="filter-btn active" onclick="filterTag(null)">すべて</button>
  ${tagButtons}
  <input class="search" type="text" placeholder="タイトルで検索..." oninput="filterSearch(this.value)">
  <span class="count" id="count">${products.length}件表示</span>
</div>
<div class="grid" id="grid">
${cards}
</div>
<script>
let activeTag = null;
let searchQuery = '';
function update() {
  const cards = document.querySelectorAll('.card');
  let shown = 0;
  cards.forEach(c => {
    const tagMatch = !activeTag || c.dataset.tag === activeTag;
    const kwMatch = !searchQuery || c.querySelector('.title').textContent.toLowerCase().includes(searchQuery);
    const show = tagMatch && kwMatch;
    c.classList.toggle('hidden', !show);
    if (show) shown++;
  });
  document.getElementById('count').textContent = shown + '件表示';
}
function filterTag(tag) {
  activeTag = tag;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(b => { if ((!tag && b.textContent === 'すべて') || b.textContent === tag) b.classList.add('active'); });
  update();
}
function filterSearch(q) {
  searchQuery = q.toLowerCase();
  update();
}
</script>
</body>
</html>`;

fs.writeFileSync(path.resolve('preview.html'), html, 'utf8');
console.log(`✅ preview.html を生成しました（${products.length}件）`);
console.log('   ブラウザで開いてください: file://' + path.resolve('preview.html').replace(/\\/g, '/'));
