/**
 * SEO メタ一括修正スクリプト
 *
 * 処理内容:
 *   1. canonical URL → 正しいドメイン＋パスに修正
 *   2. og:url → canonical に統一
 *   3. og:image → 記事別JPEG（/images/ogp/{slug}.jpg）に修正
 *   4. twitter:card → なければ追加
 *   5. JSON-LD (Article + BreadcrumbList) → なければ追加
 *      index.html のみ WebSite + Organization
 */
import fs from 'fs';
import path from 'path';

const DOMAIN = 'https://aliswipe.com';
const TODAY  = new Date().toISOString().slice(0, 10);

function getAllHtmlFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllHtmlFiles(path.join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  });
  return files;
}

function jsonLdTag(obj) {
  return `<script type="application/ld+json">\n  ${JSON.stringify(obj, null, 2).replace(/\n/g, '\n  ')}\n  </script>`;
}

const SKIP = new Set([
  'admin.html', 'preview.html', 'template.html', 'nav.html', 'sitemap.html',
]);

const base = path.resolve('public');
let updated = 0;

for (const file of getAllHtmlFiles(base)) {
  const rel      = path.relative(base, file).replace(/\\/g, '/');
  const basename = path.basename(file);
  const slug     = basename.replace('.html', '');

  if (SKIP.has(basename))         { console.log(`⏭  skip: ${rel}`); continue; }
  if (rel.startsWith('info/'))    { console.log(`⏭  skip: ${rel}`); continue; }

  let html    = fs.readFileSync(file, 'utf8');
  const isHome = rel === 'index.html';

  // ── URLs ────────────────────────────────────────────────────
  const canonicalUrl = isHome ? `${DOMAIN}/` : `${DOMAIN}/${rel}`;
  // OGP JPEG: /images/ogp/{slug}.jpg（gen-ogp.mjs と命名を合わせる）
  const imageUrl     = `${DOMAIN}/images/ogp/${slug}.jpg`;

  // ── 既存 meta 値を抽出 ──────────────────────────────────────
  const title       = (html.match(/<title>([\s\S]*?)<\/title>/)   || [])[1]?.trim() || '';
  const shortTitle  = title.replace(/ \| アリエクswipe.*$/, '').trim();
  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*?)"/) || [])[1]?.trim() || '';
  const ogTitle     = (html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"/) || [])[1]?.trim() || shortTitle;
  const ogDesc      = (html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/) || [])[1]?.trim() || description;

  // 1. canonical 修正 ─────────────────────────────────────────
  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(/<link\s+rel="canonical"[^>]*>/g,
      `<link rel="canonical" href="${canonicalUrl}" />`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${canonicalUrl}" />\n</head>`);
  }

  // 2. og:url 修正 ────────────────────────────────────────────
  if (/og:url/.test(html)) {
    html = html.replace(/<meta\s+property="og:url"[^>]*>/g,
      `<meta property="og:url" content="${canonicalUrl}" />`);
  } else {
    html = html.replace('</head>', `  <meta property="og:url" content="${canonicalUrl}" />\n</head>`);
  }

  // 3. og:image 修正 ──────────────────────────────────────────
  if (/og:image/.test(html)) {
    html = html.replace(/<meta\s+property="og:image"[^>]*>/g,
      `<meta property="og:image" content="${imageUrl}" />`);
  } else {
    html = html.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      m => m + `\n  <meta property="og:image" content="${imageUrl}" />`,
    );
  }

  // 4. Twitter Card 追加／更新 ───────────────────────────────
  if (!html.includes('twitter:card')) {
    const twitterBlock =
      `<meta name="twitter:card" content="summary_large_image" />\n` +
      `  <meta name="twitter:title" content="${ogTitle}" />\n` +
      `  <meta name="twitter:description" content="${ogDesc.slice(0, 200)}" />\n` +
      `  <meta name="twitter:image" content="${imageUrl}" />`;
    html = html.replace('</head>', `  ${twitterBlock}\n</head>`);
  } else {
    // twitter:image を最新の JPEG に更新
    html = html.replace(/<meta\s+name="twitter:image"[^>]*>/g,
      `<meta name="twitter:image" content="${imageUrl}" />`);
  }

  // 5. JSON-LD 追加（既存があればスキップ）──────────────────
  if (!html.includes('application/ld+json')) {
    let jsonLdBlock;

    if (isHome) {
      const webSite = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'アリエクswipe｜ガチ検証で選ぶアリエクの神コスパ商品',
        url: `${DOMAIN}/`,
        description,
      };
      const org = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'アリエクswipe',
        url: `${DOMAIN}/`,
      };
      jsonLdBlock = jsonLdTag(webSite) + '\n  ' + jsonLdTag(org);
    } else {
      const article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: shortTitle,
        description,
        url: canonicalUrl,
        image: imageUrl,
        datePublished: TODAY,
        dateModified: TODAY,
        author:    { '@type': 'Organization', name: 'アリエクswipe' },
        publisher: { '@type': 'Organization', name: 'アリエクswipe', url: `${DOMAIN}/` },
      };
      const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: shortTitle, item: canonicalUrl },
        ],
      };
      jsonLdBlock = jsonLdTag(article) + '\n  ' + jsonLdTag(breadcrumb);
    }

    html = html.replace('</head>', `  ${jsonLdBlock}\n</head>`);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${rel}`);
  updated++;
}

console.log(`\n💾 ${updated}件更新`);
