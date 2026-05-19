/**
 * preview.html でエクスポートした採用商品JSONをアプリ用に変換する
 * 使い方: node scripts/apply-approved.mjs <採用済みJSONファイルパス>
 * 例:    node scripts/apply-approved.mjs ~/Downloads/approved-products-2026-05-19.json
 * → public/products.json を上書き（Vercelで /products.json として配信される）
 */

import fs from 'fs';
import path from 'path';

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('使い方: node scripts/apply-approved.mjs <採用済みJSONファイルパス>');
  process.exit(1);
}

const approved = JSON.parse(fs.readFileSync(path.resolve(inputFile), 'utf8'));

function priceTag(price) {
  if (price <= 1000) return '¥1,000以下';
  if (price <= 3000) return '¥3,000以下';
  if (price <= 5000) return '¥5,000以下';
  return '¥10,000以下';
}

const cards = approved.map(p => {
  const price = Math.round(parseFloat(p.price_jpy) || 0);
  const tags = [...new Set([
    p.product_type ?? p.tag,
    p.tag !== p.product_type ? p.tag : null,
    priceTag(price),
  ].filter(Boolean))];

  return {
    id:       String(p.product_id),
    name:     p.title_short ?? p.title,
    price,
    category: p.tag ?? p.product_type ?? 'その他',
    url:      p.affiliate_link,
    images:   [p.image_url].filter(Boolean),
    tags,
  };
});

const outPath = path.resolve('public/products.json');
fs.writeFileSync(outPath, JSON.stringify(cards, null, 2), 'utf8');
console.log(`✅ ${cards.length}件 → public/products.json に書き出しました`);
console.log('   カテゴリ内訳:');
const cats = {};
cards.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
Object.entries(cats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`   ${v}件  ${k}`));
