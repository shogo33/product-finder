/**
 * 採用済み商品を public/products.json に書き出す
 * 使い方: node scripts/generate-public-products.mjs
 * → data/approved.json (オンライン管理画面) または data/products.json の approved フィールド
 *   (ローカル preview-server) のどちらかで採用された商品を Vercel 配信用に変換
 * GitHub Actions から毎日自動実行される
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE     = path.resolve('data/products.json');
const APPROVED_FILE = path.resolve('data/approved.json');
const OUT_FILE      = path.resolve('public/products.json');

function priceTag(price) {
  if (price <= 1000) return '¥1,000以下';
  if (price <= 3000) return '¥3,000以下';
  if (price <= 5000) return '¥5,000以下';
  return '¥10,000以下';
}

// data/approved.json が存在すればそちらを優先（オンライン管理画面経由）
// 存在しなければ products.json の approved フィールドを使う（ローカル管理）
let approvedMap = null;
if (fs.existsSync(APPROVED_FILE)) {
  approvedMap = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'));
}

function isApproved(p) {
  if (approvedMap !== null) return approvedMap[String(p.product_id)] === true;
  return p.approved === true;
}

const all      = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const approved = all.filter(p => isApproved(p) && p.active !== false);

if (approved.length === 0) {
  console.log('⚠️  採用済み商品が0件です。public/products.json は更新しません。');
  process.exit(0);
}

const cards = approved.map(p => {
  const price = Math.round(parseFloat(p.price_jpy) || 0);
  const tags  = [...new Set([
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

fs.writeFileSync(OUT_FILE, JSON.stringify(cards, null, 2), 'utf8');
console.log(`✅ ${cards.length}件 → public/products.json に書き出しました`);

const cats = {};
cards.forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1; });
console.log('   カテゴリ内訳:');
Object.entries(cats).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`   ${v}件  ${k}`));
