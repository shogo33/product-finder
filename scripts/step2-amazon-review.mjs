/**
 * step2-amazon-review.mjs
 * Amazonレビューデータを受け取り、記事に使える「傾向サマリー」に整形する
 *
 * 使い方（テキスト貼り付け）:
 *   node scripts/step2-amazon-review.mjs <slug> --text "ここにレビューテキストを貼る"
 *
 * 使い方（ファイル指定）:
 *   node scripts/step2-amazon-review.mjs <slug> --file "path/to/reviews.txt"
 *
 * 使い方（スクショ画像）:
 *   node scripts/step2-amazon-review.mjs <slug> --image "path/to/screenshot.png"
 *
 * 商品IDを指定する場合（複数商品の場合にどの商品のレビューか明示）:
 *   node scripts/step2-amazon-review.mjs <slug> --product-id <id> --text "..."
 *   node scripts/step2-amazon-review.mjs <slug> --product-id <id> --file "..."
 *
 * 入力:  --text / --file / --image のいずれか
 *        data/articles/{slug}-research.json（商品名マッピング用）
 * 出力:  data/articles/{slug}-amzreview.json
 *        既存ファイルがあれば追記（商品ごとにマージ）
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');

const args      = process.argv.slice(2);
const slug      = args[0];

if (!slug || args.length < 2) {
  console.error('使い方:');
  console.error('  node scripts/step2-amazon-review.mjs <slug> --text "レビューテキスト"');
  console.error('  node scripts/step2-amazon-review.mjs <slug> --file reviews.txt');
  console.error('  node scripts/step2-amazon-review.mjs <slug> --image screenshot.png');
  console.error('  ※ --product-id <id> を追加すると特定商品に紐付けできます');
  process.exit(1);
}

// CLI パース
const textIdx    = args.indexOf('--text');
const fileIdx    = args.indexOf('--file');
const imageIdx   = args.indexOf('--image');
const pidIdx     = args.indexOf('--product-id');

const rawText    = textIdx  !== -1 ? args[textIdx  + 1] : null;
const filePath   = fileIdx  !== -1 ? args[fileIdx  + 1] : null;
const imagePath  = imageIdx !== -1 ? args[imageIdx + 1] : null;
const productId  = pidIdx   !== -1 ? args[pidIdx   + 1] : null;

if (!rawText && !filePath && !imagePath) {
  console.error('❌ --text / --file / --image のいずれかを指定してください');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

// research.json から商品名を取得
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const research     = fs.existsSync(researchPath)
  ? JSON.parse(fs.readFileSync(researchPath, 'utf8'))
  : null;
const products     = research?.products ?? [];

// 対象商品名を特定
let targetProduct = null;
if (productId) {
  targetProduct = products.find(p => String(p.product_id) === String(productId));
} else if (products.length === 1) {
  targetProduct = products[0];
}

const productName = targetProduct?.cleanName ?? '（商品名不明）';

console.log(`\n📦 Amazonレビュー整形: ${slug}`);
if (targetProduct) {
  console.log(`   対象商品: ${productName}`);
} else if (products.length > 1) {
  console.log(`   ⚠️  複数商品があります。--product-id で指定することを推奨します:`);
  products.forEach(p => console.log(`      ${p.product_id} → ${p.cleanName}`));
}
console.log('');

// ── 入力データ読み込み ────────────────────────────────────────
let reviewContent  = '';
let mediaType      = 'text';

if (rawText) {
  reviewContent = rawText;
} else if (filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }
  reviewContent = fs.readFileSync(filePath, 'utf8');
} else if (imagePath) {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 画像が見つかりません: ${imagePath}`);
    process.exit(1);
  }
  mediaType = 'image';
}

// ── Claude で整形 ─────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log('🤖 Claude でレビュー傾向を分析中...');

const systemPrompt = `あなたはECサイトのレビュー分析の専門家です。
Amazonレビューの生データから、記事に使える「傾向サマリー」を抽出します。
JSONのみ返してください。コードブロックや説明文は不要です。`;

const extractPrompt = `以下のAmazonレビューデータを分析して、記事に使えるサマリーを作成してください。

対象商品: ${productName}

## 出力形式（JSON）

{
  "productName": "${productName}",
  "productId": "${productId ?? targetProduct?.product_id ?? 'unknown'}",
  "reviewCount": 取得できたレビュー件数（概算）,
  "overallRating": 平均評価（数値、不明なら null）,
  "positivePoints": [
    "良い点1（「〜という声が多い」形式で、具体的に）",
    "良い点2",
    "良い点3"
  ],
  "negativePoints": [
    "悪い点1（「〜という指摘がある」形式で、具体的に）",
    "悪い点2"
  ],
  "useCases": [
    "向いている用途・ユーザー層1",
    "向いている用途・ユーザー層2"
  ],
  "notSuitableFor": [
    "向いていない用途・ユーザー層"
  ],
  "surprises": [
    "「想像とのズレ」を表すコメント（例：写真より少し大きい、思ったより発熱が少ない）"
  ],
  "keyQuotes": [
    {
      "text": "印象的なレビューコメント（日本語で要約・引用。実際の表現に近い形で）",
      "sentiment": "positive|negative|neutral"
    }
  ],
  "articleSnippet": "この商品のAmazonレビュー傾向を1〜2文でまとめた記事用テキスト。「〜という声が多い」形式で。"
}

## ルール
- "使いました" "試しました" などの断定表現は使わない（「〜という声が多い」「〜という報告がある」形式）
- 根拠不明な情報は書かない
- keyQuotesは印象的なものを最大5件
- 情報が不足している項目は空配列にする`;

let messages;
if (mediaType === 'image') {
  const imageData   = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext         = path.extname(imagePath).toLowerCase();
  const mimeMap     = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const mimeType    = mimeMap[ext] ?? 'image/jpeg';

  messages = [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64Image },
      },
      {
        type: 'text',
        text: extractPrompt,
      },
    ],
  }];
} else {
  messages = [{
    role: 'user',
    content: `${extractPrompt}\n\n## レビューデータ\n${reviewContent.slice(0, 8000)}`,
  }];
}

const response = await client.messages.create({
  model:    'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  system:   systemPrompt,
  messages,
});

let analysis;
try {
  const raw = response.content[0].text.trim()
    .replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  analysis = JSON.parse(raw);
} catch (e) {
  console.error('❌ Claude出力のJSONパースに失敗しました');
  console.error(response.content[0].text);
  process.exit(1);
}

// ── 既存ファイルにマージして保存 ──────────────────────────────
const outPath     = path.join(ARTICLES_DIR, `${slug}-amzreview.json`);
const existing    = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
  : { slug, reviews: [] };

// 同じ product_id があれば上書き、なければ追加
const idx = existing.reviews.findIndex(r => r.productId === analysis.productId);
if (idx !== -1) {
  existing.reviews[idx] = { ...analysis, updatedAt: new Date().toISOString().slice(0, 10) };
  console.log(`♻️  既存データを更新: ${analysis.productName}`);
} else {
  existing.reviews.push({ ...analysis, updatedAt: new Date().toISOString().slice(0, 10) });
  console.log(`➕ 新規追加: ${analysis.productName}`);
}

existing.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(outPath, JSON.stringify(existing, null, 2), 'utf8');

// ── サマリー表示 ─────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ Amazonレビュー整形完了: ${outPath}\n`);
console.log(`📊 ${analysis.productName}`);
if (analysis.overallRating) console.log(`   評価: ${analysis.overallRating} / 5`);
console.log(`\n👍 良い点:`);
(analysis.positivePoints ?? []).forEach(p => console.log(`  ・${p}`));
console.log(`\n👎 悪い点:`);
(analysis.negativePoints ?? []).forEach(p => console.log(`  ・${p}`));
console.log(`\n📝 記事用スニペット:`);
console.log(`  "${analysis.articleSnippet}"`);
console.log('\n' + '━'.repeat(60));
console.log(`\n▶ 次: node scripts/step2-verify.mjs ${slug}`);
