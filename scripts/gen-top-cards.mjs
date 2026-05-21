/**
 * gen-top-cards.mjs
 * public/basics/ の記事を走査して index.html のおすすめ商品カードを自動更新
 * 使い方: node scripts/gen-top-cards.mjs
 */
import fs from 'fs';
import path from 'path';

const PUBLIC   = path.resolve('public');
const INDEX    = path.join(PUBLIC, 'index.html');
const BASICS   = path.join(PUBLIC, 'basics');
const INITIAL  = 6; // 初期表示件数

// サイトマップと同様に除外するスラッグ
const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap']);

// basics/ の中で「入門・基礎」セクションに入るもの（おすすめ商品に表示しない）
const KNOWLEDGE_SLUGS = new Set(['aliexpress-what-is', 'aliexpress-account', 'aliexpress-choice']);

// スラッグ→カードタグのマッピング
const CARD_TAG = {
  'aliexpress-1000yen-kawatte-yokatta': 'プチプラ',
  'aliexpress-osusume':               'おすすめ商品',
};
function getCardTag(slug) {
  if (CARD_TAG[slug]) return CARD_TAG[slug];
  if (slug.includes('naturehike')) return 'アウトドア';
  return 'おすすめ商品';
}

// HTMLからog:titleを抽出
function extractTitle(html) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (og) return og[1].trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  return t ? t[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim() : '';
}

// HTMLからog:descriptionを抽出
function extractDesc(html) {
  const m = html.match(/property="og:description"\s+content="([^"]+)"/);
  return m ? m[1].trim() : '';
}

// HTMLから最初の商品サムネイル画像URLを抽出
function extractThumb(html, slug) {
  // aliexpress-osusume は専用SVGを使う
  if (slug === 'aliexpress-osusume') return '/images/aliexpress-osusume.svg';

  // ローカル保存済み商品画像（/images/products/{slug}/）を優先
  const localMatch = html.match(/src="(\/images\/products\/[^"]+\.(jpg|jpeg|png|webp))"/i);
  if (localMatch) return localMatch[1];

  // 外部CDN（フォールバック）
  const aeAll = [...html.matchAll(/https?:\/\/ae-pic-a1\.aliexpress-media\.com\/kf\/[^\s"']+/gi)];
  if (aeAll.length > 0) return aeAll[0][0].split('"')[0].split("'")[0];

  const ugMatch = html.match(/https?:\/\/www\.ugreen\.com\/cdn\/shop\/files\/[^\s"'?]+/i);
  if (ugMatch) return ugMatch[0];

  const baMatch = html.match(/https?:\/\/www\.baseus\.com\/cdn\/shop\/files\/[^\s"'?]+/i);
  if (baMatch) return baMatch[0];

  return '/images/aliexpress-osusume.svg';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// basics/ 以下のHTMLを収集（ファイル更新日が古い順）
const entries = fs.readdirSync(BASICS)
  .filter(f => f.endsWith('.html') && !SKIP.has(path.basename(f, '.html')))
  .filter(f => !KNOWLEDGE_SLUGS.has(path.basename(f, '.html')))
  .map(f => {
    const full  = path.join(BASICS, f);
    const slug  = path.basename(f, '.html');
    const html  = fs.readFileSync(full, 'utf8');
    const mtime = fs.statSync(full).mtime;
    return { slug, html, mtime };
  })
  .sort((a, b) => a.mtime - b.mtime); // 古い順（新着が末尾＝もっと見るで隠れる）

// カードHTML生成
const cards = entries.map(({ slug, html }) => {
  const title = escHtml(extractTitle(html));
  const desc  = escHtml(extractDesc(html));
  const thumb = extractThumb(html, slug);
  const tag   = escHtml(getCardTag(slug));
  const href  = `/basics/${slug}.html`;
  const alt   = escHtml(title.slice(0, 40));

  return `      <a href="${href}" class="article-card">
        <img src="${thumb}" class="card-thumb" alt="${alt}" loading="lazy">
        <div class="card-body">
          <div class="card-tag">${tag}</div>
          <div class="card-title">${title}</div>
          <div class="card-desc">${desc}</div>
          <div class="card-arrow">読む</div>
        </div>
      </a>`;
}).join('\n');

const showMoreScript = `    <div style="text-align:center;margin-top:16px;">
      <button id="show-more-btn" onclick="showMoreCards()" style="background:#e8253a;color:#fff;border:none;padding:12px 32px;border-radius:24px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;">もっと見る ↓</button>
    </div>
    <script>
      (function(){
        const INITIAL = ${INITIAL};
        const grid = document.querySelector('#recommend + .article-grid');
        const cards = grid ? Array.from(grid.querySelectorAll('.article-card')) : [];
        cards.forEach((c, i) => { if (i >= INITIAL) c.style.display = 'none'; });
        if (cards.length <= INITIAL) { const btn = document.getElementById('show-more-btn'); if(btn) btn.style.display='none'; }
      })();
      function showMoreCards() {
        const grid = document.querySelector('#recommend + .article-grid');
        if (!grid) return;
        grid.querySelectorAll('.article-card').forEach(c => c.style.display = '');
        document.getElementById('show-more-btn').style.display = 'none';
      }
    </script>`;

const replacement = `    <!-- RECOMMEND-START -->
    <div class="article-grid">
${cards}
    </div>
${showMoreScript}
    <!-- RECOMMEND-END -->`;

// index.html を書き換え
let indexHtml = fs.readFileSync(INDEX, 'utf8');
const startMark = '<!-- RECOMMEND-START -->';
const endMark   = '<!-- RECOMMEND-END -->';
const si = indexHtml.indexOf(startMark);
const ei = indexHtml.indexOf(endMark) + endMark.length;

if (si === -1 || ei === -1) {
  console.error('❌ RECOMMEND マーカーが index.html に見つかりません');
  process.exit(1);
}

indexHtml = indexHtml.slice(0, si) + replacement + indexHtml.slice(ei);
fs.writeFileSync(INDEX, indexHtml, 'utf8');
console.log(`✅ index.html のおすすめカードを更新 (${entries.length}件)`);
