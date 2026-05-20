/**
 * TOPページを /home.html → / へ移行する一括置換スクリプト
 *
 * 処理内容:
 *   1. href="/home.html" → href="/"  （ロゴ・パンくず）
 *   2. href="https://aliswipe.com/" target="_blank"
 *      → href="https://aliswipe.com/app/" target="_blank"
 *      （JSON-LDのURL文字列は target="_blank" を持たないので影響なし）
 */
import fs from 'fs';
import path from 'path';

const SPA_OLD = 'https://aliswipe.com/" target="_blank"';
const SPA_NEW = 'https://aliswipe.com/app/" target="_blank"';

function getAllFiles(dir, exts) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllFiles(path.join(dir, e.name), exts));
    else if (exts.some(ext => e.name.endsWith(ext))) files.push(path.join(dir, e.name));
  });
  return files;
}

const base = path.resolve('public');
let updated = 0;

for (const file of getAllFiles(base, ['.html', '.js'])) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. /home.html → /
  if (content.includes('/home.html')) {
    content = content.replaceAll('href="/home.html"', 'href="/"');
    // JSON-LD 内の /home.html も修正
    content = content.replaceAll('/home.html"', '/"');
    changed = true;
  }

  // 2. SPA CTAリンク → /app/
  if (content.includes(SPA_OLD)) {
    content = content.replaceAll(SPA_OLD, SPA_NEW);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ ${path.relative(base, file)}`);
    updated++;
  }
}

console.log(`\n💾 ${updated}件更新`);
