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

async function getShortLink(id) {
  await new Promise(r => setTimeout(r, 400));
  const j = await api('aliexpress.affiliate.link.generate', {
    tracking_id: TID,
    source_values: `https://www.aliexpress.com/item/${id}.html`,
    promotion_link_type: '0',
  });
  const link = j?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link;
  return link || null;
}

const products = [
  { id: '1005005418055003', name: 'USB 3.0マルチハブ' },
  { id: '1005006729904438', name: '透明携帯リングホルダー' },
  { id: '1005001309467144', name: 'HDMIケーブル' },
  { id: '1005009955936582', name: '磁気ケーブルクリップ' },
  { id: '1005007171085301', name: 'パルスオキシメータ' },
  { id: '1005008471075579', name: 'USB C 65W GaN充電器' },
  { id: '1005010524767886', name: '熱消去ペン' },
  { id: '1005011717859425', name: 'モーションセンサーヘッドライト' },
  { id: '1005006727614907', name: 'デスクプロテクターマット' },
  { id: '1005010183166565', name: 'LEDギャラクシープロジェクター' },
];

for (const p of products) {
  const link = await getShortLink(p.id);
  console.log(`${p.name}: ${link || 'FAILED'}`);
}
