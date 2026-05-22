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

// Search for Naturehike air mat products
const j = await api('aliexpress.affiliate.product.query', {
  tracking_id: TID,
  keywords: 'naturehike sleeping pad inflatable mat',
  target_currency: 'JPY',
  target_language: 'JA',
  page_no: '1',
  page_size: '10',
  sort: 'SALE_PRICE_ASC',
  fields: 'product_id,product_title,target_sale_price,evaluate_rate,lastest_volume,product_main_image_url,promotion_link',
});

const products = j?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
for (const p of products) {
  console.log(`ID:${p.product_id} PRICE:${p.target_sale_price} RATE:${p.evaluate_rate} SOLD:${p.lastest_volume}`);
  console.log(`  TITLE:${p.product_title?.substring(0,80)}`);
  console.log(`  LINK:${p.promotion_link}`);
  console.log(`  IMG:${p.product_main_image_url}`);
  console.log('');
}
