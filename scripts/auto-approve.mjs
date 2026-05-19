import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = path.resolve(__dirname, '../data/products.json');
const APPROVED_FILE = path.resolve(__dirname, '../data/approved.json');

// カテゴリ上限（合計500件）
const CATEGORY_CAPS = {
  'ガジェット':         75,
  'PC周辺機器':         65,
  'アウトドア':         40,
  'キッチン':           35,
  'フィットネス':       35,
  'ボードゲーム':       25,
  'カー用品':           25,
  'ペット':             25,
  'スマホアクセサリー': 25,
  'トラベル':           20,
  'キッズ':             20,
  'スマートホーム':     20,
  'アート・クラフト':   15,
  'インテリア':         15,
  '文具':               20,
  '健康':               10,
  'プロジェクター':     10,
};

// 除外キーワード（タイトルに含まれたら落とす）
const NG_KEYWORDS = [
  '下着', 'ブラジャー', 'ショーツ', 'パンティ', 'Gストリング',
  'アダルト', '18禁',
  '食品', 'サプリメント',
  'replica', 'fake', 'copy', '偽物',
];

function parseRate(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace('%', '')) / 100;
}

function priceBonus(jpy) {
  if (jpy >= 500 && jpy < 3000) return 1.3;
  if (jpy >= 3000 && jpy < 5000) return 1.1;
  return 1.0;
}

function score(p) {
  const sales = Number(p.sales_count) || 0;
  const rate  = parseRate(p.evaluate_rate);
  const price = parseFloat(p.price_jpy) || 0;
  return sales * rate * priceBonus(price);
}

function isNG(p) {
  const title = (p.title || '').toLowerCase();
  return NG_KEYWORDS.some(kw => title.includes(kw.toLowerCase()));
}

// ─── メイン ───────────────────────────────────────────────
const all = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));

// ハードフィルター（価格・画像・カテゴリのみ厳守）
const filtered = all.filter(p => {
  const price = parseFloat(p.price_jpy) || 0;
  const rate  = parseRate(p.evaluate_rate);
  return (
    price >= 500 && price <= 10000 &&
    p.image_url &&
    !isNG(p) &&
    CATEGORY_CAPS[p.tag] !== undefined &&
    // 評価レートがある場合は80%以上のみ
    (p.evaluate_rate === '' || p.evaluate_rate == null || rate >= 0.80)
  );
});

// スコア降順ソート
filtered.sort((a, b) => score(b) - score(a));

// カテゴリ別に上限＋product_type重複排除で採用
const approved = new Set();
const categoryCount = {};
const typeCount = {};

for (const p of filtered) {
  const tag = p.tag;
  const cap = CATEGORY_CAPS[tag];
  if (!cap) continue;
  if ((categoryCount[tag] || 0) >= cap) continue;

  // 同カテゴリ×同タイプは5件まで
  const typeKey = `${tag}::${(p.product_type || '').trim()}`;
  if (p.product_type) {
    if ((typeCount[typeKey] || 0) >= 5) continue;
    typeCount[typeKey] = (typeCount[typeKey] || 0) + 1;
  }

  approved.add(String(p.product_id));
  categoryCount[tag] = (categoryCount[tag] || 0) + 1;
}

// 結果をapproved.jsonに書き出し（全商品分）
const result = {};
for (const p of all) {
  result[String(p.product_id)] = approved.has(String(p.product_id));
}

fs.writeFileSync(APPROVED_FILE, JSON.stringify(result, null, 2), 'utf8');

// サマリー表示
console.log(`\n✅ 採用: ${approved.size} 件 / 全 ${all.length} 件`);
console.log('\n【カテゴリ別内訳】');
for (const [tag, cap] of Object.entries(CATEGORY_CAPS)) {
  const count = categoryCount[tag] || 0;
  const bar = '█'.repeat(Math.round(count / cap * 20)).padEnd(20, '░');
  console.log(`  ${tag.padEnd(14)} ${String(count).padStart(3)}/${cap}  ${bar}`);
}
