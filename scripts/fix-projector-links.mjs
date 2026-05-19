import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const API_URL     = 'https://api-sg.aliexpress.com/sync';

const ARTICLE = path.resolve('public/basics/aliexpress-projector-under-10000.html');

const PRODUCT_IDS = [
  '1005007791550948',
  '1005008932942300',
  '1005008564362053',
];

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function getAffiliateLink(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const params = {
    app_key: APP_KEY, method: 'aliexpress.affiliate.link.generate',
    sign_method: 'sha256', timestamp: String(Date.now()),
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  };
  params.sign = sign(params);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  return json?.aliexpress_affiliate_link_generate_response
              ?.resp_result?.result?.promotion_links
              ?.promotion_link?.[0]?.promotion_link ?? null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('\n🔗 プロジェクター記事のアフィリエイトリンクを取得中...\n');

let html = fs.readFileSync(ARTICLE, 'utf8');

for (const id of PRODUCT_IDS) {
  process.stdout.write(`  [${id}] 取得中...`);
  const affLink = await getAffiliateLink(id);

  if (!affLink) {
    console.log(' ❌ 取得失敗（スキップ）');
    await sleep(400);
    continue;
  }

  const oldUrl = `https://ja.aliexpress.com/item/${id}.html`;
  const count = (html.match(new RegExp(oldUrl.replace(/\./g, '\\.'), 'g')) || []).length;
  html = html.replaceAll(oldUrl, affLink);
  console.log(` ✅ ${count}箇所置き換え`);
  console.log(`     → ${affLink.slice(0, 80)}...`);

  await sleep(400);
}

fs.writeFileSync(ARTICLE, html, 'utf8');
console.log('\n💾 保存完了: public/basics/aliexpress-projector-under-10000.html');
