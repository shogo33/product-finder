/**
 * step2-verify.mjs
 * research.json の品質を自動検証する（パイプラインのゲート）
 *
 * 使い方: node scripts/step2-verify.mjs <slug>
 * 例:    node scripts/step2-verify.mjs gamesir-t4-pro-osusume
 *
 * 入力:  data/articles/{slug}-research.json
 *        data/articles/{slug}-plan.json（あれば）
 * 出力:  コンソールレポート
 *        致命的な問題があれば exit 1 で停止
 *
 * チェック内容:
 *   [CRITICAL] アフィリエイトリンクの重複
 *   [CRITICAL] アフィリエイトリンク未取得
 *   [CRITICAL] アクセサリー・ケース類の混入
 *   [WARNING]  Amazon URL が未設定の商品
 *   [WARNING]  商品画像が取得できていない
 *   [WARNING]  価格が 0 または未取得
 *   [INFO]     商品数が plan の targetProductCount と一致しているか
 */

import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step2-verify.mjs <slug>');
  process.exit(1);
}

const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
if (!fs.existsSync(researchPath)) {
  console.error(`❌ research.json が見つかりません: ${researchPath}`);
  console.error('   step2-research.mjs を先に実行してください。');
  process.exit(1);
}

const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const planPath  = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const plan      = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : null;
const products  = research.products ?? [];

console.log(`\n🔎 step2-verify: ${slug} (${products.length}件)\n`);

// ── アクセサリー判定 ──────────────────────────────────────────
// 「〜用」のようにメイン商品に付属するアクセサリーを検出する
// 複合技術用語（ガスケットマウント・マルチバンド等）の誤検知を避けるため
// 単語単位でのマッチングと除外パターンを組み合わせる

// 単体で出現したらアクセサリー確定の日本語パターン（正規表現）
const ACCESSORY_PATTERNS_JA = [
  /用\s*(ケース|カバー|ホルダー|スタンド|クリップ|ポーチ|バッグ)/,  // 〜用ケース
  /電話\s*クリップ/,
  /フォン\s*クリップ/,
  /コントローラー\s*(用|スタンド)/,
  /保護\s*フィルム/,
  /ガラス\s*フィルム/,
  /交換\s*(用|品)\s*(パッド|イヤー|バッテリー)/,
  /充電\s*ケーブル/,
  /マグネット\s*ケーブル/,
];

// 単体で出現したらアクセサリー確定の英語パターン
const ACCESSORY_PATTERNS_EN = [
  /\bfor\s+(controller|gamepad|phone|iphone|android)\b/i,
  /\bphone\s+clip\b/i,
  /\bscreen\s+protector\b/i,
  /\btempered\s+glass\b/i,
  /\bcharging\s+cable\b/i,
  /\breplacement\s+(pad|ear|battery|grip)\b/i,
  /\bcontroller\s+(stand|holder|dock)\b/i,
];

// 誤検知を防ぐ除外パターン（これらを含む場合はアクセサリーとみなさない）
const EXCLUDE_PATTERNS = [
  /ガスケット\s*マウント/,   // ガスケットマウント式 → キーボード実装方式
  /トップ\s*マウント/,
  /サウス\s*ポー\s*マウント/,
  /マウント\s*[式方]/,       // マウント式・マウント方式
  /マルチ\s*(バンド|ポイント)/, // マルチバンド・マルチポイント
  /フリー\s*スタンド/,
  /スタンド\s*アロン/,
  /周波数\s*バンド/,
  /Wi-?Fi\s*バンド/i,
  /バンド幅/,
];

function isAccessory(title) {
  if (!title) return false;

  // 除外パターンにマッチしたらアクセサリーではない
  if (EXCLUDE_PATTERNS.some(re => re.test(title))) return false;

  const lower = title.toLowerCase();
  return (
    ACCESSORY_PATTERNS_JA.some(re => re.test(title)) ||
    ACCESSORY_PATTERNS_EN.some(re => re.test(lower))
  );
}

// ── チェック実行 ─────────────────────────────────────────────
const criticals = [];
const warnings  = [];
const infos     = [];

// 1. アフィリエイトリンク重複チェック
const affLinks = products.map(p => p.affiliateLink).filter(Boolean);
const uniqueAff = new Set(affLinks);
if (affLinks.length > 1 && uniqueAff.size < affLinks.length) {
  const dupes = affLinks.filter((v, i, a) => a.indexOf(v) !== i);
  criticals.push(
    `[リンク重複] AliExpressアフィリエイトリンクに重複あり\n` +
    `  重複URL: ${[...new Set(dupes)].map(u => u.slice(0, 80)).join('\n           ')}\n` +
    `  → step2-research.mjs を再実行するか rebuild-research.mjs で差し替えてください`
  );
}

// 2. アフィリエイトリンク未取得チェック
const noAff = products.filter(p => !p.hasAffiliate || !p.affiliateLink?.includes('s.click.aliexpress.com'));
if (noAff.length > 0) {
  criticals.push(
    `[リンク未取得] ${noAff.length}件のアフィリエイトリンクが取得できていません\n` +
    noAff.map(p => `  - ${p.cleanName} (ID: ${p.product_id})`).join('\n') +
    `\n  → step2-research.mjs を再実行するか手動でリンクを確認してください`
  );
}

