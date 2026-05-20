/**
 * 指定した商品IDをDBに追加してapprovedにするスクリプト
 * 使い方: node scripts/add-products-by-id.mjs
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
const APPROVED_FILE = path.resolve('data/approved.json');

// ← ここに追加したい商品IDを入れる
const TARGET_IDS = [
  '1005010425880598', // Baseus 10000mAh 22.5W コンパクト
  '1005008708384313', // Baseus 5000mAh MagSafe 磁気薄型
  '1005008652028760', // Baseus 145W 20800mAh スマートディスプレイ
  '1005006973916216', // Baseus 65W 20000mAh 格納式ケーブル
  '1005005814179114', // Baseus 145W 25000mAh ノートPC対応
];

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

// アフィリエイトリンク取得（商品の生存確認も兼ねる）
async function getAffiliateLink(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const json = await callApi('aliexpress.affiliate.link.generate', {
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  });
  return json?.aliexpress_affiliate_link_generate_response
              ?.resp_result?.result?.promotion_links
              ?.promotion_link?.[0]?.promotion_link ?? null;
}

// 商品IDで詳細検索（product_idをキーワードとして検索）
async function fetchProductDetail(productId) {
  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords: productId,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '10',
    fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,commission_rate',
  });
  const products = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
  return products.find(p => String(p.product_id) === String(productId)) ?? null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastClaude = 0;

async function generateShortTitle(title) {
  const wait = 1500 - (Date.now() - lastClaude);
  if (wait > 0) await sleep(wait);
  lastClaude = Date.now();
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。商品名だけを出力してください。\n\n商品名: ${title}` }],
  });
  return msg.content[0].text.trim();
}

// ── メイン ────────────────────────────────────────────────
const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const approved = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'));
const existingIds = new Set(products.map(p => String(p.product_id)));

console.log(`\n📦 ${TARGET_IDS.length}件の商品を処理中...\n`);

let addedCount = 0;
let approvedCount = 0;

for (const id of TARGET_IDS) {
  process.stdout.write(`[${id}] `);

  // すでにDBにある場合はapprovedだけ更新
  if (existingIds.has(id)) {
    approved[id] = true;
    approvedCount++;
    console.log(`✅ DB済み → approved追加`);
    continue;
  }

  // アフィリエイトリンク取得
  process.stdout.write(`リンク取得...`);
  const affLink = await getAffiliateLink(id);
  await sleep(400);

  if (!affLink) {
    console.log(` ❌ リンク取得失敗（スキップ）`);
    continue;
  }

  // 商品詳細取得
  process.stdout.write(` 詳細取得...`);
  const detail = await fetchProductDetail(id);
  await sleep(500);

  if (!detail) {
    console.log(` ⚠️ 詳細取得失敗（リンクのみで追加）`);
    // 最低限のエントリを作成
    products.push({
      product_id: id,
      title: id,
      title_short: null,
      price_jpy: null,
      original_price_jpy: null,
      image_url: null,
      affiliate_link: affLink,
      evaluate_rate: null,
      sales_count: null,
      commission_rate: null,
      product_type: null,
      keyword: null,
      tag: 'ガジェット',
      fetched_at: new Date().toISOString(),
      description_ja: null,
    });
    approved[id] = true;
    existingIds.add(id);
    addedCount++;
    approvedCount++;
    continue;
  }

  // title_short生成
  let titleShort = null;
  if (CLAUDE_KEY) {
    process.stdout.write(` タイトル生成...`);
    titleShort = await generateShortTitle(detail.product_title);
  }

  const product = {
    product_id:         id,
    title:              detail.product_title,
    title_short:        titleShort,
    price_jpy:          detail.target_sale_price,
    original_price_jpy: detail.original_price,
    image_url:          detail.product_main_image_url,
    affiliate_link:     affLink,
    evaluate_rate:      detail.evaluate_rate,
    sales_count:        detail.lastest_volume,
    commission_rate:    detail.commission_rate ?? null,
    product_type:       null,
    keyword:            null,
    tag:                'ガジェット',
    fetched_at:         new Date().toISOString(),
    description_ja:     null,
  };

  products.push(product);
  approved[id] = true;
  existingIds.add(id);
  addedCount++;
  approvedCount++;
  console.log(` ✅ 追加: ${titleShort || detail.product_title?.slice(0, 30)}`);
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
fs.writeFileSync(APPROVED_FILE, JSON.stringify(approved, null, 2), 'utf8');

console.log(`\n📊 完了: ${addedCount}件追加 / ${approvedCount}件approved`);
console.log('⚠️  tag と product_type は手動で確認・修正してください');
