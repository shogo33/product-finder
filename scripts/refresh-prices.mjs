/**
 * data/products.json の価格・評価・販売数を最新に更新するスクリプト
 * 使い方: node scripts/refresh-prices.mjs
 *
 * 非表示ロジック:
 *   - APIで見つかった商品 → miss_streak をリセット、価格更新
 *   - APIで見つからなかった商品 → miss_streak を +1
 *   - miss_streak >= 3（3日連続）→ active: false（非表示）
 *   - active: false になった商品はログに記録し、data/products.json に残す（履歴保持）
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE   = path.resolve('data/products.json');
const MISS_THRESHOLD = 3; // 何日連続で見つからなければ非表示にするか

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

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

// キーワードごとにグループ化（active: false の商品も再チェック対象）
const keywordGroups = {};
for (const p of products) {
  const kw = p.keyword ?? '';
  if (!keywordGroups[kw]) keywordGroups[kw] = [];
  keywordGroups[kw].push(p);
}

let updatedCount = 0;
let unchangedCount = 0;
let deactivatedCount = 0;
let reactivatedCount = 0;

for (const [keyword, group] of Object.entries(keywordGroups)) {
  console.log(`\n🔄 「${keyword}」(${group.length}件) の価格を更新中...`);

  const freshMap = await fetchPriceMap(keyword);
  console.log(`   API から ${Object.keys(freshMap).length} 件取得`);

  for (const p of group) {
    const fresh = freshMap[p.product_id];

    if (!fresh) {
      // 見つからなかった → ストリークを増やす
      p.miss_streak = (p.miss_streak ?? 0) + 1;

      if (p.miss_streak >= MISS_THRESHOLD && p.active !== false) {
        p.active = false;
        p.deactivated_at = new Date().toISOString();
        console.log(`  🗑  ${p.product_id} — ${p.miss_streak}日連続で取得不可 → 非表示に設定`);
        deactivatedCount++;
      } else if (p.active !== false) {
        console.log(`  ⚠️  ${p.product_id} — 見当たらず (${p.miss_streak}/${MISS_THRESHOLD}日)`);
      }
      continue;
    }

    // 見つかった → ストリークをリセット
    if (p.miss_streak > 0) {
      console.log(`  ♻️  ${p.product_id} — 再取得成功、ストリークリセット`);
    }
    if (p.active === false) {
      p.active = true;
      p.deactivated_at = null;
      console.log(`  ✅ ${p.product_id} — 復活、再表示に設定`);
      reactivatedCount++;
    }
    p.miss_streak = 0;

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
      process.stdout.write('.');
      unchangedCount++;
    }
  }

  await new Promise(r => setTimeout(r, 500));
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');

const activeCount   = products.filter(p => p.active !== false).length;
const inactiveCount = products.filter(p => p.active === false).length;

console.log(`\n\n📊 結果サマリー`);
console.log(`   価格更新: ${updatedCount}件 / 変化なし: ${unchangedCount}件`);
if (deactivatedCount) console.log(`   🗑  非表示化: ${deactivatedCount}件`);
if (reactivatedCount) console.log(`   ♻️  再表示:   ${reactivatedCount}件`);
console.log(`   表示中: ${activeCount}件 / 非表示: ${inactiveCount}件 / 合計: ${products.length}件`);
console.log(`   更新時刻: ${new Date().toLocaleString('ja-JP')}`);
