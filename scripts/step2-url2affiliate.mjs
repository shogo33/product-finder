/**
 * Step 2a: AliExpress URL → アフィリエイトリンク変換
 * 使い方:
 *   node scripts/step2-url2affiliate.mjs <slug> \
 *     --aliex "https://www.aliexpress.com/item/111.html" \
 *     --aliex "https://www.aliexpress.com/item/222.html" \
 *     --amazon "https://amzn.to/xxxxx" \
 *     --amazon "https://amzn.to/yyyyy"
 *
 * --aliex と --amazon は出現順に 1:1 対応。Amazonが少なければ残りは null。
 *
 * 入力:  コマンドライン引数（AliExpress URL + Amazon URL）
 * 出力:  data/articles/{slug}-urls.json
 *        → step2-research.mjs が読み込んで研究JSONを生成
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');
const API_URL      = 'https://api-sg.aliexpress.com/sync';

const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING   = process.env.ALIEXPRESS_TRACKING_ID;

// ── CLI パース ────────────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args[0];

if (!slug || args.length < 2) {
  console.error('使い方: node scripts/step2-url2affiliate.mjs <slug> --aliex <URL> [--aliex <URL>...] [--amazon <URL>...]');
  process.exit(1);
}

const aliexUrls  = [];
const amazonUrls = [];
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--aliex'  && args[i + 1]) { aliexUrls.push(args[++i]); }
  if (args[i] === '--amazon' && args[i + 1]) { amazonUrls.push(args[++i]); }
}

if (aliexUrls.length === 0) {
  console.error('❌ --aliex URL を1つ以上指定してください');
  process.exit(1);
}

if (!APP_KEY || !APP_SECRET || !TRACKING) {
  console.error('❌ ALIEXPRESS_APP_KEY / APP_SECRET / TRACKING_ID が .env にありません');
  process.exit(1);
}

console.log(`\n🔗 アフィリエイトリンク生成開始 (${aliexUrls.length}件)\n`);

// ── AliExpress product_id 抽出 ────────────────────────────────
function extractProductId(url) {
  // 対応パターン:
  //   /item/1234567890.html
  //   /item/1234567890.html?xxx
  const m = url.match(/[\/\-](\d{10,20})(?:\.html)?/);
  return m ? m[1] : null;
}

// ── AliExpress API ────────────────────────────────────────────
function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function callApi(method, extra) {
  const params = {
    app_key: APP_KEY,
    method,
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    ...extra,
  };
  params.sign = sign(params);
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(params).toString(),
  });
  return res.json();
}

// アフィリエイトリンク生成
async function getAffiliateLink(productId) {
  const url  = `https://www.aliexpress.com/item/${productId}.html`;
  const json = await callApi('aliexpress.affiliate.link.generate', {
    tracking_id:         TRACKING,
    source_values:       url,
    promotion_link_type: '0',
  });
  return json?.aliexpress_affiliate_link_generate_response
               ?.resp_result?.result?.promotion_links
               ?.promotion_link?.[0]?.promotion_link ?? null;
}

// 商品詳細（タイトル・価格・画像）を取得
async function fetchProductDetail(productId) {
  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id:    TRACKING,
    keywords:       productId,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size:      '10',
    fields:         'product_id,product_title,product_main_image_url,product_small_image_urls,target_sale_price,original_price,evaluate_rate,lastest_volume',
  });
  const products = json?.aliexpress_affiliate_product_query_response
                       ?.resp_result?.result?.products?.product ?? [];
  // product_id が完全一致するものを優先
  return products.find(p => String(p.product_id) === String(productId))
      ?? products[0]
      ?? null;
}

// ── メイン処理 ────────────────────────────────────────────────
const results = [];

for (let i = 0; i < aliexUrls.length; i++) {
  const url       = aliexUrls[i];
  const amazonUrl = amazonUrls[i] ?? null;

  const productId = extractProductId(url);
  if (!productId) {
    console.error(`  ❌ product_id を抽出できません: ${url}`);
    results.push({ error: 'product_id not found', originalUrl: url, amazonUrl });
    continue;
  }

  process.stdout.write(`  [${i + 1}/${aliexUrls.length}] product_id: ${productId} → アフィリリンク取得中...`);

  let affiliateLink = null;
  let detail        = null;

  try {
    // アフィリエイトリンク生成
    affiliateLink = await getAffiliateLink(productId);
    process.stdout.write(' 取得完了');

    // 商品詳細取得
    process.stdout.write(' → 商品情報取得中...');
    detail = await fetchProductDetail(productId);
    process.stdout.write(detail ? ' OK' : ' 商品情報なし');
  } catch (e) {
    process.stdout.write(` エラー: ${e.message}`);
  }
  console.log('');

  if (!affiliateLink) {
    console.warn(`  ⚠️  アフィリリンク取得失敗 (product_id: ${productId})`);
  }

  // 画像URL一覧
  let images = [];
  const raw = detail?.product_small_image_urls;
  if (raw?.string) {
    images = Array.isArray(raw.string) ? raw.string : [raw.string];
  } else if (typeof raw === 'string') {
    images = raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  const mainImg = detail?.product_main_image_url ?? null;
  if (mainImg && !images.includes(mainImg)) images = [mainImg, ...images];
  images = images.slice(0, 6);

  results.push({
    product_id:     productId,
    originalUrl:    url,
    affiliateLink:  affiliateLink,
    amazonUrl:      amazonUrl,
    rawTitle:       detail?.product_title ?? null,
    price_jpy:      parseFloat(detail?.target_sale_price ?? '0') || 0,
    original_price: parseFloat(detail?.original_price   ?? '0') || 0,
    evaluate_rate:  detail?.evaluate_rate  ?? null,
    sales_count:    detail?.lastest_volume ?? null,
    mainImage:      mainImg,
    images,
  });
}

// ── 保存 ─────────────────────────────────────────────────────
fs.mkdirSync(ARTICLES_DIR, { recursive: true });
const outPath = path.join(ARTICLES_DIR, `${slug}-urls.json`);
const output  = {
  slug,
  createdAt: new Date().toISOString().slice(0, 10),
  products:  results,
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

// ── サマリー出力 ──────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('📦 取得結果サマリー');
console.log('═'.repeat(60));
for (const p of results) {
  if (p.error) {
    console.log(`  ❌ ${p.originalUrl}`);
    continue;
  }
  const price = p.price_jpy ? `¥${p.price_jpy.toLocaleString('ja-JP')}` : '価格不明';
  const link  = p.affiliateLink ? '✅ アフィリリンクあり' : '❌ アフィリリンクなし';
  const amz   = p.amazonUrl     ? '✅ Amazonリンクあり'   : '— Amazonリンクなし';
  console.log(`  [${p.product_id}] ${price} | ${link} | ${amz}`);
  if (p.rawTitle) console.log(`    → ${p.rawTitle.slice(0, 70)}`);
}

const noLink = results.filter(p => !p.affiliateLink && !p.error).length;
if (noLink > 0) {
  console.log(`\n⚠️  アフィリリンク取得失敗: ${noLink}件`);
  console.log('   → APIレート超過の場合は数秒後に再実行してください');
}

console.log('\n✅ 保存完了: ' + outPath);
console.log('\n次のステップ:');
const pids = results.filter(p => p.product_id).map(p => p.product_id).join(',');
console.log(`  node scripts/step2-research.mjs ${slug} --product-ids ${pids}`);
console.log('');
