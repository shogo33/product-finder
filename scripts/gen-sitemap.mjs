/**
 * gen-sitemap.mjs
 * public/ 以下の HTML を走査して sitemap.xml と sitemap.html を自動生成
 * 使い方: node scripts/gen-sitemap.mjs
 */
import fs from 'fs';
import path from 'path';

const DOMAIN  = 'https://aliswipe.com';
const PUBLIC  = path.resolve('public');
const TODAY   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// 除外ファイル
const SKIP = new Set([
  'sitemap.html', 'sitemap.xml', 'admin.html', 'preview.html',
  'template.html', 'nav.html', 'home.html',
]);

// スラッグ別の優先度・更新頻度
const SLUG_META = {
  'index':                      { priority: '1.0', changefreq: 'weekly' },
  'aliexpress-osusume':         { priority: '0.9', changefreq: 'weekly' },
  'aliexpress-what-is':         { priority: '0.9', changefreq: 'monthly' },
  'aliexpress-account':         { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-choice':          { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-safety':          { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-ayashii':         { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-payment':         { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-nannichi':        { priority: '0.8', changefreq: 'monthly' },
  'aliexpress-tsuiseki':        { priority: '0.8', changefreq: 'monthly' },
  'about':                      { priority: '0.4', changefreq: 'yearly' },
  'privacy':                    { priority: '0.3', changefreq: 'yearly' },
  'contact':                    { priority: '0.3', changefreq: 'yearly' },
};
const DEFAULT_META = { priority: '0.7', changefreq: 'monthly' };

// guide/ の中で「AliExpressとは・基礎知識」セクションに入るスラッグ
const KNOWLEDGE_SLUGS = new Set(['aliexpress-what-is', 'aliexpress-account', 'aliexpress-choice']);

// カテゴリ別セクション定義（表示順）
const SECTIONS = [
  { key: 'top',       label: 'AliExpressとは・基礎知識' },
  { key: 'osusume',   label: 'おすすめ商品' },
  { key: 'safety',    label: '安全性・評判' },
  { key: 'payment',   label: '支払い方法' },
  { key: 'shipping',  label: '配送・追跡' },
  { key: 'info',      label: 'サイト情報' },
];

// HTML からタイトルを抽出
function extractTitle(html) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (og) return og[1].trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  if (t) return t[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim();
  return '';
}

// ファイルの最終更新日を YYYY-MM-DD で返す
function fileDate(filePath) {
  const mtime = fs.statSync(filePath).mtime;
  return mtime.toISOString().slice(0, 10);
}

// public/ 以下の HTML を再帰収集
function collectHtml(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectHtml(full));
    else if (entry.name.endsWith('.html') && !SKIP.has(entry.name)) result.push(full);
  }
  return result;
}

// ---- メイン ----
const files = collectHtml(PUBLIC);

// ページ情報を収集
const pages = [];
for (const file of files) {
  const rel      = path.relative(PUBLIC, file).replace(/\\/g, '/');
  const parts    = rel.split('/');
  const dir      = parts.length > 1 ? parts[0] : '';
  const slug     = path.basename(file, '.html');
  const html     = fs.readFileSync(file, 'utf8');
  const title    = extractTitle(html);
  const lastmod  = fileDate(file);
  const meta     = SLUG_META[slug] || DEFAULT_META;
  const urlPath  = slug === 'index' ? '/' : `/${rel}`;

  pages.push({ slug, dir, rel, urlPath, title, lastmod, ...meta });
}

// index を先頭に、残りは lastmod→slug でソート
pages.sort((a, b) => {
  if (a.slug === 'index') return -1;
  if (b.slug === 'index') return 1;
  return a.lastmod.localeCompare(b.lastmod) || a.slug.localeCompare(b.slug);
});

// ---- sitemap.xml 生成 ----
const xmlEntries = pages.map(p => `
  <url>
    <loc>${DOMAIN}${p.urlPath}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>
`;

fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), xml, 'utf8');
console.log(`✅ sitemap.xml  (${pages.length}件)`);

// ---- sitemap.html 用にセクション分類 ----
const buckets = { top: [], osusume: [], safety: [], payment: [], shipping: [], info: [] };
// フォルダ別おすすめ記事はすべてosusumeバケツへ