// 3. アクセサリー混入チェック
for (const p of products) {
  const checkTarget = p.rawTitle ?? p.cleanName ?? '';
  if (isAccessory(checkTarget)) {
    criticals.push(
      `[アクセサリー混入] 本体ではなくアクセサリーの可能性があります\n` +
      `  商品名: "${p.cleanName}"\n` +
      `  元タイトル: "${(p.rawTitle ?? '').slice(0, 100)}"\n` +
      `  ID: ${p.product_id}\n` +
      `  → rebuild-research.mjs <slug> <正しいproduct_id> で差し替えてください`
    );
  }
}

// 4. Amazon URL 未設定チェック
const noAmazon = products.filter(p =>
  !p.amazonPlaceholder?.url && p.amazonPlaceholder?.status !== 'ready'
);
if (noAmazon.length > 0) {
  warnings.push(
    `[Amazon未設定] ${noAmazon.length}件のAmazon URLが未設定です\n` +
    noAmazon.map(p => `  - "${p.cleanName}" → 検索キーワード: "${p.amazonPlaceholder?.searchQuery ?? p.cleanName}"`).join('\n') +
    `\n  → step2-url2affiliate.mjs に --amazon を追加するか、後から手動で追加してください`
  );
}

// 5. 画像未取得チェック
const noImage = products.filter(p => !p.mainImage && (!p.images || p.images.length === 0));
if (noImage.length > 0) {
  warnings.push(
    `[画像なし] ${noImage.length}件の商品画像が取得できていません\n` +
    noImage.map(p => `  - "${p.cleanName}" (ID: ${p.product_id})`).join('\n') +
    `\n  → step2-research.mjs を再実行するか手動で画像URLを確認してください`
  );
}

// 6. 価格チェック
const noPrice = products.filter(p => !p.price_jpy || Number(p.price_jpy) === 0);
if (noPrice.length > 0) {
  warnings.push(
    `[価格未取得] ${noPrice.length}件の価格が 0 または未取得です\n` +
    noPrice.map(p => `  - "${p.cleanName}" → price_jpy: ${p.price_jpy}`).join('\n') +
    `\n  → AliExpress ページで価格を確認し、research.json を手動修正してください`
  );
}

// 7. specResult 欠落チェック（比較表・スペック列が空になる根本原因）
const noSpec = products.filter(p => !p.specResult?.content);
if (noSpec.length > 0) {
  const allMissing = noSpec.length === products.length;
  const msg =
    `[specResultなし] ${noSpec.length}/${products.length}件のTavilyスペック情報が未取得です\n` +
    noSpec.map(p => `  - "${p.cleanName}"`).join('\n') +
    `\n  → 比較表の「タイプ」「主な特徴」「バッテリー持続」等がすべて「-」になります` +
    `\n  → step2-research.mjs を再実行するか、comparisonTableColumns を価格・リンクのみの列に絞ってください`;
  if (allMissing) {
    criticals.push(msg);
  } else {
    warnings.push(msg);
  }
}

// 8. 商品数チェック（plan との比較）
if (plan?.targetProductCount && products.length !== plan.targetProductCount) {
  infos.push(
    `[商品数] plan の targetProductCount は ${plan.targetProductCount} 件ですが、research には ${products.length} 件あります\n` +
    `  → 意図的な差異であれば問題ありません`
  );
}

// ── レポート出力 ─────────────────────────────────────────────
console.log('━'.repeat(60));

// 商品一覧サマリー
console.log('📦 商品一覧:');
products.forEach((p, i) => {
  const affIcon   = p.affiliateLink?.includes('s.click.aliexpress.com') ? '✅' : '❌';
  const amazonIcon = p.amazonPlaceholder?.url ? '✅' : '⏳';
  const imageIcon  = (p.mainImage || p.images?.length > 0) ? '✅' : '❌';
  const priceStr   = p.price_jpy ? `¥${Number(p.price_jpy).toLocaleString('ja-JP')}` : '未取得';
  console.log(`  ${i + 1}. ${p.cleanName}`);
  console.log(`     AliExアフィリ: ${affIcon} | Amazon: ${amazonIcon} | 画像: ${imageIcon} | 価格: ${priceStr}`);
});

console.log('');

if (criticals.length === 0 && warnings.length === 0 && infos.length === 0) {
  console.log('✅ 全チェック通過：問題なし\n');
  console.log(`▶ 次: node scripts/step3a-scaffold.mjs ${slug}`);
  process.exit(0);
}

if (criticals.length > 0) {
  console.log(`❌ CRITICAL（${criticals.length}件）— 修正するまで次のステップに進まないでください`);
  console.log('━'.repeat(60));
  criticals.forEach((msg, i) => console.log(`\n[${i + 1}] ${msg}`));
}

if (warnings.length > 0) {
  console.log(`\n⚠️  WARNING（${warnings.length}件）— 可能なら修正を推奨`);
  console.log('━'.repeat(60));
  warnings.forEach((msg, i) => console.log(`\n[${i + 1}] ${msg}`));
}

if (infos.length > 0) {
  console.log(`\nℹ️  INFO（${infos.length}件）`);
  console.log('━'.repeat(60));
  infos.forEach((msg, i) => console.log(`\n[${i + 1}] ${msg}`));
}

console.log('\n' + '━'.repeat(60));

if (criticals.length > 0) {
  console.log(`\n❌ 検証失敗: CRITICAL ${criticals.length}件 を修正してから次のステップに進んでください\n`);
  process.exit(1);
} else {
  console.log(`\n✅ 検証通過（WARNING ${warnings.length}件あり）`);
  console.log(`▶ 次: node scripts/step3a-scaffold.mjs ${slug}\n`);
  process.exit(0);
}
