/**
 * gen-top-cards.mjs
 * basics/ shipping/ safety/ の記事を走査して index.html の各セクションを自動更新
 * 使い方: node scripts/gen-top-cards.mjs
 */
import fs from 'fs';
import path from 'path';

const PUBLIC   = path.resolve('public');
const INDEX    = path.join(PUBLIC, 'index.html');
const BASICS   = path.join(PUBLIC, 'basics');
const SHIPPING = path.join(PUBLIC, 'shipping');
const SAFETY   = path.join(PUBLIC, 'safety');
const INITIAL  = 6; // おすすめセクション初期表示件数

const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap']);
const KNOWLEDGE_SLUGS = new Set(['aliexpress-what-is', 'aliexpress-account', 'aliexpress-choice']);
// ブランド解説・比較ガイド記事（商品紹介なし）→ おすすめ商品ではなく比較・ブランド解説セクションへ
const TIPS_SLUGS = new Set(['naturehike-brand', 'aliexpress-vs-temu']);
// basics/ 内にあるが安全性・トラブルセクションに表示する記事
const SAFETY_EXTRA_SLUGS = new Set(['aliexpress-size']);

const CARD_TAG_OVERRIDE = {
  'aliexpress-1000yen-kawatte-yokatta': 'プチプラ',
  'aliexpress-osusume':                'おすすめ商品',
  'aliexpress-hyoban':                 '評判・口コミ',
  'aliexpress-size':                   'トラブル対策',
  'aliexpress-projector-under-10000':  'プロジェクター',
  'aliexpress-sticker-osusume':        'ステッカー',
  'naturehike-brand':                  'ブランド解説',
  'aliexpress-vs-temu':                '比較ガイド',
  'aliexpress-todokanai':              'トラブル対策',
};
function getCardTag(slug, folder) {
  if (CARD_TAG_OVERRIDE[slug]) return CARD_TAG_OVERRIDE[slug];
  if (folder === 'shipping') return '配送・追跡';
  if (folder === 'safety')   return '安全性';
  if (slug.includes('naturehike')) return 'アウトドア';
  return 'おすすめ商品';
}

function extractTitle(html) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (og) return og[1].trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  return t ? t[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim() : '';
}

function extractDesc(html) {
  const m = html.match(/property="og:description"\s+content="([^"]+)"/);
  return m ? m[1].trim() : '';
}

function extractThumb(html, slug) {
  // スラッグ専用SVGがあれば優先
  if (fs.existsSync(path.join(PUBLIC, 'images', `${slug}.svg`))) {
    return `/images/${slug}.svg`;
  }
  if (slug === 'aliexpress-osusume') return '/images/aliexpress-osusume.svg';
  const localMatch = html.match(/src="(\/images\/products\/[^"]+\.(jpg|jpeg|png|webp))"/i);
  if (localMatch) return localMatch[1];
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

function collectEntries(dir, folder) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && !SKIP.has(path.basename(f, '.html')))
    .map(f => {
      const full  = path.join(dir, f);
      const slug  = path.basename(f, '.html');
      const html  = fs.readFileSync(full, 'utf8');
      const mtime = fs.statSync(full).mtime;
      return { slug, html, mtime, folder };
    })
    .sort((a, b) => a.mtime - b.mtime);
}

function makeCardHtml({ slug, html, folder }) {
  const title = escHtml(extractTitle(html));
  const desc  = escHtml(extractDesc(html));
  const thumb = extractThumb(html, slug);
  const tag   = escHtml(getCardTag(slug, folder));
  const href  = `/${folder}/${slug}.html`;
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
}

// ── 比較・ブランド解説（TIPS_SLUGS に該当するもの） ──
const tipsEntries = collectEntries(BASICS, 'basics')
  .filter(e => TIPS_SLUGS.has(e.slug));

const tipsCards = tipsEntries.map(makeCardHtml).join('\n');
const tipsBlock = `    <!-- TIPS-START -->
    <div class="article-grid">
${tipsCards}
    </div>
    <!-- TIPS-END -->`;

// ── おすすめ商品（basics/ のみ、入門記事・tips記事除く） ──
const basicsEntries = collectEntries(BASICS, 'basics')
  .filter(e => !KNOWLEDGE_SLUGS.has(e.slug) && !TIPS_SLUGS.has(e.slug) && !SAFETY_EXTRA_SLUGS.has(e.slug));

const recommendCards = basicsEntries.map(makeCardHtml).join('\n');

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
    <\/script>`;

const recommendBlock = `    <!-- RECOMMEND-START -->
    <div class="article-grid">
${recommendCards}
    </div>
${showMoreScript}
    <!-- RECOMMEND-END -->`;

// ── 配送・追跡（shipping/ 全件） ──
const shippingEntries = collectEntries(SHIPPING, 'shipping');
const shippingCards = shippingEntries.map(makeCardHtml).join('\n');
const shippingBlock = `    <!-- SHIPPING-START -->
    <div class="article-grid">
${shippingCards}
    </div>
    <!-- SHIPPING-END -->`;

// ── 安全性（safety/ 全件 + basics/ からのSAFETY_EXTRA） ──
const safetyExtraEntries = collectEntries(BASICS, 'basics')
  .filter(e => SAFETY_EXTRA_SLUGS.has(e.slug));
const safetyEntries = [...collectEntries(SAFETY, 'safety'), ...safetyExtraEntries]
  .sort((a, b) => a.mtime - b.mtime);
const safetyCards = safetyEntries.map(makeCardHtml).join('\n');
const safetyBlock = `    <!-- SAFETY-START -->
    <div class="article-grid">
${safetyCards}
    </div>
    <!-- SAFETY-END -->`;

// ── index.html 更新 ──
function inject(html, startMark, endMark, block) {
  const si = html.indexOf(startMark);
  const ei = html.indexOf(endMark);
  if (si === -1 || ei === -1) {
    console.error(`❌ マーカー未発見: ${startMark}`);
    return html;
  }
  return html.slice(0, si) + block + html.slice(ei + endMark.length);
}

let indexHtml = fs.readFileSync(INDEX, 'utf8');
indexHtml = inject(indexHtml, '<!-- RECOMMEND-START -->', '<!-- RECOMMEND-END -->', recommendBlock);
indexHtml = inject(indexHtml, '<!-- TIPS-START -->',      '<!-- TIPS-END -->',      tipsBlock);
indexHtml = inject(indexHtml, '<!-- SHIPPING-START -->', '<!-- SHIPPING-END -->', shippingBlock);
indexHtml = inject(indexHtml, '<!-- SAFETY-START -->',   '<!-- SAFETY-END -->',   safetyBlock);
fs.writeFileSync(INDEX, indexHtml, 'utf8');

console.log(`✅ index.html のおすすめカードを更新 (basics ${basicsEntries.length}件 / tips ${tipsEntries.length}件 / shipping ${shippingEntries.length}件 / safety ${safetyEntries.length}件)`);
