/**
 * 各カテゴリのAliExpress検索URLをアフィリエイトリンクに変換するスクリプト
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const API_URL     = 'https://api-sg.aliexpress.com/sync';

const CATEGORIES = [
  { name: 'ガジェット',          url: 'https://ja.aliexpress.com/w/wholesale-gadget.html?SearchText=gadget&sortType=total_tranRanking_desc' },
  { name: 'PC周辺機器',          url: 'https://ja.aliexpress.com/category/200218300/computer-peripherals-parts.html' },
  { name: 'スマホアクセサリー',  url: 'https://ja.aliexpress.com/category/214/mobile-phone-accessories.html' },
  { name: 'スマートホーム',      url: 'https://ja.aliexpress.com/category/6083/smart-home.html' },
  { name: 'フィットネス',        url: 'https://ja.aliexpress.com/w/wholesale-fitness.html?SearchText=fitness+equipment&sortType=total_tranRanking_desc' },
  { name: 'キッチン',            url: 'https://ja.aliexpress.com/category/100003109/home-kitchen.html' },
  { name: 'アウトドア',          url: 'https://ja.aliexpress.com/category/100003067/sports-entertainment.html' },
  { name: 'トラベル',            url: 'https://ja.aliexpress.com/w/wholesale-travel-accessories.html?SearchText=travel+accessories&sortType=total_tranRanking_desc' },
  { name: 'ペット',              url: 'https://ja.aliexpress.com/category/322/pet-products.html' },
  { name: 'カー用品',            url: 'https://ja.aliexpress.com/category/34/car-electronics.html' },
  { name: 'ボードゲーム',        url: 'https://ja.aliexpress.com/category/200001271/toys-hobbies.html' },
  { name: 'キッズ',              url: 'https://ja.aliexpress.com/category/702/toys-hobbies.html' },
  { name: 'アート・クラフト',    url: 'https://ja.aliexpress.com/category/327/arts-crafts.html' },
  { name: '文具',                url: 'https://ja.aliexpress.com/category/320/office-school-supplies.html' },
  { name: 'インテリア',          url: 'https://ja.aliexpress.com/category/44/home-garden.html' },
  { name: '健康',                url: 'https://ja.aliexpress.com/category/200002825/health.html' },
];

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function getAffiliateLink(url) {
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

console.log('\n🔗 カテゴリアフィリエイトリンク生成中...\n');

const results = {};
for (const cat of CATEGORIES) {
  process.stdout.write(`  [${cat.name}] `);
  const link = await getAffiliateLink(cat.url);
  if (link) {
    results[cat.name] = link;
    console.log(`✅ ${link.slice(0, 70)}...`);
  } else {
    results[cat.name] = cat.url; // fallback to original URL
    console.log(`❌ 失敗 → 元URLを使用`);
  }
  await sleep(400);
}

console.log('\n📋 結果:\n');
console.log(JSON.stringify(results, null, 2));
