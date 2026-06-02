import 'dotenv/config';
import fs from 'node:fs';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'junglee~amazon-crawler';
const OUT = 'data/ugreen/amazon-ugreen-catalog.json';

if (!APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN in .env');
  process.exit(1);
}

// Amazon JP search URLs strategies to maximize UGREEN coverage
// Note: Amazon limits search to ~7 pages per query, so we use multiple strategies.
const SEARCH_URLS = [
  // Brand storefront landing
  'https://www.amazon.co.jp/stores/UGREEN/page/B7ACD7FE-CDC4-4ABA-8DBE-DF0EF9241609',
  // Brand-filtered category searches
  'https://www.amazon.co.jp/s?k=UGREEN&i=electronics',
  'https://www.amazon.co.jp/s?k=UGREEN&i=computers',
  'https://www.amazon.co.jp/s?k=UGREEN+%E5%85%85%E9%9B%BB%E5%99%A8', // 充電器
  'https://www.amazon.co.jp/s?k=UGREEN+%E3%83%8F%E3%83%96', // ハブ
  'https://www.amazon.co.jp/s?k=UGREEN+%E3%82%B1%E3%83%BC%E3%83%96%E3%83%AB', // ケーブル
  'https://www.amazon.co.jp/s?k=UGREEN+%E3%83%A2%E3%83%90%E3%82%A4%E3%83%AB%E3%83%90%E3%83%83%E3%83%86%E3%83%AA%E3%83%BC', // モバイルバッテリー
  'https://www.amazon.co.jp/s?k=UGREEN+Nexode',
  'https://www.amazon.co.jp/s?k=UGREEN+Revodok',
  'https://www.amazon.co.jp/s?k=UGREEN+MagFlow',
  'https://www.amazon.co.jp/s?k=UGREEN+Uno',
];

const MAX_PER_URL = 200;
const POLL_INTERVAL_MS = 5000;

async function startRun() {
  const input = {
    categoryOrProductUrls: SEARCH_URLS.map((u) => ({ url: u })),
    maxItemsPerStartUrl: MAX_PER_URL,
    proxyCountry: 'JP',
    useCaptchaSolver: true,
    scrapeProductVariantPrices: false,
    scrapeProductDetails: true, // get full description, A+ content, spec tables
  };

  console.log('Starting Apify Actor run...');
  console.log(`  Actor: ${ACTOR_ID}`);
  console.log(`  Inputs: ${SEARCH_URLS.length} URLs, max ${MAX_PER_URL} items each`);

  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Start failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.data;
}

async function pollRun(runId) {
  while (true) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const json = await res.json();
    const r = json.data;
    const elapsed = ((Date.now() - new Date(r.startedAt).getTime()) / 1000).toFixed(0);
    console.log(`  Status: ${r.status} (${elapsed}s elapsed, ${r.stats?.inputBodyLen || 0} bytes input)`);
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(r.status)) return r;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function downloadDataset(datasetId) {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json&token=${APIFY_TOKEN}`);
  if (!res.ok) throw new Error(`Dataset download failed: ${res.status}`);
  return res.json();
}

async function main() {
  const run = await startRun();
  console.log(`\nRun started: ${run.id}`);
  console.log(`Console URL: ${run.consoleUrl || `https://console.apify.com/actors/runs/${run.id}`}\n`);

  const final = await pollRun(run.id);
  console.log(`\nFinal status: ${final.status}`);
  console.log(`Cost: $${(final.usageTotalUsd || 0).toFixed(4)}`);
  console.log(`Compute units: ${final.stats?.computeUnits?.toFixed(4) || 'n/a'}`);

  if (final.status !== 'SUCCEEDED') {
    console.error('Run did not succeed. Check Apify console for details.');
    process.exit(1);
  }

  const items = await downloadDataset(final.defaultDatasetId);
  console.log(`\nDownloaded ${items.length} items`);

  // Dedupe by ASIN
  const seen = new Set();
  const unique = items.filter((p) => {
    const asin = p.asin || p.ASIN;
    if (!asin || seen.has(asin)) return false;
    seen.add(asin);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify(unique, null, 2));
  console.log(`Unique by ASIN: ${unique.length}`);
  console.log(`Saved to ${OUT}`);

  // Sample
  if (unique.length > 0) {
    console.log('\nSample (first 3):');
    unique.slice(0, 3).forEach((p) => {
      console.log(` - ${p.asin} | ${p.title?.slice(0, 80)} | ${p.brand || ''} | ¥${p.price || ''}`);
    });
    console.log('\nAvailable fields (from first item):');
    console.log(Object.keys(unique[0]).join(', '));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
