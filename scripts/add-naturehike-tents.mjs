/**
 * add-naturehike-tents.mjs — NaturehikeテントをDBに追加
 * 実行: node scripts/add-naturehike-tents.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE  = path.resolve(__dirname, '../public/products.json');
const API_URL   = 'https://api-sg.aliexpress.com/sync';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) { console.error('❌ APIキー未設定'); process.exit(1); }
if (!CLAUDE_KEY) { console.error('❌ ANTHROPIC_API_KEY 未設定'); process.exit(1); }

const claude = new Anthropic({ apiKey: CLAUDE_KEY });

const PAGE_SIZE    = 50;
const SLEEP_MS     = 1200;
const LINK_BATCH   = 50;
const CLAUDE_BATCH = 10;
const CLAUDE_SLEEP = 1500;
const TARGET_COUNT = 20;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function callApi(method, extra) {
  const params = { app_key: APP_KEY, method, sign_method: 'sha256', timestamp: String(Date.now()), ...extra };
  params.sign = sign(params);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function queryProducts(keywords) {
  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords,
    target_currency: 'JPY',
    page_size: String(PAGE_SIZE),
    sort: 'VOLUME_DESC',
    fields: ['product_id','product_title','product_main_image_url','target_sale_price','evaluate_rate','lastest_volume'].join(','),
  });
  return json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
}

function passesQuality(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume ?? '0', 10);
  // テントは5,000〜60,000円、評価率85%以上、販売数20件以上
  return price >= 5000 && price <= 60000 && rate >= 85 && sales >= 20 && !!item.product_main_image_url;
}

function isNaturehike(title) {
  return /naturehike/i.test(title ?? '');
}

const NG_PATTERNS = [
  /\beu plug\b/i, /\buk plug\b/i,
  /\badult\b/i, /\bsexy\b/i,
];
function isNG(title) { return NG_PATTERNS.some(re => re.test(title ?? '')); }

function toSchema(item, affiliateUrl, collectedAt) {
  return {
    id:            String(item.product_id),
    name:          (item.product_title ?? '').slice(0, 60).trim(),
    price:         Math.round(parseFloat(item.target_sale_price ?? '0')),
    image:         item.product_main_image_url,
    images:        [item.product_main_image_url],
    url:           affiliateUrl ?? `https://www.aliexpress.com/item/${item.product_id}.html`,
    tags:          ['アウトドア'],
    category:      'アウトドア',
    is_choice:     false,
    color:         'from-green-100 to-green-200',
    emoji:         '⛺',
    sales_count:   parseInt(item.lastest_volume ?? '0', 10),
    evaluate_rate: parseFloat((item.evaluate_rate ?? '0').replace('%', '')),
    collected_at:  collectedAt,
  };
}

async function cleanNamesBatch(titles) {
  const wait = CLAUDE_SLEEP - (Date.now() - (cleanNamesBatch._last || 0));
  if (wait > 0) await sleep(wait);
  cleanNamesBatch._last = Date.now();
  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: `以下${titles.length}件のAliExpress商品名を、スマホカード表示用（最大20文字）に整理してください。ブランド名（Naturehike等）とモデル名は残す。結果はJSON配列のみ出力。\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}` }],
    });
    const match = msg.content[0].text.trim().match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON not found');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== titles.length) throw new Error('length mismatch');
    return parsed.map(n => String(n).slice(0, 30).trim());
  } catch {
    return titles.map(t => t.slice(0, 30).trim());
  }
}

async function generateAffiliateLinks(productIds) {
  const links = {};
  if (!productIds.length) return links;
  const batches = [];
  for (let i = 0; i < productIds.length; i += LINK_BATCH) batches.push(productIds.slice(i, i + LINK_BATCH));
  console.log(`\n🔗 アフィリエイトリンク生成 (${batches.length}バッチ)\n`);
  for (let i = 0; i < batches.length; i++) {
    const sourceValues = batches[i].map(id => `https://www.aliexpress.com/item/${id}.html`).join(',');
    try {
      const json = await callApi('aliexpress.affiliate.link.generate', { tracking_id: TRACKING_ID, source_values: sourceValues, promotion_link_type: '0' });
      const result = json?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link ?? [];
      for (const link of result) {
        const m = (link.source_value ?? '').match(/\/item\/(\d+)\.html/);
        if (m && link.promotion_link) links[m[1]] = link.promotion_link;
      }
      process.stdout.write(`  [${i + 1}/${batches.length}] ${result.length}件\n`);
    } catch (e) { console.error(`  ❌ バッチ${i + 1}: ${e.message}`); }
    await sleep(SLEEP_MS);
  }
  return links;
}

const KEYWORDS = [
  'Naturehike Cloud Up 2 tent ultralight',
  'Naturehike Cloud Up 1 tent solo',
  'Naturehike Mongar tent 2 person',
  'Naturehike Star River tent camping',
  'Naturehike VIK tent ultralight',
  'Naturehike Hiby tent 3 4 person',
  'Naturehike camping tent 2 person waterproof',
  'Naturehike backpacking tent lightweight',
  'Naturehike tunnel tent',
  'Naturehike beach tent sun shelter',
];

async function main() {
  console.log('════════════════════════════════════════');
  console.log('  Naturehike テント 収集スクリプト');
  console.log(`  目標: ${TARGET_COUNT}件追加`);
  console.log('════════════════════════════════════════\n');

  const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  const existingIds = new Set(existing.map(p => p.id));
  console.log(`📦 既存: ${existing.length}件\n🔍 収集開始\n`);

  const newProducts = [];
  const collectedAt = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < KEYWORDS.length; i++) {
    const kw = KEYWORDS[i];
    if (newProducts.length >= TARGET_COUNT) break;
    try {
      const items = await queryProducts(kw);
      let added = 0;
      for (const item of items) {
        if (newProducts.length >= TARGET_COUNT) break;
        const id = String(item.product_id);
        if (existingIds.has(id)) continue;
        if (!passesQuality(item)) continue;
        if (!isNaturehike(item.product_title)) continue;
        if (isNG(item.product_title)) continue;
        existingIds.add(id);
        newProducts.push(toSchema(item, null, collectedAt));
        added++;
      }
      process.stdout.write(`  [${String(i + 1).padStart(2)}/${KEYWORDS.length}] +${added}件  「${kw}」 | 累計 ${newProducts.length}件\n`);
    } catch (e) {
      process.stdout.write(`  [${String(i + 1).padStart(2)}/${KEYWORDS.length}] ❌ ${e.message}\n`);
    }
    await sleep(SLEEP_MS);
  }

  if (!newProducts.length) {
    console.log('\n⚠️  新規商品が見つかりませんでした');
    return;
  }

  const affiliateLinks = await generateAffiliateLinks(newProducts.map(p => p.id));
  for (const p of newProducts) {
    if (affiliateLinks[p.id]) p.url = affiliateLinks[p.id];
  }

  const batches = Math.ceil(newProducts.length / CLAUDE_BATCH);
  console.log(`\n🤖 Haiku クレンジング (${batches}バッチ)\n`);
  for (let i = 0; i < newProducts.length; i += CLAUDE_BATCH) {
    const slice   = newProducts.slice(i, i + CLAUDE_BATCH);
    const cleaned = await cleanNamesBatch(slice.map(p => p.name));
    cleaned.forEach((name, j) => { newProducts[i + j].name = name; });
    process.stdout.write(`  [${Math.floor(i / CLAUDE_BATCH) + 1}/${batches}] ✓ "${cleaned[0]}" など\n`);
  }

  const merged = [...existing, ...newProducts];
  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2));

  console.log('\n════════════════════════════════════════');
  console.log(`✅ 完了  追加: ${newProducts.length}件  合計: ${merged.length}件`);
  console.log('\n追加されたNaturehikeテント:');
  newProducts.forEach(p => console.log(`  ${p.price.toLocaleString()}円 | ${p.name} | ${p.id}`));
  console.log('════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
