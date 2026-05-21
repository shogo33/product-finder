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

// Get PS300 synthetic sleeping bag details
const j = await api('aliexpress.affiliate.productdetail.get', {
  product_ids: '1005003404039881', tracking_id: TID, target_currency: 'JPY', target_language: 'JA',
  fields: 'product_id,product_title,target_sale_price,product_main_image_url',
});
const p = j?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products?.product?.[0];
console.log(p ? `ID:${p.product_id} PRICE:${p.target_sale_price}\nIMG:${p.product_main_image_url}\nTITLE:${p.product_title?.substring(0,60)}` : 'NOT FOUND');

await new Promise(r => setTimeout(r, 400));

// Generate short link for PS300
const j2 = await api('aliexpress.affiliate.link.generate', {
  tracking_id: TID, source_values: 'https://www.aliexpress.com/item/1005003404039881.html', promotion_link_type: '0',
});
const link = j2?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link;
console.log(`LINK:${link}`);
