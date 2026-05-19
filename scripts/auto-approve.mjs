import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_FILE = path.resolve(__dirname, '../data/products.json');
const APPROVED_FILE = path.resolve(__dirname, '../data/approved.json');

// カテゴリ上限（合計200件）
const CATEGORY_CAPS = {
  'ガジェット':         32,
  'PC周辺機器':         28,
  'アウトドア':         17,
  'キッチン':           15,
  'フィットネス':       14,
  'ボードゲーム':       10,
  'カー用品':           10,
  'ペット':             10,
  'スマホアクセサリー': 10,
  'トラベル':            8,
  'キッズ':              8,
  'スマートホーム':      8,
  'アート・クラフト':    6,
  'インテリア':          6,
  '文具':                8,
  '健康':                5,
  'プロジェクター':      5,
};

// 除外キーワード（タイトルに含まれたら落とす）
const NG_KEYWORDS = [
  // アダルト・下着
  '下着', 'ブラジャー', 'ショーツ', 'パンティ', 'Gストリング',
  'アダルト', '18禁',
  // 食品・サプリ
  '食品', 'サプリメント', 'プロテイン', 'コーヒー', '茶', '飲料',
  // 偽物
  'replica', 'fake', 'copy', '偽物',
  // 日本非対応の電圧・プラグ規格
  '220V', '230V', '240V', 'EU plug', 'UK plug', 'Type C plug', 'Schuko',
  // 日用品（国内で普通に買えるもの）
  'ティッシュ', '洗剤', '歯ブラシ', 'シャンプー', 'トイレ',
  // 大型・重量物（送料が割に合わない）
  '自転車', 'ソファ', '棚', 'タイヤ', 'バイク',
  // 法規制グレーゾーン
  'スタンガン', '催涙', 'エアガン', 'サバゲー',
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

// ハードフィルター（評価・販売数があるものだけ）
const filtered = all.filter(p => {
  const price = parseFloat(p.price_jpy) || 0;
  const rate  = parseRate(p.evaluate_rate);
  const sales = Number(p.sales_count) || 0;
  return (
    price >= 500 && price <= 10000 &&
    p.image_url &&
    !isNG(p) &&
    CATEGORY_CAPS[p.tag] !== undefined &&
    p.evaluate_rate && rate >= 0.85 &&        // 評価データあり、かつ85%以上
    sales >= 50 &&                            // 販売実績50件以上
    (p.title || '').length <= 80 &&           // タイトル80文字以内
    /[぀-ヿ一-鿿]/.test(p.title || '') &&    // 日本語タイトルのみ
    p.active !== false                        // リンク切れ除外
  );
});

// スコア降順ソート
filtered.sort((a, b) => score(b) - score(a));

// カテゴリ別に上限＋product_type重複排除で採用
const approved = new Set();
const categoryCount = {};
const typeCount = {};
const typePrices = {}; // typeKey → 採用済み価格リスト（近似重複検出用）

const PRICE_TOLERANCE = 500; // ¥500以内は同一商品とみなす

for (const p of filtered) {
  const tag = p.tag;
  const cap = CATEGORY_CAPS[tag];
  if (!cap) continue;
  if ((categoryCount[tag] || 0) >= cap) continue;

  const typeKey = `${tag}::${(p.product_type || '').trim()}`;
  const price = parseFloat(p.price_jpy) || 0;

  if (p.product_type) {
    // 同カテゴリ×同タイプは5件まで
    if ((typeCount[typeKey] || 0) >= 5) continue;

    // 採用済みと価格が±¥500以内なら近似重複としてスキップ
    const approvedPrices = typePrices[typeKey] || [];
    if (approvedPrices.some(ap => Math.abs(ap - price) <= PRICE_TOLERANCE)) continue;

    typeCount[typeKey] = (typeCount[typeKey] || 0) + 1;
    typePrices[typeKey] = [...approvedPrices, price];
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
