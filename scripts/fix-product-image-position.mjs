/**
 * 各商品セクション内で、商品画像（product-carousel）を
 * h3 の直後に移動させる。
 * Usage: node scripts/fix-product-image-position.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/fix-product-image-position.mjs <html-path>');
  process.exit(1);
}

let html = fs.readFileSync(file, 'utf8');

// 商品セクションを @product-start ... @product-end で1つずつ処理
const PRODUCT_RE = /(<!-- @product-start[^>]*-->)([\s\S]*?)(<!-- @product-end -->)/g;
let changed = 0;

html = html.replace(PRODUCT_RE, (full, startMarker, body, endMarker) => {
  // h3 ... carousel ... 抽出
  const h3Match = body.match(/<h3>[\s\S]*?<\/h3>/);
  const carouselMatch = body.match(/<div class="product-carousel"[\s\S]*?<\/div>\s*<\/div>/);

  if (!h3Match || !carouselMatch) return full;

  const h3 = h3Match[0];
  const carousel = carouselMatch[0];

  // 既に h3 直後に carousel がある場合はスキップ
  const afterH3 = body.slice(h3Match.index + h3.length).trimStart();
  if (afterH3.startsWith('<div class="product-carousel"')) return full;

  // body から carousel を抜き、h3 の直後に挿入し直す
  let newBody = body.replace(carousel, ''); // remove carousel from current position
  // h3 の直後に carousel を挿入（h3 と carousel の間に改行を入れて整形）
  newBody = newBody.replace(h3, `${h3}\n\n      ${carousel}`);
  changed++;
  return `${startMarker}${newBody}${endMarker}`;
});

fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${changed} product sections rewritten in ${file}`);
