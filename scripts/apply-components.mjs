/**
 * 全HTMLファイルの共通パーツをcomponents.js方式に移行するスクリプト
 *
 * 変換内容:
 *   1. <head>に <script src="/components.js"></script> を追加
 *   2. <header class="site-header">...</header>
 *      → <script id="site-header-inject"></script>（同期注入）
 *   3. <footer class="site-footer">...</footer>
 *      → <footer class="site-footer" id="site-footer"></footer>
 *   4. <div class="cta-sticky">...</div>
 *      → <div class="cta-sticky" id="cta-sticky"></div>
 */
import fs from 'fs';
import path from 'path';

function getAllHtmlFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllHtmlFiles(path.join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  });
  return files;
}

const SKIP = [
  'preview.html',   // 管理画面
  'home.html',      // TOPページ（独自構成）
  'sitemap.html',   // スティッキーCTAなし
];

const base = path.resolve('public');
let changed = 0;

for (const file of getAllHtmlFiles(base)) {
  const rel = path.relative(base, file);

  // スキップ対象
  if (SKIP.some(s => rel.endsWith(s))) {
    console.log(`⏭  skip: ${rel}`);
    continue;
  }
  // info/ (about, privacy, contact) はCTAなしのシンプルページ
  if (rel.startsWith('info\\') || rel.startsWith('info/')) {
    console.log(`⏭  skip: ${rel}`);
    continue;
  }

  let html = fs.readFileSync(file, 'utf8');
  let dirty = false;

  // すでに変換済みならスキップ
  if (html.includes('id="site-header-inject"') || html.includes("id='site-header-inject'")) {
    console.log(`✓  already done: ${rel}`);
    continue;
  }

  // 1. <head>に components.js を追加（GoogleタグのすぐあとまたはGAの前）
  if (!html.includes('/components.js')) {
    html = html.replace(
      /(<\/head>)/,
      '  <script src="/components.js"></script>\n$1'
    );
    dirty = true;
  }

  // 2. <header class="site-header">...</header> → inject script
  //    (管理画面用の <header> は class="site-header" を持たないので影響なし)
  html = html.replace(
    /<header\s+class="site-header"[\s\S]*?<\/header>/,
    '<script id="site-header-inject"></script>'
  );

  // 3. <footer class="site-footer">...</footer> → 空shell
  html = html.replace(
    /<footer\s+class="site-footer"[\s\S]*?<\/footer>/,
    '<footer class="site-footer" id="site-footer"></footer>'
  );

  // 4. <div class="cta-sticky">...</div> → 空shell
  html = html.replace(
    /<div\s+class="cta-sticky"[\s\S]*?<\/div>/,
    '<div class="cta-sticky" id="cta-sticky"></div>'
  );

  dirty = true;
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${rel}`);
  changed++;
}

console.log(`\n💾 ${changed}件更新`);
