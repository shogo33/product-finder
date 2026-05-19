/**
 * data/products.json の価格・評価・販売数を最新に更新するスクリプト
 * 使い方: node scripts/refresh-prices.mjs
 *
 * 可用性チェックの仕組み:
 *   - 各商品に対して affiliate.link.generate を個別に呼び出す
 *   - プロモーションリンクが返れば → 存在確認OK、miss_streak リセット
 *   - エラーまたは空返却 → 削除済み or アフィリエイト対象外の可能性
 *   - miss_streak >= MISS_THRESHOLD（3日連続）→ active: false（非表示）
 *   - active: false でも再び取得できれば active: true に復活
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const APP_KEY       = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET    = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID   = process.env.ALIEXPRESS_TRACKING_ID;
const API_URL       = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE     = path.resolve('data/products.json');
const MISS_THRESHOLD = 3;

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

// ① 個別可用性チェック: affiliate リンクが発行できるか確認
async function checkAvailable(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const json = await callApi('aliexpress.affiliate.link.generate', {
    tracking_id: TRACKING_ID,
    source_values: url,
    promotion_link_type: '0',
  });
  const link = json?.aliexpress_affiliate_link_generate_response
                   ?.resp_result?.result?.promotion_links?.promotion_link?.[0]
                   ?.promotion_link ?? null;
  return link; // null なら取得不可
}

// ② キーワードで最大50件取得してIDマップを返す（価格更新用）
async function fetchPriceMap(keyword) {
  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords: keyword,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '50',
    fields: 'product_id,target_sale_price,original_price,evaluate_rate,lastest_volume,commission_rate',
  });
  const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
  const map = {};
  for (const r of raw) map[String(r.product_id)] = r;
  return map;
}

// ── メイン ────────────────────────────────────────────────

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// 採用商品のみ対象にする
const APPROVED_FILE = path.resolve('data/approved.json');
const approvedMap = fs.existsSync(APPROVED_FILE)
  ? JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'))
  : null;
const targets = approvedMap
  ? products.filter(p => approvedMap[String(p.product_id)] === true)
  : products;

// === フェーズ1: 採用商品のみ可用性チェック ===
console.log(`\n🔍 フェーズ1: 採用${targets.length}件を個別に可用性チェック中（全${products.length}件中）...\n`);

let availableSet = new Set();
let deactivatedCount = 0;
let reactivatedCount = 0;

for (const p of targets) {
  process.stdout.write(`  [${p.product_id}] チェック中...`);
  const link = await checkAvailable(p.product_id);

  if (link) {
    // リンク取得成功 → 存在確認OK
    availableSet.add(p.product_id);
    p.miss_streak = 0;
    p.affiliate_link = link; // アフィリエイトリンクも最新化

    if (p.active === false) {
      p.active = true;
      p.deactivated_at = null;
      console.log(` ♻️  復活`);
      reactivatedCount++;
    } else {
      console.log(` ✅ OK`);
    }
  } else {
    // リンク取得失敗 → 削除済みまたはアフィリエイト対象外
    p.miss_streak = (p.miss_streak ?? 0) + 1;

    if (p.miss_streak >= MISS_THRESHOLD && p.active !== false) {
      p.active = false;
      p.deactivated_at = new Date().toISOString();
      console.log(` 🗑  ${p.miss_streak}日連続NG → 非表示化`);
      deactivatedCount++;
    } else {
      console.log(` ⚠️  取得不可 (${p.miss_streak}/${MISS_THRESHOLD}日)`);
    }
  }

  // API レート制限対策
  await new Promise(r => setTimeout(r, 400));
}

// === フェーズ2: キーワード検索で最新価格に更新 ===
console.log(`\n💴 フェーズ2: キーワード検索で価格更新中...\n`);

const keywordGroups = {};
for (const p of products) {
  if (!availableSet.has(p.product_id)) continue; // 取得不可商品はスキップ
  const kw = p.keyword ?? '';
  if (!keywordGroups[kw]) keywordGroups[kw] = [];
  keywordGroups[kw].push(p);
}

let updatedCount = 0;
let unchangedCount = 0;

for (const [keyword, group] of Object.entries(keywordGroups)) {
  const freshMap = await fetchPriceMap(keyword);

  for (const p of group) {
    const fresh = freshMap[p.product_id];
    if (!fresh) continue; // キーワード検索50件外だが存在はする → 価格はそのまま

    const oldPrice = String(p.price_jpy);
    const newPrice = String(fresh.target_sale_price);

    p.price_jpy          = fresh.target_sale_price;
    p.original_price_jpy = fresh.original_price;
    p.evaluate_rate      = fresh.evaluate_rate;
    p.sales_count        = fresh.lastest_volume;
    p.commission_rate    = fresh.commission_rate ?? p.commission_rate;
    p.price_updated_at   = new Date().toISOString();

    if (oldPrice !== newPrice) {
      console.log(`  💴 ${p.product_id}  ¥${oldPrice} → ¥${newPrice}`);
      updatedCount++;
    } else {
      unchangedCount++;
    }
  }

  await new Promise(r => setTimeout(r, 500));
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');

const activeCount   = products.filter(p => p.active !== false).length;
const inactiveCount = products.filter(p => p.active === false).length;

console.log(`\n📊 結果サマリー`);
console.log(`   可用性チェック: ${availableSet.size}件OK / ${products.length - availableSet.size}件NG`);
console.log(`   価格更新: ${updatedCount}件 / 変化なし: ${unchangedCount}件`);
if (deactivatedCount) console.log(`   🗑  非表示化: ${deactivatedCount}件`);
if (reactivatedCount) console.log(`   ♻️  再表示:   ${reactivatedCount}件`);
console.log(`   表示中: ${activeCount}件 / 非表示: ${inactiveCount}件 / 合計: ${products.length}件`);
console.log(`   更新時刻: ${new Date().toLocaleString('ja-JP')}`);

// 採用リスト再生成（非表示になった商品を除外し、APIから補填）
if (deactivatedCount > 0 || reactivatedCount > 0) {
  console.log('\n🔄 採用リストを再生成・補填中...');
  execSync('node scripts/refill-pool.mjs', { stdio: 'inherit' });
  console.log('✅ 採用リスト・公開データを更新しました');
}

// 記事内の商品リンクを確認・更新
if (deactivatedCount > 0) {
  console.log('\n📝 記事内の商品セクションを確認・更新中...');
  execSync('node scripts/update-article-products.mjs', { stdio: 'inherit' });
}
