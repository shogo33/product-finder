/**
 * gen-category-pages.mjs
 * 各カテゴリの index.html を生成する
 * /gadget/, /game/, /outdoor/, /guide/, /safety/, /payment/, /shipping/
 */
import fs from 'fs';
import path from 'path';

const PUBLIC   = 'public';
const BASE_URL = 'https://aliswipe.com';
const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap', 'index']);

const CATEGORIES = [
  {
    folder:      'gadget',
    name:        'ガジェット・周辺機器',
    emoji:       '📱',
    title:       'アリエクのガジェット・周辺機器おすすめ記事一覧',
    description: 'UGREEN・Baseus・Xiaomiなどのガジェット・周辺機器をアリエクスプレスでお得に購入。USB充電器・ケーブル・マウス・スマートトラッカーなど厳選レビュー記事を掲載。',
    keywords:    'アリエク ガジェット おすすめ, AliExpress 周辺機器, UGREEN アリエク',
    cardStyle:   true,
  },
  {
    folder:      'game',
    name:        'ゲーム・コントローラー',
    emoji:       '🎮',
    title:       'アリエクのゲーム・コントローラーおすすめ記事一覧',
    description: 'GameSir・Baseus・Xiaomiなどのゲームコントローラーをアリエクスプレスで安く購入。Switch・スマホ・PC対応モデルを徹底比較したレビュー記事一覧。',
    keywords:    'アリエク ゲームパッド おすすめ, AliExpress コントローラー, GameSir アリエク',
    cardStyle:   true,
  },
  {
    folder:      'outdoor',
    name:        'アウトドア用品',
    emoji:       '🏕️',
    title:       'アリエクのアウトドア用品おすすめ記事一覧',
    description: 'Naturehikeなどの登山・キャンプ用品をアリエクスプレスで格安購入。テント・寝袋・エアマット・コットなど実体験レビュー記事を一覧掲載。',
    keywords:    'アリエク アウトドア おすすめ, AliExpress キャンプ, Naturehike アリエク',
    cardStyle:   true,
  },
  {
    folder:      'guide',
    name:        'AliExpress使い方ガイド',
    emoji:       '📘',
    title:       'AliExpressの使い方・ガイド記事一覧',
    description: 'AliExpressの使い方・始め方から、おすすめ商品選びのコツまで。初心者向け入門記事からヘビーユーザー向け活用術まで網羅したガイド記事一覧。',
    keywords:    'アリエクスプレス 使い方, AliExpress 始め方, アリエク おすすめ ガイド',
    cardStyle:   false,
  },
  {
    folder:      'safety',
    name:        '安全性・トラブル対策',
    emoji:       '🔒',
    title:       'AliExpressの安全性・トラブル対策記事一覧',
    description: 'AliExpressは怪しい？偽物・詐欺・サイズ違いなどのトラブルを未然に防ぐ方法を解説。安全に買い物するための知識をまとめた記事一覧。',
    keywords:    'アリエクスプレス 安全, AliExpress 怪しい, アリエク トラブル 対策',
    cardStyle:   false,
  },
  {
    folder:      'payment',
    name:        '支払い・決済方法',
    emoji:       '💳',
    title:       'AliExpressの支払い・決済方法記事一覧',
    description: 'AliExpressのクレジットカード・PayPay・PayPal・コンビニ払いなど支払い方法を徹底解説。クーポンの使い方・返金手続きもわかりやすく解説。',
    keywords:    'アリエクスプレス 支払い方法, AliExpress PayPay, アリエク クーポン',
    cardStyle:   false,
  },
  {
    folder:      'shipping',
    name:        '配送・追跡・返品',
    emoji:       '📦',
    title:       'AliExpressの配送・追跡・返品記事一覧',
    description: 'AliExpressの配送日数・追跡方法・届かない場合の対処法・返品・関税まで。配送に関する疑問をすべて解決する記事一覧。',
    keywords:    'アリエクスプレス 配送 日数, AliExpress 追跡, アリエク 届かない 対処',
    cardStyle:   false,
  },
];

