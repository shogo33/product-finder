import fs from 'fs';
import path from 'path';

const SKIP = new Set(['admin.html', 'preview.html', 'template.html', 'nav.html', 'sitemap.html']);
const base = path.resolve('public');

const BREADCRUMB_CSS = `
    /* Breadcrumb */
    .breadcrumb { background: var(--bg); border-bottom: 1px solid var(--border); padding: 8px 20px; }
    .breadcrumb ol { list-style: none; max-width: var(--max); margin: 0 auto; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 0.78rem; }
    .breadcrumb li + li::before { content: '›'; color: var(--muted); margin-right: 4px; }
    .breadcrumb a { color: var(--muted); text-decoration: none; }
    .breadcrumb a:hover { color: var(--red); }
    .breadcrumb li[aria-current] { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }`;

function getAllHtmlFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllHtmlFiles(path.join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  });
  return files;
}

let updated = 0;

for (const file of getAllHtmlFiles(base)) {
  const rel      = path.relative(base, file).replace(/\\/g, '/');
  const basename = path.basename(file);

  if (SKIP.has(basename)) continue;
  if (rel.startsWith('info/')) continue;
  if (rel === 'index.html') continue; // TOPページは不要

  let html = fs.readFileSync(file, 'utf8');

  if (html.includes('class="breadcrumb"')) {
    console.log(`⏭  skip (already has breadcrumb): ${rel}`);
    continue;
  }

  // タイトル抽出
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!titleMatch) continue;
  const shortTitle = titleMatch[1].trim().replace(/ \| アリエクswipe.*$/, '').trim();

  // CSS注入（</style> の直前）
  html = html.replace('</style>', BREADCRUMB_CSS + '\n  </style>');

  // HTML注入（</header> の直後）
  const breadcrumbHtml =
    `\n  <nav class="breadcrumb" aria-label="パンくずリスト">\n` +
    `    <ol>\n` +
    `      <li><a href="/">ホーム</a></li>\n` +
    `      <li aria-current="page">${shortTitle}</li>\n` +
    `    </ol>\n` +
    `  </nav>`;

  const anchor = '<script id="site-header-inject"></script>';
  if (!html.includes(anchor)) {
    console.log(`⚠️  no site-header-inject found: ${rel}`);
    continue;
  }

  html = html.replace(anchor, anchor + breadcrumbHtml);

  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${rel}`);
  updated++;
}

console.log(`\n💾 ${updated}件更新`);
