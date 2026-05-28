/**
 * add-product-sections.mjs
 * <!-- @product-start --> ... <!-- @product-end --> ブロックを
 * <div class="product-section"> で囲む（冪等）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = 'C:/Users/USER/product-finder';

function walkHtml(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walkHtml(full));
    else if (entry.endsWith('.html')) results.push(full);
  }
  return results;
}

const files = walkHtml(path.join(ROOT, 'public'))
  .map(f => path.relative(ROOT, f).replace(/\\/g, '/'));

let total = 0;

for (const file of files) {
  const fullPath = path.join(ROOT, file);
  const html = readFileSync(fullPath, 'utf8');

  if (!html.includes('@product-start')) continue;
  if (html.includes('class="product-section"')) continue; // 冪等チェック

  const newHtml = html
    .replace(/(<!-- @product-start[^>]*-->)/g, '$1\n<div class="product-section">')
    .replace(/(<!-- @product-end -->)/g, '</div>\n$1');

  if (newHtml !== html) {
    writeFileSync(fullPath, newHtml, 'utf8');
    console.log(`✅ ${file}`);
    total++;
  }
}

console.log(`\n完了: ${total} ファイルを更新`);
