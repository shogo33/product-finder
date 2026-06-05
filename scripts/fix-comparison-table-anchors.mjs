/**
 * 比較表の商品名セル <td>...(PB722)...</td> を #product-{ASIN} へのアンカーに変換
 * Usage: node scripts/fix-comparison-table-anchors.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: ...'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');

// (型番) → ASIN マップ
const MODEL_TO_ASIN = {
  'PB722': 'B0CXHM5RY2',
  'PB721': 'B0CXHNGDC1',
  'PB724': 'B0CXJ1F1M7',
  '25188': 'B0C3GTMX5M',
  'PB773': 'B0F37VLJQW',
  'PB570': 'B0F6NC41DZ',
  'PB726': 'B0DSPXHFBM',
  'PB503': 'B0CXHRNVNW',
};

// すでに付与されていた壊れたアンカー（href="#sec-N"）を一旦剥がす
html = html.replace(/<a href="#sec-\d+"[^>]*>([^<]+\((?:PB|\d)[^)]*\))<\/a>/g, '$1');

// 1行目セル（モデル名列）でASINマッチ
let count = 0;
html = html.replace(/<td>([^<]*\(([A-Z0-9]+)\)[^<]*)<\/td>/g, (full, txt, model) => {
  const asin = MODEL_TO_ASIN[model];
  if (!asin) return full;
  count++;
  return `<td><a href="#product-${asin}">${txt}</a></td>`;
});

fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${count} comparison-table anchors fixed`);
