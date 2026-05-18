/**
 * 商品データ取得・蓄積スクリプト
 * 使い方: node scripts/fetch-products.mjs <キーワード> [件数=5] [タグ]
 * 例:    node scripts/fetch-products.mjs "bluetooth earbuds" 5 ガジェット
 *        node scripts/fetch-products.mjs "portable projector" 3 プロジェクター
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE   = path.resolve('data/products.json');

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function callApi(method, extra) {
  const params = { app_key: APP_KEY, method, sign_method: 'sha256', timestamp: String(Date.now()), ...extra };
  params.sign = sign(params);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

async function generateShortTitle(title) {
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{
      role: 'user',
      content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。
ブランド名・製品番号があれば残し、スペック詳細・色・個数などは省略してください。
商品名だけを出力し、説明や記号は一切不要です。

商品名: ${title}`
    }]
  });
  return msg.content[0].text.trim();
}

async function generateDescription(product) {
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `以下のAliExpress商品を日本人向けに紹介してください。
商品名: ${product.title}
価格: ¥${product.price_jpy}（元値 ¥${product.original_price_jpy}）
評価: ${product.evaluate_rate} / 販売数: ${product.sales_count}件

【形式】
- キャッチコピー（1行・30文字以内）
- 紹介文（2〜3文・コスパと魅力を強調）
- おすすめポイント（箇条書き2点）`
    }]
  });
  return msg.content[0].text;
}

// ── メイン ──────────────────────────────────────────────
const [keyword, countArg, tag] = process.argv.slice(2);
if (!keyword) {
  console.error('使い方: node scripts/fetch-products.mjs <キーワード> [件数=5] [タグ]');
  process.exit(1);
}
const count = parseInt(countArg ?? '5', 10);

console.log(`\n🔍 「${keyword}」で${count}件取得中...\n`);

const json = await callApi('aliexpress.affiliate.product.query', {
  tracking_id: TRACKING_ID,
  keywords: keyword,
  target_currency: 'JPY',
  target_language: 'JA',
  page_size: String(count),
  fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,commission_rate',
});

const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
if (!raw.length) {
  console.error('商品が取得できませんでした:', JSON.stringify(json));
  process.exit(1);
}

// 既存データ読み込み
const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existingIds = new Set(existing.map(p => String(p.product_id)));

let addedCount = 0;
for (const p of raw) {
  const id = String(p.product_id);
  if (existingIds.has(id)) {
    console.log(`⏭  スキップ（既存）: ${id}`);
    continue;
  }

  const product = {
    product_id:          id,
    title:               p.product_title,
    price_jpy:           p.target_sale_price,
    original_price_jpy:  p.original_price,
    image_url:           p.product_main_image_url,
    affiliate_link:      p.product_detail_url,
    evaluate_rate:       p.evaluate_rate,
    sales_count:         p.lastest_volume,
    commission_rate:     p.commission_rate ?? null,
    keyword,
    tag:                 tag ?? null,
    fetched_at:          new Date().toISOString(),
    title_short:         null,
    description_ja:      null,
  };

  // Claude 短タイトル＋紹介文生成
  if (CLAUDE_KEY) {
    process.stdout.write(`✍️  生成中: ${p.product_title.slice(0, 35)}...`);
    product.title_short    = await generateShortTitle(p.product_title);
    product.description_ja = await generateDescription(product);
    console.log(` ✓ [${product.title_short}]`);
  }

  existing.push(product);
  existingIds.add(id);
  addedCount++;
}

// 保存
fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
console.log(`\n✅ ${addedCount}件追加（合計 ${existing.length}件）→ data/products.json`);
