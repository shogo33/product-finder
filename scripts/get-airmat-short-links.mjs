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
  '1005007556195468',
  '1005007369882010',
  '1005005745694802',
  '1005012088482909',
  '1005005853626333',
];

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
