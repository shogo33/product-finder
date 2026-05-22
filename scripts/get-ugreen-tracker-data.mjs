import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';

const KEY = process.env.ALIEXPRESS_APP_KEY;
const SEC = process.env.ALIEXPRESS_APP_SECRET;
const TID = process.env.ALIEXPRESS_TRACKING_ID;
const URL = 'https://api-sg.aliexpress.com/sync';

function sign(p) {
  return crypto.createHmac('sha256', SEC).update(Object.keys(p).sort().map(k => k + p[k]).join('')).digest('hex').toUpperCase();
}
async function api(m, e) {
  const p = { app_key: KEY, method: m, sign_method: 'sha256', timestamp: String(Date.now()), ...e };
  p.sign = sign(p);
  const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p).toString() });
  return r.json();
}

const ids = [
  '1005008349940884', // UGREEN ウォレットファインダー 基本
  '1005008346558485', // UGREEN ウォレットファインダー 上位
  '1005009884068928', // UGREEN FineTrack Find My対応
  '1005008600891150', // UGREEN Smarttrack K
];

// 商品詳細取得
await new Promise(r => setTimeout(r, 300));
const detail = await api('aliexpress.affiliate.productdetail.get', {
  product_ids: ids.join(','),
  tracking_id: TID,
  target_currency: 'JPY',
  target_language: 'JA',
  fields: 'product_id,product_title,target_sale_price,evaluate_rate,lastest_volume,product_main_image_url',
});
const prods = detail?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products?.product || [];
for (const p of prods) {
  console.log(`\nID:${p.product_id}`);
  console.log(`TITLE:${p.product_title}`);
  console.log(`PRICE:${p.target_sale_price} RATE:${p.evaluate_rate} SOLD:${p.lastest_volume}`);
  console.log(`IMG:${p.product_main_image_url}`);
}

// ショートリンク生成
console.log('\n--- SHORT LINKS ---');
for (const id of ids) {
  await new Promise(r => setTimeout(r, 400));
  const j = await api('aliexpress.affiliate.link.generate', {
    tracking_id: TID,
    source_values: `https://www.aliexpress.com/item/${id}.html`,
    promotion_link_type: '0',
  });
  const link = j?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link;
  console.log(`${id}: ${link || 'FAILED'}`);
}
