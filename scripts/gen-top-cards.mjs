/**
 * gen-top-cards.mjs
 * Zone 1（商品カード）/ Zone 2（情報リンク）に分けて index.html を更新
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
const PAYMENT  = path.join(PUBLIC, 'payment');

const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap']);
const GADGET_INITIAL = 4; // ガジェットの初期表示件数

// guide/ の仕分け
const BEGINNER_SLUGS = new Set([
  'aliexpress-what-is', 'aliexpress-account', 'aliexpress-choice',
]);
const GUIDE_RECOMMEND_SLUGS = new Set([
  'aliexpress-1000yen-kawatte-yokatta',
  'aliexpress-osusume',
  'aliexpress-sticker-osusume',
]);
// 上記2セット以外のguide/ → TIPS（比較・ガイド）

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
  if (folder === 'payment')  return '支払い・決済';
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
  const localMatch = html.match(/src="(\/images\/products\/[^"]+\.(jpg|jpeg|png|webp))"/i);
  if (localMatch) return localMatch[1];
  const aeAll = [...html.matchAll(/https?:\/\/ae-pic-a1\.aliexpress-media\.com\/kf\/[^\s"']+/gi)];
  if (aeAll.length > 0) return aeAll[0][0].split('"')[0].split("'")[0];
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
    .sort((a, b) => b.mtime - a.mtime); // 新着順
}

// ── Zone 1: 画像カード ──────────────────────────────────────
function makeCardHtml({ slug, html, folder }, isFirst = false) {
  const title   = escHtml(extractTitle(html));
  const desc    = escHtml(extractDesc(html));
  const thumb   = extractThumb(html, slug);
  const tag     = escHtml(getCardTag(slug, folder));
  const href    = `/${folder}/${slug}.html`;
  const alt     = escHtml(title.slice(0, 40));
  // LCP画像（最初の1枚）はeager + fetchpriority=high でブラウザに優先ロードを指示
  const loading = isFirst
    ? 'loading="eager" fetchpriority="high"'
    : 'loading="lazy"';
  return `      <a href="${href}" class="article-card">
        <img src="${thumb}" class="card-thumb" alt="${alt}" ${loading}>
        <div class="card-body">
          <div class="card-tag">${tag}</div>
          <div class="card-title">${title}</div>
          <div class="card-desc">${desc}</div>
          <div class="card-arrow">読む</div>
        </div>
      </a>`;
}

// ── Zone 2: テキストリンクリスト ────────────────────────────
function makeInfoLinkHtml({ slug, html, folder }) {
  const title = escHtml(extractTitle(html));
  const href  = `/${folder}/${slug}.html`;
  return `      <a href="${href}" class="info-link">
        <span class="info-link-title">${title}</span>
        <span class="info-link-arrow">›</span>
      </a>`;
}

// "もっと見る" ボタン（gridId 単位）
function makeShowMore(gridId, initial) {
  return `    <div id="${gridId}-more-wrap" style="text-align:center;margin-top:16px;">
      <button onclick="showMore('${gridId}')" style="background:#e8253a;color:#fff;border:none;padding:10px 28px;border-radius:24px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">もっと見る ↓</button>
    </div>
    <script>
      (function(){
        var grid=document.getElementById('${gridId}');
        var cards=grid?Array.from(grid.querySelectorAll('.article-card')):[];
        cards.forEach(function(c,i){ if(i>=${initial}) c.style.display='none'; });
        if(cards.length<=${initial}){ var b=document.getElementById('${gridId}-more-wrap'); if(b) b.style.display='none'; }
      })();
    <\/script>`;
}

// ── データ収集 ──────────────────────────────────────────────
const gadgetEntries   = collectEntries(GADGET,   'gadget');
const gameEntries     = collectEntries(GAME,     'game');
const outdoorEntries  = collectEntries(OUTDOOR,  'outdoor');
const guideAll        = collectEntries(GUIDE,    'guide');
const guideRecEntries = guideAll.filter(e => GUIDE_RECOMMEND_SLUGS.has(e.slug));
const beginnerEntries = guideAll.filter(e => BEGINNER_SLUGS.has(e.slug));
const tipsEntries     = guideAll.filter(e => !BEGINNER_SLUGS.has(e.slug) && !GUIDE_RECOMMEND_SLUGS.has(e.slug));
const paymentEntries  = collectEntries(PAYMENT,  'payment');
const shippingEntries = collectEntries(SHIPPING, 'shipping');
const safetyEntries   = collectEntries(SAFETY,   'safety');

// ── Zone 1 ブロック ──────────────────────────────────────────

// LCP対象: ガジェット最初の1枚のサムネURL（preload用）
const lcpThumb = gadgetEntries.length > 0
  ? extractThumb(gadgetEntries[0].html, gadgetEntries[0].slug)
  : null;

const gadgetBlock = `    <!-- GADGET-START -->
    <div class="article-grid" id="gadget-grid">
${gadgetEntries.map((e, i) => makeCardHtml(e, i === 0)).join('\n')}
    </div>
${makeShowMore('gadget-grid', GADGET_INITIAL)}
    <!-- GADGET-END -->`;

const gameBlock = `    <!-- GAME-START -->
    <div class="article-grid" id="game-grid">
${gameEntries.map(makeCardHtml).join('\n')}
    </div>
    <!-- GAME-END -->`;

const outdoorBlock = `    <!-- OUTDOOR-START -->
    <div class="article-grid" id="outdoor-grid">
${outdoorEntries.map(makeCardHtml).join('\n')}
    </div>
    <!-- OUTDOOR-END -->`;

const guideRecBlock = `    <!-- GUIDE-REC-START -->
    <div class="article-grid" id="guide-rec-grid">
${guideRecEntries.map(makeCardHtml).join('\n')}
    </div>
    <!-- GUIDE-REC-END -->`;

// ── Zone 2 ブロック ──────────────────────────────────────────

const beginnerBlock = `    <!-- BEGINNER-START -->
    <div class="info-link-list">
${beginnerEntries.map(makeInfoLinkHtml).join('\n')}
    </div>
    <!-- BEGINNER-END -->`;

const tipsBlock = `    <!-- TIPS-START -->
    <div class="info-link-list">
${tipsEntries.map(makeInfoLinkHtml).join('\n')}
    </div>
    <!-- TIPS-END -->`;

const paymentBlock = `    <!-- PAYMENT-START -->
    <div class="info-link-list">
${paymentEntries.map(makeInfoLinkHtml).join('\n')}
    </div>
    <!-- PAYMENT-END -->`;

const shippingBlock = `    <!-- SHIPPING-START -->
    <div class="info-link-list">
${shippingEntries.map(makeInfoLinkHtml).join('\n')}
    </div>
    <!-- SHIPPING-END -->`;

const safetyBlock = `    <!-- SAFETY-START -->
    <div class="info-link-list">
${safetyEntries.map(makeInfoLinkHtml).join('\n')}
    </div>
    <!-- SAFETY-END -->`;

// ── 注入 ──────────────────────────────────────────────────────
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
indexHtml = inject(indexHtml, '<!-- GADGET-START -->',    '<!-- GADGET-END -->',    gadgetBlock);
indexHtml = inject(indexHtml, '<!-- GAME-START -->',      '<!-- GAME-END -->',      gameBlock);
indexHtml = inject(indexHtml, '<!-- OUTDOOR-START -->',   '<!-- OUTDOOR-END -->',   outdoorBlock);
indexHtml = inject(indexHtml, '<!-- GUIDE-REC-START -->', '<!-- GUIDE-REC-END -->', guideRecBlock);
indexHtml = inject(indexHtml, '<!-- BEGINNER-START -->',  '<!-- BEGINNER-END -->',  beginnerBlock);
indexHtml = inject(indexHtml, '<!-- TIPS-START -->',      '<!-- TIPS-END -->',      tipsBlock);
indexHtml = inject(indexHtml, '<!-- PAYMENT-START -->',   '<!-- PAYMENT-END -->',   paymentBlock);
indexHtml = inject(indexHtml, '<!-- SHIPPING-START -->',  '<!-- SHIPPING-END -->',  shippingBlock);
indexHtml = inject(indexHtml, '<!-- SAFETY-START -->',    '<!-- SAFETY-END -->',    safetyBlock);
// ── ItemList JSON-LD を生成して注入 ──────────────────────────
const BASE_URL = 'https://aliswipe.com';
const itemListEntries = [
  ...gadgetEntries,
  ...gameEntries,
  ...outdoorEntries,
  ...guideRecEntries,
].slice(0, 20); // 最大20件（Googleの推奨上限）

const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'アリエクswipe おすすめ記事一覧',
  description: 'AliExpressのガジェット・ゲーム・アウトドア用品のおすすめ記事',
  numberOfItems: itemListEntries.length,
  itemListElement: itemListEntries.map((e, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${BASE_URL}/${e.folder}/${e.slug}.html`,
    name: extractTitle(e.html),
  })),
};

const itemListTag = `<script type="application/ld+json">\n${JSON.stringify(itemListJsonLd, null, 2)}\n</script>`;
indexHtml = indexHtml.replace(
  /<!-- ITEMLIST-JSONLD -->(?:\s*<script type="application\/ld\+json">[\s\S]*?<\/script>)?/,
  `<!-- ITEMLIST-JSONLD -->\n  ${itemListTag}`
);

// LCP preloadタグを更新（rel="preload"のみ置換。preconnect等は消さない）
if (lcpThumb) {
  const preloadTag = `<link rel="preload" as="image" href="${lcpThumb}" fetchpriority="high">`;
  indexHtml = indexHtml.replace(
    /<!-- LCP-PRELOAD -->\s*(?:<link\s[^>]*rel="preload"[^>]*>\s*)?/,
    `<!-- LCP-PRELOAD -->\n  ${preloadTag}\n\n  `
  );
}

fs.writeFileSync(INDEX, indexHtml, 'utf8');

console.log(`✅ index.html のカードを更新`);
console.log(`   Zone 1 → gadget:${gadgetEntries.length} / game:${gameEntries.length} / outdoor:${outdoorEntries.length} / guide-rec:${guideRecEntries.length}`);
console.log(`   Zone 2 → beginner:${beginnerEntries.length} / tips:${tipsEntries.length} / payment:${paymentEntries.length} / shipping:${shippingEntries.length} / safety:${safetyEntries.length}`);
