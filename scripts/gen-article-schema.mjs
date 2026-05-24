/**
 * gen-article-schema.mjs
 * 全記事に Article JSON-LD（datePublished・dateModified）を注入し、
 * 記事内に目に見える「更新日」バッジも追加する
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PUBLIC   = 'public';
const BASE_URL = 'https://aliswipe.com';
const ARTICLE_DIRS = ['gadget','game','outdoor','guide','safety','payment','shipping'];
const SKIP = new Set(['admin','preview','template','nav','home','sitemap','index']);

function extractMeta(html, prop) {
  const m = html.match(new RegExp(`property="${prop}"\\s+content="([^"]+)"`));
  return m ? m[1].trim() : '';
}
function extractTitle(html) {
  const og = extractMeta(html, 'og:title');
  return og.replace(/\s*\|\s*アリエクswipe.*$/, '').trim();
}
function extractDesc(html) {
  return extractMeta(html, 'og:description');
}
function extractOgImage(html) {
  return extractMeta(html, 'og:image');
}

function toDateStr(dateStr) {
  // "2026-05-24 14:58:28 +0900" → "2026-05-24"
  return dateStr.split(' ')[0];
}

function getGitDates(filePath) {
  try {
    const first = execSync(
      `git log --follow --format="%ai" --diff-filter=A -- "${filePath}"`,
      { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] }
    ).trim();
    const last = execSync(
      `git log --format="%ai" -1 -- "${filePath}"`,
      { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] }
    ).trim();
    const published = first ? toDateStr(first) : toDateStr(last);
    const modified  = last  ? toDateStr(last)  : published;
    return { published, modified };
  } catch {
    const mtime = fs.statSync(filePath).mtime;
    const d = mtime.toISOString().split('T')[0];
    return { published: d, modified: d };
  }
}

function buildArticleJsonLd(slug, folder, title, desc, ogImage, dates) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    url: `${BASE_URL}/${folder}/${slug}.html`,
    image: ogImage || `${BASE_URL}/images/ogp/${slug}.jpg`,
    datePublished: dates.published,
    dateModified:  dates.modified,
    author: {
      '@type': 'Person',
      name: 'アリエクパパ',
      url: `${BASE_URL}/info/about.html`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'アリエクswipe',
      url: `${BASE_URL}/`,
    },
  };
}

function buildBreadcrumbJsonLd(title, folder, slug) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: title, item: `${BASE_URL}/${folder}/${slug}.html` },
    ],
  };
}

// 既存の Article / BreadcrumbList JSON-LD を削除して新しいものを head に注入
function injectSchemas(html, articleJsonLd, breadcrumbJsonLd) {
  // 既存のArticle/BreadcrumbList JSON-LDを削除
  html = html.replace(
    /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"(?:Article|BreadcrumbList)"[\s\S]*?<\/script>\s*/g,
    ''
  );

  const articleTag     = `<script type="application/ld+json">\n${JSON.stringify(articleJsonLd, null, 2)}\n</script>`;
  const breadcrumbTag  = `<script type="application/ld+json">\n${JSON.stringify(breadcrumbJsonLd, null, 2)}\n</script>`;
  const combined = `${articleTag}\n  ${breadcrumbTag}`;

  return html.replace('</head>', `  ${combined}\n</head>`);
}

// 目に見える「更新日」バッジを記事タイトル直下に追加（既存があれば置換）
function injectDateBadge(html, dates) {
  const badge = `<div class="article-date">📅 更新日：${dates.modified}　公開日：${dates.published}</div>`;

  // 既存バッジがあれば置換
  if (html.includes('class="article-date"')) {
    return html.replace(/<div class="article-date">[\s\S]*?<\/div>/, badge);
  }

  // <h1> の直後に挿入
  return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/, `$1\n${badge}`);
}

// article-date のCSS（一度だけ <style> に追加）
const DATE_CSS = '.article-date{font-size:.75rem;color:#9ca3af;margin:6px 0 20px;letter-spacing:.02em;}';

function ensureDateCss(html) {
  if (html.includes('.article-date')) return html;
  return html.replace('</style>', `  ${DATE_CSS}\n</style>`);
}

// ── メイン ──────────────────────────────────────────────────────
let updated = 0;

for (const folder of ARTICLE_DIRS) {
  const dir = path.join(PUBLIC, folder);
  if (!fs.existsSync(dir)) continue;

  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html') || SKIP.has(path.basename(f, '.html'))) continue;
    const slug     = path.basename(f, '.html');
    const fullPath = path.join(dir, f);
    let html       = fs.readFileSync(fullPath, 'utf8');

    const title   = extractTitle(html);
    const desc    = extractDesc(html);
    const ogImage = extractOgImage(html);
    const dates   = getGitDates(fullPath);

    const articleJsonLd    = buildArticleJsonLd(slug, folder, title, desc, ogImage, dates);
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(title, folder, slug);

    html = injectSchemas(html, articleJsonLd, breadcrumbJsonLd);
    html = ensureDateCss(html);
    html = injectDateBadge(html, dates);

    fs.writeFileSync(fullPath, html, 'utf8');
    updated++;
    process.stdout.write(`✅ ${folder}/${f}  (公開:${dates.published} 更新:${dates.modified})\n`);
  }
}

console.log(`\n完了: ${updated}件更新`);
