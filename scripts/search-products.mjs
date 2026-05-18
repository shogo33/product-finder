/**
 * 蓄積済み商品データを検索・表示するスクリプト
 * 使い方: node scripts/search-products.mjs [キーワードorタグ]
 * 例:    node scripts/search-products.mjs ガジェット
 *        node scripts/search-products.mjs earbuds
 *        node scripts/search-products.mjs          ← 全件表示
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.resolve('data/products.json');
const products  = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const query     = process.argv[2]?.toLowerCase();

const filtered = query
  ? products.filter(p =>
      p.tag?.toLowerCase().includes(query) ||
      p.keyword?.toLowerCase().includes(query) ||
      p.title?.toLowerCase().includes(query)
    )
  : products;

if (!filtered.length) {
  console.log(`「${query}」に一致する商品はありません（全${products.length}件中）`);
  process.exit(0);
}

console.log(`\n📦 ${filtered.length}件ヒット（全${products.length}件中）\n`);

for (const p of filtered) {
  console.log('─'.repeat(60));
  console.log(`ID:     ${p.product_id}`);
  console.log(`タグ:   ${p.tag ?? '未設定'} ／ キーワード: ${p.keyword}`);
  console.log(`タイトル: ${p.title}`);
  console.log(`価格:   ¥${p.price_jpy}（元値 ¥${p.original_price_jpy}）`);
  console.log(`画像:   ${p.image_url}`);
  console.log(`リンク: ${p.affiliate_link}`);
  console.log(`評価:   ${p.evaluate_rate} ／ 販売数: ${p.sales_count}件`);
  if (p.description_ja) {
    console.log(`\n紹介文:\n${p.description_ja}`);
  }
  console.log();
}
