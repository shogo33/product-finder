/**
 * One-shot helper: rebuild a research JSON with specific AliExpress product IDs.
 * Usage: node scripts/rebuild-research.mjs <slug> <pid1,pid2,...>
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL    = 'https://api-sg.aliexpress.com/sync';

const slug = process.argv[2];
const pids = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);
if (!slug || pids.length === 0) {
  console.error('使い方: node scripts/rebuild-research.mjs <slug> <pid1,pid2,...>');
  process.exit(1);
}

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
  return res.json();
}

async function getAffiliateLink(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const json = await callApi('aliexpress.affiliate.link.generate', {
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  });
  return json?.aliexpress_affiliate_link_generate_response
             ?.resp_result?.result?.promotion_links
             ?.promotion_link?.[0]?.promotion_link ?? null;
}

async function fetchProductData(productId) {
  const json = await callApi('aliexpress.affiliate.productdetail.get', {
    tracking_id: TRACKING_ID,
    product_ids: productId,
    target_currency: 'JPY',
    target_language: 'JA',
    fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_small_image_urls,evaluate_rate,lastest_volume,promotion_link',
  });
  const products = json?.aliexpress_affiliate_productdetail_get_response
                       ?.resp_result?.result?.products?.product ?? [];
  return products[0] ?? null;
}

const claude = new Anthropic({ apiKey: CLAUDE_KEY });
let lastClaude = 0;

async function extractCleanName(rawTitle) {
  const wait = 1500 - (Date.now() - lastClaude);
  if (wait > 0) await sleep(wait);
  lastClaude = Date.now();
  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `以下のAliExpress商品名から「ブランド名 + 正確な製品名・型番」を抽出してください。
キーワード詰め込みや仕様詳細は除去してください。結果は1行で出力。
商品名: ${rawTitle}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── 既存のresearch JSONを読み込みベースにする ──
const planPath = path.resolve(`data/articles/${slug}-plan.json`);
const researchPath = path.resolve(`data/articles/${slug}-research.json`);

if (!fs.existsSync(planPath)) {
  console.error(`❌ plan not found: ${planPath}`);
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const existing = fs.existsSync(researchPath)
  ? JSON.parse(fs.readFileSync(researchPath, 'utf8'))
  : {};

console.log(`\n🔧 ${slug} の商品データを差し替えます (${pids.length}件)\n`);

const newProducts = [];

for (let i = 0; i < pids.length; i++) {
  const id = pids[i];
  console.log(`[${i+1}/${pids.length}] ${id}`);

  process.stdout.write('  → 商品データ取得...');
  const p = await fetchProductData(id);
  await sleep(400);

  if (!p) {
    console.log(' ❌ 見つからない - スキップ');
    continue;
  }
  console.log(` "${p.product_title?.slice(0,60)}"`);

  process.stdout.write('  → 商品名クレンジング...');
  const cleanName = await extractCleanName(p.product_title);
  console.log(` "${cleanName}"`);

  // promotion_link is already included from productdetail API
  let affiliateLink = p.promotion_link ?? null;
  if (!affiliateLink) {
    process.stdout.write('  → アフィリエイトリンク(fallback)...');
    affiliateLink = await getAffiliateLink(id);
    await sleep(400);
    console.log(affiliateLink ? ' ✅' : ' ⚠️');
  } else {
    console.log(`  → アフィリエイトリンク... ✅ (detail API)`);
  }

  // 画像取得
  let images = [];
  const raw = p.product_small_image_urls;
  if (raw?.string) {
    images = Array.isArray(raw.string) ? raw.string : [raw.string];
  } else if (typeof raw === 'string') {
    images = raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (p.product_main_image_url && !images.includes(p.product_main_image_url)) {
    images = [p.product_main_image_url, ...images];
  }
  images = images.slice(0, 6);

  newProducts.push({
    product_id:     id,
    rawTitle:       p.product_title,
    cleanName,
    price_jpy:      p.target_sale_price,
    original_price: p.original_price,
    sales_count:    p.lastest_volume ?? 0,
    affiliateLink,
    hasAffiliate:   !!affiliateLink,
    mainImage:      p.product_main_image_url ?? null,
    images,
    amazonPlaceholder: { status: 'pending', searchQuery: cleanName, asin: null, url: null },
    specResult:     null,
    redditReviews:  [],
  });
}

// ── マージして保存 ──
const output = {
  ...existing,
  slug:          plan.slug,
  keyword:       plan.keyword,
  category:      plan.category,
  selectedTitle: plan.selectedTitle,
  sections:      plan.sections,
  faqQuestions:  plan.faqQuestions,
  comparisonTableColumns: plan.comparisonTableColumns,
  internalLinks: plan.internalLinks,
  products:      newProducts,
  tavilyResults: existing.tavilyResults ?? [],
  generatedAt:   new Date().toISOString(),
};

fs.writeFileSync(researchPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\n✅ 保存: ${researchPath}`);
console.log(`📦 商品数: ${newProducts.length}件`);
newProducts.forEach((p, i) => console.log(`  ${i+1}. ${p.cleanName} | ${p.hasAffiliate ? '✅' : '❌'}アフィリエイト`));
console.log(`\n▶ 次: node scripts/step3-write.mjs ${slug}`);
