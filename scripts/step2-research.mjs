/**
 * Step 2: 商品特定 & Tavilyリサーチ
 * 使い方: node scripts/step2-research.mjs <slug> [--product-ids 111,222] [--limit 5]
 * 例:    node scripts/step2-research.mjs baseus-mobile-battery-osusume2
 *        node scripts/step2-research.mjs baseus-mobile-battery-osusume2 --product-ids 1005006001234567,1005006002345678
 * 出力:  data/articles/{slug}-research.json
 *
 * 必要な環境変数:
 *   ANTHROPIC_API_KEY   … Claude Haiku（商品名クレンジング）
 *   ALIEXPRESS_APP_KEY / APP_SECRET / TRACKING_ID … アフィリエイトリンク＆画像取得
 *   TAVILY_API_KEY      … Web・Redditリサーチ（未設定の場合はスキップ）
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── 環境変数 ─────────────────────────────────────────────
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const APP_KEY      = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET   = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID  = process.env.ALIEXPRESS_TRACKING_ID;
const TAVILY_KEY   = process.env.TAVILY_API_KEY;
const API_URL      = 'https://api-sg.aliexpress.com/sync';
const ARTICLES_DIR = path.resolve('data/articles');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── CLI引数パース ─────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args[0];
if (!slug) {
  console.error('使い方: node scripts/step2-research.mjs <slug> [--product-ids 111,222] [--limit 5]');
  process.exit(1);
}

// --product-ids 111,222
const pidIdx   = args.indexOf('--product-ids');
const pidArg   = pidIdx !== -1 ? args[pidIdx + 1] : null;
const forcePids = pidArg && !pidArg.startsWith('--') ? pidArg.split(',').map(s => s.trim()) : [];

// --limit N
const limitIdx = args.indexOf('--limit');
const limitArg = limitIdx !== -1 ? args[limitIdx + 1] : null;
const fetchLimit = limitArg && !limitArg.startsWith('--') ? parseInt(limitArg, 10) : null;

// ── プランJSONを読み込み ──────────────────────────────────
const planPath = path.join(ARTICLES_DIR, `${slug}-plan.json`);
if (!fs.existsSync(planPath)) {
  console.error(`❌ 構成案が見つかりません: ${planPath}`);
  console.error('   先に step1-plan.mjs を実行してください。');
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const keyword  = plan.keyword;
const maxProducts = fetchLimit ?? plan.targetProductCount ?? 5;

console.log(`\n🔬 「${keyword}」のリサーチ開始 (slug: ${slug})\n`);
if (!TAVILY_KEY) console.log('⚠️  TAVILY_API_KEY 未設定 — Tavilyリサーチをスキップします\n');

// ── AliExpress API ────────────────────────────────────────
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

// アフィリエイトリンク生成
async function getAffiliateLink(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const json = await callApi('aliexpress.affiliate.link.generate', {
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  });
  return json?.aliexpress_affiliate_link_generate_response
             ?.resp_result?.result?.promotion_links
             ?.promotion_link?.[0]?.promotion_link ?? null;
}

// 商品詳細取得（メイン画像＋複数画像）
async function fetchProductImages(productId, fallbackName = null) {
  // まず product_id をキーワードとして検索し完全一致を探す
  const tryFetch = async (kw, exactId) => {
    const json = await callApi('aliexpress.affiliate.product.query', {
      tracking_id: TRACKING_ID,
      keywords: kw,
      target_currency: 'JPY',
      target_language: 'JA',
      page_size: '10',
      fields: 'product_id,product_title,product_main_image_url,product_small_image_urls,target_sale_price,original_price,evaluate_rate,lastest_volume',
    });
    const products = json?.aliexpress_affiliate_product_query_response
                         ?.resp_result?.result?.products?.product ?? [];
    return exactId
      ? products.find(x => String(x.product_id) === String(exactId)) ?? null
      : products[0] ?? null;
  };

  let p = await tryFetch(productId, productId);

  // IDで見つからない場合は商品名でフォールバック検索
  if (!p && fallbackName) {
    await sleep(400);
    p = await tryFetch(fallbackName, null);
  }

  if (!p) return { mainImage: null, images: [] };

  // product_small_image_urls は { string: ["url1","url2",...] } または カンマ区切り文字列
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
  return { mainImage: p.product_main_image_url ?? null, images: images.slice(0, 6) };
}

// ── Claude Haiku: 商品名クレンジング ─────────────────────
const claude = new Anthropic({ apiKey: CLAUDE_KEY });
let lastClaude = 0;

async function extractCleanName(rawTitle) {
  // Haiku呼び出し間隔を最低1.5秒確保（レートリミット対策）
  const wait = 1500 - (Date.now() - lastClaude);
  if (wait > 0) await sleep(wait);
  lastClaude = Date.now();

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: `以下のAliExpress商品名から「ブランド名 + 正確な製品名・型番」を抽出してください。
キーワード詰め込みや仕様詳細（色・個数・互換情報など）は除去してください。
結果は1行で出力。例: "Baseus Magnetic Power Bank 20W PPMT-02"

商品名: ${rawTitle}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Tavily API ────────────────────────────────────────────
async function tavilySearch(query, opts = {}) {
  if (!TAVILY_KEY) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query,
        search_depth: 'basic',
        max_results: opts.maxResults ?? 5,
        include_domains: opts.domains ?? [],
        include_answer: false,
      }),
    });
    const json = await res.json();
    return json.results ?? [];
  } catch (e) {
    console.warn(`  ⚠️  Tavilyエラー: ${e.message}`);
    return [];
  }
}

// Tavilyの結果から "reddit.com" を含むものをフィルタ→blockquote用データに整形
function extractRedditReviews(results) {
  return results
    .filter(r => r.url?.includes('reddit.com'))
    .map(r => {
      // URLからサブレディットを抽出: /r/subreddit/...
      const subMatch = r.url.match(/reddit\.com\/r\/([\w]+)/);
      return {
        url:       r.url,
        subreddit: subMatch ? `r/${subMatch[1]}` : 'Reddit',
        title:     r.title ?? '',
        snippet:   (r.content ?? '').slice(0, 300).trim(),
      };
    })
    .filter(r => r.snippet.length > 30); // 空スニペットは除外
}

// ── 商品の収集 ────────────────────────────────────────────
let targetProducts = [];

if (forcePids.length > 0) {
  // --product-ids で明示指定
  const db = JSON.parse(fs.readFileSync(path.resolve('data/products.json'), 'utf8'));
  for (const id of forcePids) {
    const found = db.find(p => String(p.product_id) === id);
    if (found) {
      targetProducts.push(found);
    } else {
      console.warn(`  ⚠️  products.json に ${id} が見つかりません（スキップ）`);
    }
  }
} else {
  // キーワードでproducts.jsonを検索
  const db = JSON.parse(fs.readFileSync(path.resolve('data/products.json'), 'utf8'));
  const kw = keyword.toLowerCase();
  const matched = db.filter(p =>
    p.keyword?.toLowerCase().includes(kw) ||
    p.title?.toLowerCase().includes(kw) ||
    p.title_short?.toLowerCase().includes(kw)
  );
  targetProducts = matched.slice(0, maxProducts);

  if (targetProducts.length === 0) {
    console.log(`⚠️  products.json にキーワード「${keyword}」の商品が見つかりません。`);
    console.log('   AliExpress APIで検索します...\n');

    const json = await callApi('aliexpress.affiliate.product.query', {
      tracking_id: TRACKING_ID,
      keywords: keyword,
      target_currency: 'JPY',
      target_language: 'JA',
      page_size: String(maxProducts),
      fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,evaluate_rate,lastest_volume,commission_rate',
    });
    const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
    targetProducts = raw.map(p => ({
      product_id:         String(p.product_id),
      title:              p.product_title,
      title_short:        null,
      price_jpy:          p.target_sale_price,
      original_price_jpy: p.original_price,
      image_url:          p.product_main_image_url,
      affiliate_link:     p.product_detail_url ?? null,
      evaluate_rate:      p.evaluate_rate,
      sales_count:        p.lastest_volume,
      commission_rate:    p.commission_rate ?? null,
    }));
  }
}

if (targetProducts.length === 0) {
  console.error('❌ 対象商品を取得できませんでした。--product-ids で手動指定してください。');
  process.exit(1);
}

console.log(`📦 対象商品: ${targetProducts.length}件\n`);

// ── 各商品のリサーチ ──────────────────────────────────────
const researchedProducts = [];

for (let i = 0; i < targetProducts.length; i++) {
  const p = targetProducts[i];
  const id = String(p.product_id);
  console.log(`[${i + 1}/${targetProducts.length}] ${id}`);
  console.log(`  元タイトル: ${p.title?.slice(0, 60)}...`);

  // 1. 商品名クレンジング
  process.stdout.write('  → 商品名クレンジング...');
  const cleanName = CLAUDE_KEY ? await extractCleanName(p.title ?? id) : (p.title_short ?? p.title ?? id);
  console.log(` "${cleanName}"`);

  // 2. アフィリエイトリンク取得
  process.stdout.write('  → アフィリエイトリンク...');
  const affiliateLink = await getAffiliateLink(id);
  await sleep(400);
  console.log(affiliateLink ? ' ✅' : ' ⚠️ 取得失敗（既存リンクを使用）');

  // 3. 詳細画像取得（IDで見つからない場合は cleanName でフォールバック）
  process.stdout.write('  → 詳細画像...');
  const { mainImage, images } = await fetchProductImages(id, cleanName);
  await sleep(400);
  console.log(` ${images.length}枚取得`);

  // 4. Tavily: 公式スペック検索
  let specResult = null;
  if (TAVILY_KEY) {
    process.stdout.write('  → Tavilyスペック検索...');
    const specResults = await tavilySearch(`${cleanName} specifications review`, { maxResults: 3 });
    await sleep(500);
    if (specResults.length > 0) {
      specResult = {
        url:     specResults[0].url,
        title:   specResults[0].title,
        content: (specResults[0].content ?? '').slice(0, 800).trim(),
        sources: specResults.map(r => ({ url: r.url, title: r.title })),
      };
      console.log(` "${specResult.title?.slice(0, 40)}..."`);
    } else {
      console.log(' 結果なし');
    }
  }

  // 5. Tavily: Reddit口コミ検索
  let redditReviews = [];
  if (TAVILY_KEY) {
    process.stdout.write('  → Reddit口コミ検索...');
    const redditResults = await tavilySearch(
      `${cleanName} review reddit`,
      { maxResults: 5, domains: ['reddit.com'] }
    );
    await sleep(500);

    // reddit.comドメインから取れない場合は通常検索でreddit URLを拾う
    const allReddit = redditResults.length > 0
      ? redditResults
      : (await tavilySearch(`${cleanName} reddit`, { maxResults: 5 }));
    await sleep(300);

    redditReviews = extractRedditReviews(allReddit);
    console.log(` ${redditReviews.length}件`);
  }

  researchedProducts.push({
    product_id:     id,
    rawTitle:       p.title,
    cleanName,
    price_jpy:      p.price_jpy,
    original_price: p.original_price_jpy,
    evaluate_rate:  p.evaluate_rate,
    sales_count:    p.sales_count,
    affiliateLink:  affiliateLink ?? p.affiliate_link ?? `https://www.aliexpress.com/item/${id}.html`,
    hasAffiliate:   !!affiliateLink,
    mainImage:      mainImage ?? p.image_url ?? null,
    images,
    // Amazonはユーザーが後から確認・入力する
    amazonPlaceholder: {
      status:      'pending',
      searchQuery: cleanName,
      asin:        null,
      url:         null,
    },
    specResult,
    redditReviews,
  });

  console.log();
}

// ── research.json 保存 ───────────────────────────────────
const output = {
  slug,
  keyword,
  category:     plan.category,
  selectedTitle: plan.selectedTitle,
  sections:     plan.sections,
  researchedAt: new Date().toISOString().slice(0, 10),
  products:     researchedProducts,
};

const outPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

// ── 結果サマリー ─────────────────────────────────────────
console.log('─'.repeat(60));
console.log(`✅ リサーチ完了: ${outPath}\n`);
console.log(`📊 商品サマリー:`);
researchedProducts.forEach((p, i) => {
  const reddit = p.redditReviews.length;
  const imgs   = p.images.length;
  const aff    = p.hasAffiliate ? '✅' : '⚠️ なし';
  console.log(`  ${i + 1}. ${p.cleanName}`);
  console.log(`     AliExpress: ${aff} | 画像: ${imgs}枚 | Reddit: ${reddit}件`);
});

// Amazon確認待ちのリストを表示
console.log('\n📌 Amazon確認待ち商品（後から手動でASINを追加）:');
researchedProducts.forEach(p => {
  console.log(`  "${p.cleanName}" → Amazon検索キーワード: "${p.amazonPlaceholder.searchQuery}"`);
});

console.log(`\n▶ 次: node scripts/step3-write.mjs ${slug}`);
