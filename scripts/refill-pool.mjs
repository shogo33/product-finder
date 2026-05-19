/**
 * 採用リストの不足カテゴリを狙い打ちでAPIから補充するスクリプト
 * 使い方: node scripts/refill-pool.mjs
 *
 * フロー:
 *   1. approved.json × products.json でカテゴリ別の採用数を集計
 *   2. CATEGORY_CAPS に届いていないカテゴリを検出
 *   3. そのカテゴリのキーワードだけ AliExpress API から新規取得
 *   4. products.json に追記
 *   5. auto-approve → generate-public-products を自動実行
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE   = path.resolve('data/products.json');
const APPROVED_FILE = path.resolve('data/approved.json');

// auto-approve と同じカテゴリ上限
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

// bulk-fetch と同じキーワードリスト（tagで絞り込む）
const KEYWORD_LIST = (await import('./bulk-fetch.mjs').catch(() => null))?.KEYWORD_LIST;

// bulk-fetchからインポートできない場合は直接埋め込み（フォールバック）
const KEYWORDS = KEYWORD_LIST ?? await (async () => {
  const src = fs.readFileSync(path.resolve('scripts/bulk-fetch.mjs'), 'utf8');
  const match = src.match(/const KEYWORD_LIST = (\[[\s\S]*?\n\];)/);
  if (!match) throw new Error('KEYWORD_LIST が bulk-fetch.mjs から読み込めません');
  return eval(match[1]); // eslint-disable-line no-eval
})();

// ── API ヘルパー ────────────────────────────────────────────

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastClaudeCall = 0;

async function generateShortTitle(title) {
  const now = Date.now();
  const wait = 1500 - (now - lastClaudeCall);
  if (wait > 0) await sleep(wait);
  lastClaudeCall = Date.now();
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。ブランド名・製品番号があれば残し、スペック詳細・色・個数などは省略してください。商品名だけを出力し、説明や記号は一切不要です。\n\n商品名: ${title}` }]
  });
  return msg.content[0].text.trim();
}

// ── メイン ──────────────────────────────────────────────────

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const approved = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'));

// 採用済みカテゴリ件数を集計（active:false は除く）
const approvedById = new Map(products.map(p => [String(p.product_id), p]));
const categoryCount = {};
for (const [id, isApproved] of Object.entries(approved)) {
  if (!isApproved) continue;
  const p = approvedById.get(id);
  if (!p || p.active === false) continue;
  categoryCount[p.tag] = (categoryCount[p.tag] || 0) + 1;
}

// 不足カテゴリを検出
const deficits = [];
for (const [tag, cap] of Object.entries(CATEGORY_CAPS)) {
  const count = categoryCount[tag] || 0;
  const shortage = cap - count;
  if (shortage > 0) deficits.push({ tag, cap, count, shortage });
}

if (deficits.length === 0) {
  console.log('\n✅ 全カテゴリが上限に達しています。補充不要です。');
  process.exit(0);
}

console.log('\n📊 不足カテゴリ:');
for (const { tag, count, cap, shortage } of deficits) {
  console.log(`  ${tag.padEnd(14)} ${count}/${cap}（不足 ${shortage}件）`);
}

// 不足カテゴリのタグセット
const deficitTags = new Set(deficits.map(d => d.tag));

// 対象キーワードを絞り込み（不足カテゴリのみ）
const targetKeywords = KEYWORDS.filter(k => deficitTags.has(k.tag));
console.log(`\n🎯 対象キーワード: ${targetKeywords.length}件（全${KEYWORDS.length}件中）\n`);

const existingIds = new Set(products.map(p => String(p.product_id)));
let totalAdded = 0;

for (let i = 0; i < targetKeywords.length; i++) {
  const { keyword, tag, type } = targetKeywords[i];
  console.log(`\n[${i + 1}/${targetKeywords.length}] 「${keyword}」(${type}) 取得中...`);

  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords: keyword,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '50',
    sort: 'LAST_VOLUME_DESC', // 新着・売れ筋順
    fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,commission_rate',
  });

  const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
  let added = 0;

  for (const p of raw) {
    const id = String(p.product_id);
    if (existingIds.has(id)) continue;

    const product = {
      product_id:         id,
      title:              p.product_title,
      title_short:        null,
      price_jpy:          p.target_sale_price,
      original_price_jpy: p.original_price,
      image_url:          p.product_main_image_url,
      affiliate_link:     p.product_detail_url,
      evaluate_rate:      p.evaluate_rate,
      sales_count:        p.lastest_volume,
      commission_rate:    p.commission_rate ?? null,
      product_type:       type,
      keyword,
      tag,
      fetched_at:         new Date().toISOString(),
      description_ja:     null,
    };

    if (CLAUDE_KEY) {
      product.title_short = await generateShortTitle(p.product_title);
      process.stdout.write(` → ${product.title_short}\n`);
    }

    products.push(product);
    existingIds.add(id);
    added++;
    totalAdded++;
  }

  console.log(`  ✅ ${added}件追加（スキップ: ${raw.length - added}件）`);

  // 5キーワードごとに中間保存
  if ((i + 1) % 5 === 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`  💾 中間保存: 合計 ${products.length}件`);
  }

  await sleep(600);
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
console.log(`\n✅ 完了: ${totalAdded}件追加（合計 ${products.length}件）`);

// 採用リスト再生成
console.log('\n🔄 採用リスト・公開データを再生成中...');
execSync('node scripts/auto-approve.mjs', { stdio: 'inherit' });
execSync('node scripts/generate-public-products.mjs', { stdio: 'inherit' });
console.log('✅ 完了');
