/**
 * aliexpress-osusume.html をDB採用商品でリライトするスクリプト
 * - カテゴリ別上位3件を選抜
 * - アフィリエイトリンクを取得
 * - 画像付き商品カードグリッドで HTML を生成
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const OUTPUT      = path.resolve('public/basics/aliexpress-osusume.html');

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function getAffiliateLink(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const params = {
    app_key: APP_KEY, method: 'aliexpress.affiliate.link.generate',
    sign_method: 'sha256', timestamp: String(Date.now()),
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  };
  params.sign = sign(params);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const json = await res.json();
    return json?.aliexpress_affiliate_link_generate_response
                ?.resp_result?.result?.promotion_links
                ?.promotion_link?.[0]?.promotion_link ?? null;
  } catch { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 商品選抜 ─────────────────────────────────────────────
const products = JSON.parse(fs.readFileSync(path.resolve('data/products.json'), 'utf8'));
const approved = JSON.parse(fs.readFileSync(path.resolve('data/approved.json'), 'utf8'));

function parseRate(s) { return s ? parseFloat(String(s).replace('%', '')) / 100 : 0; }
function score(x) { return (Number(x.sales_count) || 0) * parseRate(x.evaluate_rate); }

const candidates = products.filter(p =>
  approved[String(p.product_id)] === true && p.active !== false
);

const CATEGORY_ORDER = [
  'ガジェット', 'PC周辺機器', 'スマホアクセサリー', 'スマートホーム',
  'フィットネス', 'キッチン', 'アウトドア', 'トラベル',
  'ペット', 'カー用品', 'ボードゲーム', 'キッズ',
  'アート・クラフト', '文具', 'インテリア', '健康',
];

const CAT_EMOJI = {
  'ガジェット': '📱', 'PC周辺機器': '💻', 'スマホアクセサリー': '🔌',
  'スマートホーム': '🏠', 'フィットネス': '💪', 'キッチン': '🍳',
  'アウトドア': '⛺', 'トラベル': '✈️', 'ペット': '🐾',
  'カー用品': '🚗', 'ボードゲーム': '🎲', 'キッズ': '🧸',
  'アート・クラフト': '🎨', '文具': '✏️', 'インテリア': '🛋️', '健康': '❤️',
};

const byCat = {};
candidates.forEach(p => {
  if (!byCat[p.tag]) byCat[p.tag] = [];
  byCat[p.tag].push(p);
});
Object.values(byCat).forEach(arr => arr.sort((a, b) => score(b) - score(a)));

// カテゴリごと上位3件
const selected = [];
for (const cat of CATEGORY_ORDER) {
  if (!byCat[cat]) continue;
  byCat[cat].slice(0, 3).forEach(p => selected.push(p));
}

console.log(`\n🛒 ${selected.length}件を選抜。アフィリエイトリンク取得中...\n`);

// ── アフィリエイトリンク取得 ──────────────────────────────
const affLinks = {};
for (let i = 0; i < selected.length; i++) {
  const p = selected[i];
  process.stdout.write(`  [${i + 1}/${selected.length}] ${p.product_id}...`);
  const link = await getAffiliateLink(p.product_id);
  affLinks[p.product_id] = link || p.affiliate_link || `https://www.aliexpress.com/item/${p.product_id}.html`;
  console.log(link ? ' ✅' : ' ⚠️ fallback');
  await sleep(350);
}

// ── HTML生成 ──────────────────────────────────────────────
function ratingStars(rate) {
  const pct = parseRate(rate);
  const stars = Math.round(pct * 5 * 10) / 10;
  return `${stars.toFixed(1)}`;
}

function formatSales(n) {
  const num = Number(n) || 0;
  if (num >= 10000) return `${Math.floor(num / 1000)}k+件`;
  if (num >= 1000)  return `${Math.floor(num / 100) / 10}k+件`;
  return `${num}件`;
}

function productCard(p) {
  const link = affLinks[p.product_id];
  const name = p.title_short || p.title?.slice(0, 30);
  const price = Number(p.price_jpy).toLocaleString('ja-JP');
  const rating = ratingStars(p.evaluate_rate);
  const sales = formatSales(p.sales_count);
  const img = p.image_url || '';

  return `
      <!-- @product-start id="${p.product_id}" type="${p.product_type || ''}" tag="${p.tag}" -->
      <div class="product-item">
        <a href="${link}" target="_blank" rel="noopener" class="product-item-link">
          <div class="item-img-wrap">
            <img src="${img}" alt="${name}" loading="lazy" />
          </div>
          <div class="item-body">
            <div class="item-tag">${p.tag}</div>
            <div class="item-name">${name}</div>
            <div class="item-meta">
              <span class="item-rating">⭐ ${rating}</span>
              <span class="item-sales">${sales}販売</span>
            </div>
            <div class="item-price">¥${price}</div>
          </div>
          <div class="item-btn">AliExpressで見る →</div>
        </a>
      </div>
      <!-- @product-end -->`;
}

function categorySection(cat, prods) {
  const emoji = CAT_EMOJI[cat] || '🛍️';
  const cards = prods.slice(0, 3).map(productCard).join('\n');
  return `
    <!-- ===== ${cat} ===== -->
    <div class="category-banner">
      <span class="cat-icon">${emoji}</span>
      <div>
        <div class="cat-title">${cat}</div>
        <div class="cat-sub">厳選${prods.slice(0,3).length}商品</div>
      </div>
    </div>
    <div class="product-grid">
${cards}
    </div>`;
}

// カテゴリ別セクション生成
let categorySections = '';
for (const cat of CATEGORY_ORDER) {
  if (!byCat[cat] || !byCat[cat].length) continue;
  categorySections += categorySection(cat, byCat[cat]);
}

const totalCount = selected.length;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>アリエク おすすめ商品${totalCount}選【2026年最新】カテゴリ別厳選まとめ | アリエクswipe</title>
  <meta name="description" content="アリエク（AliExpress）のおすすめ商品を${totalCount}個厳選。ガジェット・キッチン・フィットネスなどカテゴリ別に紹介。すべてアフィリエイトリンク付きで最安値を確認できます。" />
  <meta name="keywords" content="アリエク おすすめ, アリエク おすすめ商品, AliExpress おすすめ, アリエクスプレス 人気, アリエク 買ってよかった" />
  <meta property="og:title" content="アリエク おすすめ商品${totalCount}選【2026年最新】カテゴリ別厳選まとめ" />
  <meta property="og:description" content="アリエクのおすすめ商品を${totalCount}個厳選。カテゴリ別に紹介します。" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://aliswipe.com/basics/aliexpress-osusume.html" />
  <meta property="og:image" content="https://aliswipe.com/images/ogp.jpg" />
  <link rel="canonical" href="https://aliswipe.com/basics/aliexpress-osusume.html" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

  <style>
    :root {
      --red:    #e8253a;
      --red-dk: #b81c2c;
      --bg:     #fafaf8;
      --surface:#ffffff;
      --text:   #1a1a1a;
      --muted:  #6b7280;
      --border: #e5e7eb;
      --radius: 12px;
      --max:    760px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', sans-serif; background: var(--bg); color: var(--text); line-height: 1.8; font-size: 16px; }

    .site-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 20px; position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .site-logo { text-decoration: none; display: flex; align-items: center; flex-shrink: 0; }
    .header-cta { background: var(--red); color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; transition: background 0.2s; }
    .header-cta:hover { background: var(--red-dk); }

    .article-hero { background: linear-gradient(135deg, #fff1f2 0%, #fff 60%); border-bottom: 1px solid var(--border); padding: 48px 20px 36px; text-align: center; }
    .article-hero .tag { display: inline-block; background: var(--red); color: #fff; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; }
    .article-hero h1 { font-weight: 700; font-size: clamp(1.35rem, 4vw, 1.9rem); line-height: 1.45; max-width: 640px; margin: 0 auto 16px; }
    .article-hero .meta { font-size: 0.82rem; color: var(--muted); }
    .article-hero .meta span + span::before { content: " · "; }

    .container { max-width: var(--max); margin: 0 auto; padding: 0 20px; }
    .article-body { padding: 24px 0 48px; }
    .article-body p { margin: 12px 0; font-size: 0.95rem; }

    /* Product grid */
    .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 0 0 32px; }
    @media (max-width: 600px) { .product-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
    @media (max-width: 360px) { .product-grid { grid-template-columns: 1fr; } }

    .product-item-link { display: flex; flex-direction: column; height: 100%; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s; }
    .product-item-link:hover { box-shadow: 0 4px 20px rgba(232,37,58,0.12); border-color: var(--red); }

    .item-img-wrap { width: 100%; aspect-ratio: 1/1; overflow: hidden; background: #f4f4f2; }
    .item-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
    .product-item-link:hover .item-img-wrap img { transform: scale(1.04); }

    .item-body { flex: 1; padding: 10px 12px 8px; display: flex; flex-direction: column; gap: 4px; }
    .item-tag { font-size: 0.65rem; font-weight: 700; color: var(--red); }
    .item-name { font-size: 0.82rem; font-weight: 700; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .item-meta { display: flex; gap: 8px; font-size: 0.7rem; color: var(--muted); }
    .item-price { font-size: 1rem; font-weight: 900; color: var(--red-dk); }

    .item-btn { background: var(--red); color: #fff; text-align: center; font-size: 0.75rem; font-weight: 700; padding: 9px 8px; transition: background 0.2s; }
    .item-btn:hover { background: var(--red-dk); }

    /* Category banner */
    .category-banner { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: var(--radius); padding: 18px 20px; margin: 36px 0 16px; color: #fff; display: flex; align-items: center; gap: 14px; }
    .cat-icon { font-size: 1.8rem; flex-shrink: 0; }
    .cat-title { font-size: 1rem; font-weight: 700; }
    .cat-sub { font-size: 0.76rem; opacity: 0.7; margin-top: 2px; }

    /* CTA */
    .cta-app { background: linear-gradient(135deg, var(--red) 0%, #ff6b35 100%); border-radius: var(--radius); padding: 32px 24px; text-align: center; margin: 40px 0; color: #fff; }
    .cta-app .cta-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; opacity: 0.85; margin-bottom: 8px; }
    .cta-app h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 10px; line-height: 1.4; }
    .cta-app p { font-size: 0.88rem; opacity: 0.9; margin-bottom: 22px; }
    .cta-app a { display: inline-block; background: #fff; color: var(--red); font-weight: 700; font-size: 0.95rem; padding: 14px 32px; border-radius: 999px; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
    .cta-app a:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }

    .callout { background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius); padding: 14px 18px; margin: 18px 0; font-size: 0.88rem; line-height: 1.7; }
    .callout::before { content: "💡 "; }

    .related { margin: 48px 0 24px; }
    .related-title { font-weight: 700; font-size: 1rem; margin-bottom: 16px; }
    .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .related-grid { grid-template-columns: 1fr; } }
    .related-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-decoration: none; color: var(--text); transition: border-color 0.2s; }
    .related-card:hover { border-color: var(--red); }
    .related-card .rc-tag { font-size: 0.7rem; color: var(--red); font-weight: 700; margin-bottom: 6px; }
    .related-card .rc-title { font-size: 0.88rem; font-weight: 700; line-height: 1.4; }

    .cta-sticky { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: var(--red); color: #fff; text-align: center; padding: 12px 20px; z-index: 200; box-shadow: 0 -4px 20px rgba(0,0,0,0.15); }
    .cta-sticky a { color: #fff; text-decoration: none; font-weight: 700; font-size: 0.88rem; }
    .cta-sticky .sub { font-size: 0.7rem; opacity: 0.85; }
    @media (max-width: 640px) { .cta-sticky { display: block; } body { padding-bottom: 72px; } }

    .site-footer { background: #1a1a1a; color: #9ca3af; text-align: center; padding: 32px 20px 60px; font-size: 0.8rem; }
    .footer-links { display: flex; gap: 16px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
    .site-footer a { color: #9ca3af; text-decoration: none; }
    .site-footer a:hover { color: #fff; }
    .footer-aff-notice { margin-top: 12px; font-size: 0.72rem; opacity: 0.6; line-height: 1.6; }
    hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
    @media (max-width: 480px) { .header-cta { padding: 5px 10px; font-size: 0.7rem; } }
  </style>

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7Y2RN13F5S"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-7Y2RN13F5S');
  </script>
</head>
<body>

<header class="site-header">
  <a class="site-logo" href="/home.html"><img src="/logo.png" alt="アリエクSwipe" style="height:36px;width:auto;display:block;"></a>
  <a class="header-cta" href="https://aliswipe.com/" target="_blank" rel="noopener">おすすめ商品はこちら</a>
</header>

<section class="article-hero">
  <div class="tag">🛍️ おすすめ商品まとめ</div>
  <h1>アリエク おすすめ商品${totalCount}選<br>【2026年最新・カテゴリ別厳選】</h1>
  <div class="meta">
    <span>2026年5月更新</span>
    <span>${CATEGORY_ORDER.filter(c => byCat[c]?.length).length}カテゴリ</span>
    <span>読了約8分</span>
  </div>
</section>

<div class="container">
  <div class="article-body">

    <p>AliExpress（アリエク）で実際に人気の高い商品を、販売実績・評価率をもとに厳選しました。ガジェット・キッチン・フィットネスなど<strong>${CATEGORY_ORDER.filter(c => byCat[c]?.length).length}カテゴリ・${totalCount}商品</strong>をカテゴリ別に紹介します。すべてアフィリエイトリンク付きで最新価格を確認できます。</p>

    <div class="callout">
      価格は変動します。リンク先でセール・クーポン情報も合わせてご確認ください。
    </div>

    ${categorySections}

    <hr>

    <div class="cta-app">
      <div class="cta-label">📱 もっと探したい方へ</div>
      <h3>スワイプして好みの商品を発見しよう</h3>
      <p>アリエクSwipeなら${totalCount}件以上の厳選商品をTinder感覚でチェックできます。</p>
      <a href="https://aliswipe.com/" target="_blank" rel="noopener">アプリで探す →</a>
    </div>

    <div class="related">
      <div class="related-title">📚 関連記事</div>
      <div class="related-grid">
        <a href="/basics/aliexpress-what-is.html" class="related-card">
          <div class="rc-tag">入門・基礎</div>
          <div class="rc-title">AliExpressとは？仕組み・安全性・使い方を初心者向けに解説</div>
        </a>
        <a href="/safety/aliexpress-safety.html" class="related-card">
          <div class="rc-tag">安全性</div>
          <div class="rc-title">AliExpress 安全性は本当？詐欺・偽物対策10選</div>
        </a>
        <a href="/payment/aliexpress-payment.html" class="related-card">
          <div class="rc-tag">支払い</div>
          <div class="rc-title">AliExpressの支払い方法おすすめ順位と注意点</div>
        </a>
        <a href="/shipping/aliexpress-tsuiseki.html" class="related-card">
          <div class="rc-tag">配送・追跡</div>
          <div class="rc-title">AliExpress追跡の完全ガイド【初心者向け】</div>
        </a>
      </div>
    </div>

  </div>
</div>

<div class="cta-sticky">
  <a href="https://aliswipe.com/">👆 スワイプで商品を発見する</a>
  <div class="sub">アリエクSwipe でお得な商品をチェック</div>
</div>

<footer class="site-footer">
  <div class="footer-links">
    <a href="/info/privacy.html">プライバシーポリシー</a>
    <a href="/info/contact.html">お問い合わせ</a>
    <a href="/info/about.html">運営者情報</a>
    <a href="/home.html">トップへ戻る</a>
  </div>
  <p>© 2026 アリエクswipe｜お得情報・格安商品. All rights reserved.</p>
  <p class="footer-aff-notice">本記事にはAliExpressアフィリエイトリンクが含まれています。記事内の価格・評価はすべて執筆時点の情報です。実際の価格はリンク先でご確認ください。</p>
</footer>

</body>
</html>`;

fs.writeFileSync(OUTPUT, html, 'utf8');
console.log(`\n✅ 完了: ${OUTPUT}`);
console.log(`   ${totalCount}件・${CATEGORY_ORDER.filter(c => byCat[c]?.length).length}カテゴリ`);
