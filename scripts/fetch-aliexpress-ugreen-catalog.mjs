import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';

const UGREEN_SHOP_ID = '1103243235';
const OUT = 'data/ugreen/aliexpress-store-catalog.json';
const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const DELAY_MS = 300;

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.error('Missing ALIEXPRESS_* in .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sign(params) {
  const sorted = Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function queryPage(keywords, pageNo) {
  const params = {
    app_key: APP_KEY,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    tracking_id: TRACKING_ID,
    keywords,
    target_currency: 'JPY',
    target_language: 'JA',
    ship_to_country: 'JP',
    page_size: String(PAGE_SIZE),
    page_no: String(pageNo),
    fields: [
      'product_id', 'product_title', 'product_main_image_url',
      'product_detail_url', 'promotion_link',
      'sale_price', 'target_sale_price',
      'shop_id', 'shop_url',
      'first_level_category_name', 'second_level_category_name',
      'evaluate_rate', 'lastest_volume',
    ].join(','),
  };
  params.sign = sign(params);
  const res = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  const resp = json?.aliexpress_affiliate_product_query_response?.resp_result;
  if (!resp || resp.resp_code !== 200) return { products: [] };
  return { products: resp.result?.products?.product || [] };
}

async function fetchForKeyword(keywords, maxUgreenStreakEmpty = 2) {
  const found = [];
  let emptyStreak = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { products } = await queryPage(keywords, page);
    if (products.length === 0) break;
    const ugreen = products.filter((p) => String(p.shop_id) === UGREEN_SHOP_ID);
    if (ugreen.length === 0) emptyStreak++;
    else emptyStreak = 0;
    found.push(...ugreen);
    if (emptyStreak >= maxUgreenStreakEmpty) break;
    if (products.length < PAGE_SIZE) break;
    await sleep(DELAY_MS);
  }
  return found;
}

function buildKeywords() {
  const jp = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));

  const base = [
    'UGREEN',
    'UGREEN Nexode', 'UGREEN Nexode Pro', 'UGREEN Nexode Air', 'UGREEN Nexode Mini',
    'UGREEN Revodok', 'UGREEN Revodok Pro',
    'UGREEN MagFlow', 'UGREEN MagFlow Air',
    'UGREEN Uno',
    'UGREEN Maxidok', 'UGREEN DigiNest',
    'UGREEN PowerRoam',
    'UGREEN charger', 'UGREEN GaN', 'UGREEN GaN charger',
    'UGREEN cable', 'UGREEN USB-C cable', 'UGREEN Lightning cable',
    'UGREEN hub', 'UGREEN USB-C hub', 'UGREEN dock', 'UGREEN docking station',
    'UGREEN Thunderbolt', 'UGREEN Thunderbolt 5',
    'UGREEN power bank', 'UGREEN powerbank', 'UGREEN mobile battery',
    'UGREEN MagSafe', 'UGREEN Qi2', 'UGREEN wireless charger',
    'UGREEN car charger', 'UGREEN retractable',
    'UGREEN SD card reader',
    'UGREEN solar panel', 'UGREEN portable power station',
  ];

  // Watt-based
  const watts = new Set();
  jp.forEach((p) => {
    const txt = (p.title || '') + ' ' + JSON.stringify(p.specs || {});
    (txt.match(/(\d{2,4})\s*[Ww]/g) || []).forEach((m) => {
      const v = parseInt(m, 10);
      if (v >= 18 && v <= 2400) watts.add(v);
    });
  });
  const wattKw = [...watts].sort((a, b) => a - b).map((w) => `UGREEN ${w}W`);

  // Capacity-based (mAh)
  const mahs = new Set();
  jp.forEach((p) => {
    const txt = (p.title || '') + ' ' + JSON.stringify(p.specs || {});
    (txt.match(/(\d{4,6})\s*mAh/gi) || []).forEach((m) => {
      const v = parseInt(m, 10);
      if (v >= 1000 && v <= 100000) mahs.add(v);
    });
  });
  const mahKw = [...mahs].sort((a, b) => a - b).map((m) => `UGREEN ${m}mAh`);

  // Model numbers from specs
  const models = new Set();
  jp.forEach((p) => {
    const mc = p.specs?.['製品型番'];
    if (mc && /^[A-Z0-9-]+$/i.test(mc) && mc.length >= 3 && mc.length <= 12) {
      models.add(mc.trim());
    }
  });
  const modelKw = [...models].map((m) => `UGREEN ${m}`);

  // X-in-Y patterns
  const inY = ['UGREEN 2-in-1', 'UGREEN 3-in-1', 'UGREEN 4-in-1', 'UGREEN 6-in-1', 'UGREEN 7-in-1', 'UGREEN 8-in-1', 'UGREEN 9-in-1', 'UGREEN 10-in-1', 'UGREEN 13-in-1', 'UGREEN 17-in-1'];

  return [...new Set([...base, ...wattKw, ...mahKw, ...modelKw, ...inY])];
}

async function main() {
  const keywords = buildKeywords();
  console.log(`Searching AliExpress with ${keywords.length} keyword strategies, filter shop_id=${UGREEN_SHOP_ID}\n`);

  // Start from existing catalog if present (so re-runs accumulate)
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log(`(Resuming from existing catalog: ${existing.length} items)\n`);
  } catch {}

  const seen = new Set(existing.map((p) => String(p.product_id)));
  const all = [...existing];

  let kwIdx = 0;
  for (const kw of keywords) {
    kwIdx++;
    const results = await fetchForKeyword(kw);
    const newOnes = results.filter((p) => !seen.has(String(p.product_id)));
    newOnes.forEach((p) => seen.add(String(p.product_id)));
    all.push(...newOnes);
    console.log(`[${kwIdx}/${keywords.length}] "${kw}" → ${results.length} UGREEN hits, +${newOnes.length} new (total ${all.length})`);
    if (kwIdx % 10 === 0) {
      // Save snapshot every 10 keywords
      fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
  console.log(`\n=== Done ===`);
  console.log(`Total unique UGREEN catalog: ${all.length}`);
  console.log(`Saved to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
