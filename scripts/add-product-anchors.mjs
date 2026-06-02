/**
 * 商品カードの h3 に id を付与し、ジャンル別評判セクションの
 * 「商品名（ASIN）」をアンカーリンクに変換する。
 * Usage: node scripts/add-product-anchors.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: ...'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');

// Step 0: 以前付けてしまった div.product-section の id を一旦剥がす
html = html.replace(/<div class="product-section" id="product-[A-Z0-9]+">/g, '<div class="product-section">');

// Step 1: 各商品の h3 に id を付与
// 直前の @product-start id="ASIN/PID" を読み取り、その商品セクション内の最初の <h3> に id を入れる
let addedIds = 0;
const PRODUCT_RE = /(<!-- @product-start id="([^"]+)"[^>]*-->)([\s\S]*?<!-- @product-end -->)/g;
html = html.replace(PRODUCT_RE, (full, startTag, productId, body) => {
  // 最初の <h3> を <h3 id="product-XXX"> に置換
  const replaced = body.replace(/<h3>([^<]*?)<\/h3>/, (m, txt) => {
    addedIds++;
    return `<h3 id="product-${productId}">${txt}</h3>`;
  });
  return `${startTag}${replaced}`;
});

console.log(`✅ ${addedIds} product h3 got id`);

// Step 2: ジャンル別評判セクション（sec-5）内のアンカーリンク化（前回スクリプトと同じ）
const sec5Start = html.indexOf('<h2 id="sec-5">');
const sec5End = html.indexOf('<h2 id="sec-6">');
if (sec5Start < 0 || sec5End < 0) {
  console.error('section 5/6 markers not found');
  process.exit(1);
}
const before = html.slice(0, sec5Start);
const sec5 = html.slice(sec5Start, sec5End);
const after = html.slice(sec5End);

// 既存のアンカーをいったん剥がす（前回のスクリプト分）
let normalizedSec5 = sec5.replace(/<a href="#product-[^"]+">([^<]+)<\/a>/g, '$1');

let anchorsAdded = 0;
const newSec5 = normalizedSec5.replace(
  /(UGREEN[^（()<]+?)（(B[A-Z0-9]{9})）/g,
  (full, name, asin) => {
    anchorsAdded++;
    return `<a href="#product-${asin}">${name.trim()}</a>（${asin}）`;
  }
);

console.log(`✅ ${anchorsAdded} anchor links inserted in section 5`);

fs.writeFileSync(file, before + newSec5 + after, 'utf8');