function extractTitle(html) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (og) return og[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  return t ? t[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim() : '';
}

function extractDesc(html) {
  const m = html.match(/property="og:description"\s+content="([^"]+)"/);
  return m ? m[1].trim() : '';
}

function extractThumb(html, slug) {
  const svgPath = path.join(PUBLIC, 'images', `${slug}.svg`);
  if (fs.existsSync(svgPath)) return `/images/${slug}.svg`;
  const localMatch = html.match(/src="(\/images\/products\/[^"]+\.(jpg|jpeg|png|webp))"/i);
  if (localMatch) return localMatch[1];
  return '/images/aliexpress-osusume.svg';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function collectArticles(folder) {
  const dir = path.join(PUBLIC, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && !SKIP.has(path.basename(f, '.html')) && f !== 'index.html')
    .map(f => {
      const slug = path.basename(f, '.html');
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      const mtime = fs.statSync(path.join(dir, f)).mtime;
      return { slug, html, mtime, folder };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function makeCardHtml({ slug, html, folder }) {
  const title = escHtml(extractTitle(html));
  const desc  = escHtml(extractDesc(html));
  const thumb = extractThumb(html, slug);
  const href  = `/${folder}/${slug}.html`;
  const alt   = escHtml(title.slice(0, 40));
  return `        <a href="${href}" class="article-card">
          <img src="${thumb}" class="card-thumb" alt="${alt}" loading="lazy">
          <div class="card-body">
            <div class="card-title">${title}</div>
            <div class="card-desc">${desc}</div>
            <div class="card-arrow">読む →</div>
          </div>
        </a>`;
}

function makeLinkHtml({ slug, html, folder }) {
  const title = escHtml(extractTitle(html));
  const desc  = escHtml(extractDesc(html));
  const href  = `/${folder}/${slug}.html`;
  return `        <a href="${href}" class="article-link">
          <div class="article-link-body">
            <div class="article-link-title">${title}</div>
            <div class="article-link-desc">${desc}</div>
          </div>
          <span class="article-link-arrow">›</span>
        </a>`;
}

function buildPage(cat, articles) {
  const canonicalUrl = `${BASE_URL}/${cat.folder}/`;
  const ogImageUrl   = `${BASE_URL}/images/ogp/index.jpg`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: cat.name, item: canonicalUrl },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: cat.title,
    description: cat.description,
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE_URL}/${a.folder}/${a.slug}.html`,
      name: extractTitle(a.html),
    })),
  };

  const articlesHtml = cat.cardStyle
    ? `      <div class="article-grid">\n${articles.map(makeCardHtml).join('\n')}\n      </div>`
    : `      <div class="article-link-list">\n${articles.map(makeLinkHtml).join('\n')}\n      </div>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(cat.title)}｜アリエクswipe</title>
  <meta name="description" content="${escHtml(cat.description)}" />
  <meta name="keywords" content="${escHtml(cat.keywords)}" />
  <meta property="og:title" content="${escHtml(cat.title)}" />
  <meta property="og:description" content="${escHtml(cat.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
  <script type="application/ld+json">
${JSON.stringify(breadcrumbJsonLd, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(itemListJsonLd, null, 2)}
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', sans-serif; background: #fafaf8; color: #1a1a1a; line-height: 1.8; font-size: 16px; }
    .container { max-width: 900px; margin: 0 auto; padding: 0 20px 64px; }

    /* パンくず */
    .breadcrumb { font-size: 0.78rem; color: #9ca3af; padding: 12px 20px; max-width: 900px; margin: 0 auto; }
    .breadcrumb a { color: #9ca3af; text-decoration: none; }
    .breadcrumb a:hover { color: #e8253a; }

    /* カテゴリヘッダー */
    .cat-header { background: linear-gradient(135deg, #fff1f2 0%, #fff8f0 100%); border-bottom: 1px solid #e5e7eb; padding: 32px 20px; }
    .cat-header-inner { max-width: 900px; margin: 0 auto; }
    .cat-header-emoji { font-size: 2rem; margin-bottom: 8px; }
    .cat-header-title { font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 800; margin-bottom: 8px; }
    .cat-header-desc { font-size: 0.88rem; color: #6b7280; line-height: 1.7; }
    .cat-header-count { display: inline-block; margin-top: 10px; font-size: 0.75rem; font-weight: 700; color: #e8253a; background: #fff1f2; border: 1px solid #fecdcf; border-radius: 999px; padding: 3px 12px; }

    /* 記事グリッド（商品カード型） */
    .article-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 28px; }
    @media (min-width: 600px) { .article-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
    .article-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; text-decoration: none; color: #1a1a1a; display: flex; flex-direction: column; overflow: hidden; transition: border-color .2s, box-shadow .2s, transform .15s; }
    .article-card:hover { border-color: #e8253a; box-shadow: 0 4px 16px rgba(232,37,58,.1); transform: translateY(-2px); }
    .card-thumb { width: 100%; aspect-ratio: 400/220; object-fit: cover; display: block; }
    .card-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
    @media (min-width: 600px) { .card-body { padding: 14px; } }
    .card-title { font-size: 0.78rem; font-weight: 700; line-height: 1.45; }
    @media (min-width: 600px) { .card-title { font-size: 0.88rem; } }
    .card-desc { font-size: 0.75rem; color: #6b7280; line-height: 1.6; display: none; }
    @media (min-width: 600px) { .card-desc { display: block; } }
    .card-arrow { font-size: 0.72rem; color: #e8253a; margin-top: auto; padding-top: 4px; }

    /* 記事リスト（テキストリンク型） */
    .article-link-list { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-top: 28px; }
    .article-link { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; text-decoration: none; color: #1a1a1a; border-bottom: 1px solid #f3f4f6; transition: background .12s; }
    .article-link:last-child { border-bottom: none; }
    .article-link:hover { background: #fff1f2; }
    .article-link-body { flex: 1; }
    .article-link-title { font-size: 0.9rem; font-weight: 700; line-height: 1.5; }
    .article-link-desc { font-size: 0.78rem; color: #6b7280; margin-top: 3px; line-height: 1.5; }
    .article-link-arrow { color: #d1d5db; font-size: 1.3rem; margin-left: 12px; flex-shrink: 0; }
    .article-link:hover .article-link-arrow { color: #e8253a; }

    /* トップへ戻る */
    .back-home { display: inline-flex; align-items: center; gap: 6px; margin-top: 40px; color: #6b7280; text-decoration: none; font-size: 0.84rem; padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 999px; transition: all .15s; }
    .back-home:hover { background: #fff1f2; border-color: #e8253a; color: #e8253a; }
  </style>
</head>
<body>
  <script id="site-header-inject"></script>
  <script src="/components.js"></script>

  <nav class="breadcrumb" aria-label="パンくずリスト">
    <a href="/">ホーム</a> › ${escHtml(cat.name)}
  </nav>

  <div class="cat-header">
    <div class="cat-header-inner">
      <div class="cat-header-emoji">${cat.emoji}</div>
      <h1 class="cat-header-title">${escHtml(cat.name)}</h1>
      <p class="cat-header-desc">${escHtml(cat.description)}</p>
      <span class="cat-header-count">${articles.length}件の記事</span>
    </div>
  </div>

  <div class="container">
${articlesHtml}

    <a href="/" class="back-home">← トップページに戻る</a>
  </div>

  <footer class="site-footer">
    <div id="site-footer"></div>
  </footer>
  <div id="cta-sticky" style="position:fixed;bottom:0;left:0;right:0;background:linear-gradient(135deg,#e8253a,#c2185b);color:#fff;padding:12px 20px;text-align:center;z-index:500;font-size:.85rem;cursor:pointer;box-shadow:0 -2px 12px rgba(0,0,0,.15);"></div>
</body>
</html>`;
}

// ── 生成 ──────────────────────────────────────────────────────
for (const cat of CATEGORIES) {
  const articles = collectArticles(cat.folder);
  if (articles.length === 0) {
    console.log(`⚠️  スキップ: ${cat.folder}/ (記事なし)`);
    continue;
  }
  const html = buildPage(cat, articles);
  const outPath = path.join(PUBLIC, cat.folder, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✅ ${cat.folder}/index.html (${articles.length}件)`);
}

console.log('\n完了: カテゴリページ生成');
