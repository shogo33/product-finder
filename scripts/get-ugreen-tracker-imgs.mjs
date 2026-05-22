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

for (const id of ['1005008349940884','1005008346558485','1005009884068928','1005008600891150']) {
  await new Promise(r => setTimeout(r, 400));
  const j = await api('aliexpress.affiliate.productdetail.get', {
    product_ids: id, tracking_id: TID, target_currency: 'JPY', target_language: 'JA',
    fields: 'product_id,product_title,target_sale_price,evaluate_rate,lastest_volume,product_main_image_url',
  });
  const p = j?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products?.product?.[0];
  if (p) {
    console.log(`ID:${p.product_id} ¥${p.target_sale_price} ${p.evaluate_rate} ${p.lastest_volume}件`);
    console.log(`  IMG:${p.product_main_image_url}`);
    console.log(`  ${p.product_title?.substring(0,80)}`);
  } else {
    console.log(`${id}: NOT FOUND`);
    console.log(JSON.stringify(j?.aliexpress_affiliate_productdetail_get_response?.resp_result?.resp_msg));
  }
}