for (const p of pages) {
  if (p.slug === 'index') continue; // トップはハードコード
  if (p.dir === 'info') { buckets.info.push(p); continue; }
  if (p.dir === 'safety') { buckets.safety.push(p); continue; }
  if (p.dir === 'payment') { buckets.payment.push(p); continue; }
  if (p.dir === 'shipping') { buckets.shipping.push(p); continue; }
  if (KNOWLEDGE_SLUGS.has(p.slug)) { buckets.top.push(p); continue; }
  // gadget / game / outdoor / guide / basics → おすすめ or ガイドとして分類
  buckets.osusume.push(p);
}

function renderSection(label, items) {
  if (items.length === 0) return '';
  const links = items.map(p =>
    `      <li><a href="${p.urlPath}">${escHtml(p.title)}</a></li>`
  ).join('\n');
  return `
  <div class="section">
    <div class="section-title">${escHtml(label)}</div>
    <ul class="link-list">
${links}
    </ul>
  </div>`;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const sectionsHtml = SECTIONS.map(s => renderSection(s.label, buckets[s.key])).join('\n');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>サイトマップ | アリエクswipe｜お得情報・格安商品</title>
  <meta name="description" content="アリエクswipe｜お得情報・格安商品のサイトマップです。" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
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
      --max:    720px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 0.95rem;
      line-height: 1.8;
    }
    .site-header {
      background: var(--surface);
      border-bottom: 2px solid var(--red);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .site-logo { font-size: 1rem; font-weight: 700; color: var(--red); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
    .header-cta { background: var(--red); color: #fff; text-decoration: none; padding: 7px 14px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    main { max-width: var(--max); margin: 0 auto; padding: 40px 20px 60px; }
    .breadcrumb { font-size: 0.75rem; color: var(--muted); margin-bottom: 28px; }
    .breadcrumb a { color: var(--red); text-decoration: none; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 32px; }
    .section { margin-bottom: 36px; }
    .section-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    .link-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .link-list li a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text);
      font-size: 0.9rem;
      transition: background 0.15s, color 0.15s;
    }
    .link-list li a:hover { background: #fff1f2; color: var(--red); }
    .link-list li a::before { content: '›'; color: var(--red); font-weight: 700; font-size: 1rem; }
    .site-footer { background: #1a1a1a; color: #9ca3af; text-align: center; padding: 32px 20px 60px; font-size: 0.8rem; }
    .site-footer a { color: #9ca3af; text-decoration: none; }
    .site-footer a:hover { color: #fff; }
    .footer-links { display: flex; gap: 16px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
    .footer-aff-notice { margin-top: 12px; font-size: 0.72rem; opacity: 0.6; line-height: 1.6; }
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
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6858217811913334" crossorigin="anonymous"></script>
</head>
<body>

<header class="site-header">
  <a href="/" class="site-logo"><img src="/logo.png" alt="アリエクSwipe" style="height:36px;width:auto;display:block;"></a>
  <a href="https://aliswipe.com/" class="header-cta" target="_blank" rel="noopener">おすすめ商品はこちら</a>
</header>

<main>
  <div class="breadcrumb"><a href="/">ホーム</a> › サイトマップ</div>
  <h1>サイトマップ</h1>

  <div class="section">
    <div class="section-title">トップ・アプリ</div>
    <ul class="link-list">
      <li><a href="/">トップページ（完全攻略ガイド）</a></li>
      <li><a href="https://aliswipe.com/app/" target="_blank" rel="noopener">アリエクswipe アプリ（スワイプで商品発見）</a></li>
    </ul>
  </div>
${sectionsHtml}
</main>

<footer class="site-footer">
  <div class="footer-links">
    <a href="/info/privacy.html">プライバシーポリシー</a>
    <a href="/info/contact.html">お問い合わせ</a>
    <a href="/info/about.html">運営者情報</a>
    <a href="/sitemap.html">サイトマップ</a>
  </div>
  <div>© 2026 アリエクswipe｜お得情報・格安商品. All rights reserved.</div>
  <div class="footer-aff-notice">
    本サイトはAliExpressのアフィリエイトプログラムに参加しています。
    記事内のリンクから購入された場合、当サイトに報酬が発生することがあります。
    ただし、商品の評価・内容は独自の基準で作成しています。
  </div>
</footer>

</body>
</html>
`;

fs.writeFileSync(path.join(PUBLIC, 'sitemap.html'), html, 'utf8');
console.log(`✅ sitemap.html (${pages.length - 1}記事)`);
