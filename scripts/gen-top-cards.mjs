/**
 * gen-top-cards.mjs
 * gadget/ game/ outdoor/ guide/ shipping/ safety/ の記事を走査して index.html の各セクションを自動更新
 * 使い方: node scripts/gen-top-cards.mjs
 */
import fs from 'fs';
import path from 'path';

const PUBLIC   = path.resolve('public');
const INDEX    = path.join(PUBLIC, 'index.html');
const GADGET   = path.join(PUBLIC, 'gadget');
const GAME     = path.join(PUBLIC, 'game');
const OUTDOOR  = path.join(PUBLIC, 'outdoor');
const GUIDE    = path.join(PUBLIC, 'guide');
const SHIPPING = path.join(PUBLIC, 'shipping');
const SAFETY   = path.join(PUBLIC, 'safety');
const INITIAL  = 6; // おすすめセクション初期表示件数

const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap']);

// guide/ の中で入門セクションに入るスラッグ（おすすめ・比較ガイドセクション除外）
const BEGINNER_SLUGS = new Set(['aliexpress-what-is', 'aliexpress-account', 'aliexpress-choice']);
// guide/ の中でおすすめ商品セクションに入るスラッグ（商品紹介記事）
const GUIDE_RECOMMEND_SLUGS = new Set([
  'aliexpress-1000yen-kawatte-yokatta',
  'aliexpress-osusume',
  'aliexpress-sticker-osusume',
]);
// guide/ の中で比較・ガイドセクションに入るスラッグ（ブランド解説・比較）
// ※上記2セット以外のguide/記事が自動的にTIPSへ

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
  if (folder === 'gadget')   return 'ガジェット';
  if (folder === 'game')     return 'ゲーム';
  if (folder === 'outdoor')  return 'アウトドア';
  if (folder === 'guide')    return 'ガイド';
  if (folder === 'shipping') return '配送・追跡';
  if (folder === 'safety')   return '安全性';
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

// ── 比較・ガイド（guide/ のうち BEGINNER・GUIDE_RECOMMEND 以外）──
const tipsEntries = collectEntries(GUIDE, 'guide')
  .filter(e => !BEGINNER_SLUGS.has(e.slug) && !GUIDE_RECOMMEND_SLUGS.has(e.slug));

const tipsCards = tipsEntries.map(makeCardHtml).join('\n');
const tipsBlock = `    <!-- TIPS-START -->
    <div class="article-grid">
${tipsCards}
    </div>
    <!-- TIPS-END -->`;

// ── おすすめ商品（gadget/ game/ outdoor/ 全件 + guide/ からの商品記事）──
const recommendEntries = [
  ...collectEntries(GADGET, 'gadget'),
  ...collectEntries(GAME, 'game'),
  ...collectEntries(OUTDOOR, 'outdoor'),
  ...collectEntries(GUIDE, 'guide').filter(e => GUIDE_RECOMMEND_SLUGS.has(e.slug)),
].sort((a, b) => a.mtime - b.mtime);

const recommendCards = recommendEntries.map(makeCardHtml).join('\n');

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

// ── 配送・追跡（shipping/ 全件）──
const shippingEntries = collectEntries(SHIPPING, 'shipping');
const shippingCards = shippingEntries.map(makeCardHtml).join('\n');
const shippingBlock = `    <!-- SHIPPING-START -->
    <div class="article-grid">
${shippingCards}
    </div>
    <!-- SHIPPING-END -->`;

// ── 安全性（safety/ 全件）──
const safetyEntries = collectEntries(SAFETY, 'safety');
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

// 入門・基礎セクションのリンクも更新（BEGINNER slugはguide/に移動済み）
function updateBeginnerLinks(html) {
  // guide/ に移動した入門記事のリンクが既に migrate-folders.mjs で更新済み
  return html;
}

let indexHtml = fs.readFileSync(INDEX, 'utf8');
indexHtml = inject(indexHtml, '<!-- RECOMMEND-START -->', '<!-- RECOMMEND-END -->', recommendBlock);
indexHtml = inject(indexHtml, '<!-- TIPS-START -->',      '<!-- TIPS-END -->',      tipsBlock);
indexHtml = inject(indexHtml, '<!-- SHIPPING-START -->', '<!-- SHIPPING-END -->', shippingBlock);
indexHtml = inject(indexHtml, '<!-- SAFETY-START -->',   '<!-- SAFETY-END -->',   safetyBlock);
indexHtml = updateBeginnerLinks(indexHtml);
fs.writeFileSync(INDEX, indexHtml, 'utf8');

console.log(`✅ index.html のおすすめカードを更新`);
console.log(`   recommend: ${recommendEntries.length}件 (gadget:${collectEntries(GADGET,'gadget').length} game:${collectEntries(GAME,'game').length} outdoor:${collectEntries(OUTDOOR,'outdoor').length} guide_rec:${collectEntries(GUIDE,'guide').filter(e=>GUIDE_RECOMMEND_SLUGS.has(e.slug)).length})`);
console.log(`   tips: ${tipsEntries.length}件 / shipping: ${shippingEntries.length}件 / safety: ${safetyEntries.length}件`);
