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

const j = await api('aliexpress.affiliate.product.query', {
  tracking_id: TID,
  keywords: 'UGREEN smart tracker finder tag',
  target_currency: 'JPY',
  target_language: 'JA',
  page_no: '1',
  page_size: '10',
  fields: 'product_id,product_title,target_sale_price,evaluate_rate,lastest_volume,product_main_image_url,promotion_link',
});

const products = j?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
for (const p of products) {
  console.log(`ID:${p.product_id} ¥${p.target_sale_price} ${p.evaluate_rate} ${p.lastest_volume}件`);
  console.log(`  ${p.product_title?.substring(0, 80)}`);
  console.log(`  ${p.promotion_link?.substring(0, 60)}`);
  console.log('');
}
if (!products.length) console.log('結果なし');
