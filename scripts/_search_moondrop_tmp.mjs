import dotenv from 'dotenv';
dotenv.config({ override: true });
import { createHmac } from 'crypto';

const sign = (p) => {
  const s = Object.keys(p).sort().map(k => k + p[k]).join('');
  return createHmac('sha256', process.env.ALIEXPRESS_APP_SECRET).update(s).digest('hex').toUpperCase();
};

async function search(kw) {
  const p = {
    app_key: process.env.ALIEXPRESS_APP_KEY,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID,
    keywords: kw,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '5',
    fields: 'product_id,product_title,sale_price,shop_name'
  };
  p.sign = sign(p);
  const r = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(p)
  }).then(r => r.json());
  console.log('=== ' + kw);
  (r?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [])
    .forEach(x => console.log(x.product_id, '|', x.shop_name, '|', x.sale_price, '|', x.product_title?.slice(0, 80)));
}

await search('Kadenz HiFi earphone');
await search('Moondrop Kadenz in-ear');
await search('MOONDROP Rays 1DD 1Planar gaming');
