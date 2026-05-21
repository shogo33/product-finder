/**
 * add-cheap-products.mjs — ¥100〜¥499 商品の補充（ワンタイム実行）
 *
 * 既存 products.json にない ¥100〜¥499 の商品を追加する。
 * 実行: node scripts/add-cheap-products.mjs
 * 推定所要時間: 約5〜8分
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

// ── 定数 ─────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 50;
const SLEEP_MS     = 1200;
const LINK_BATCH   = 50;
const CLAUDE_BATCH = 10;
const CLAUDE_SLEEP = 1500;
const TARGET_COUNT = 150; // 追加目標件数

// ── ユーティリティ ────────────────────────────────────────────────────────
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

// ── ¥100〜¥499 専用フィルター（少し緩め） ─────────────────────────────────
function passesCheapQuality(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate   ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume      ?? '0', 10);
  return price >= 100 && price <= 499 && rate >= 85 && sales >= 30 && !!item.product_main_image_url;
}

const NG_PATTERNS = [
  /\beu plug\b/i, /\buk plug\b/i, /\b2[234]0v\b/i,
  /\badult\b/i, /\bsexy\b/i, /\bknife\b/i, /\bseeds?\b/i,
  /\bdiet\b/i, /\bsupplement\b/i, /\bskincare\b/i,
  /\bdisney\b/i, /\bsanrio\b/i, /\banime\b/i, /\bchiikawa\b/i,
  /\bt-shirt\b/i, /\bdress\b/i, /\bpants\b/i, /\bjacket\b/i, /\bshoes\b/i,
];
function isNG(title) { return NG_PATTERNS.some(re => re.test(title ?? '')); }

// ── スキーマ ──────────────────────────────────────────────────────────────
const VERTICAL_JA    = { gadget:'ガジェット', outdoor:'アウトドア', mens:'メンズ', cute:'シール・ケース', funny:'おもしろ', pet:'ペット', home:'インテリア', kitchen:'キッチン', tools:'工具・DIY', relax:'リラックス' };
const VERTICAL_COLOR = { gadget:'from-blue-100 to-blue-200', outdoor:'from-green-100 to-green-200', mens:'from-slate-100 to-slate-200', cute:'from-pink-100 to-pink-200', funny:'from-amber-100 to-amber-200', pet:'from-orange-100 to-orange-200', home:'from-purple-100 to-purple-200', kitchen:'from-yellow-100 to-yellow-200', tools:'from-zinc-100 to-zinc-200', relax:'from-teal-100 to-teal-200' };
const VERTICAL_EMOJI = { gadget:'⚡', outdoor:'🏕️', mens:'🧔', cute:'🌸', funny:'😄', pet:'🐾', home:'🏠', kitchen:'🍳', tools:'🔧', relax:'💆' };

function toSchema(item, vertical, affiliateUrl, collectedAt) {
  const tag = VERTICAL_JA[vertical] ?? vertical;
  return {
    id:            String(item.product_id),
    name:          (item.product_title ?? '').slice(0, 60).trim(),
    price:         Math.round(parseFloat(item.target_sale_price ?? '0')),
    image:         item.product_main_image_url,
    images:        [item.product_main_image_url],
    url:           affiliateUrl ?? `https://www.aliexpress.com/item/${item.product_id}.html`,
    tags:          [tag],
    category:      tag,
    is_choice:     false,
    color:         VERTICAL_COLOR[vertical] ?? 'from-stone-100 to-stone-200',
    emoji:         VERTICAL_EMOJI[vertical] ?? '📦',
    sales_count:   parseInt(item.lastest_volume ?? '0', 10),
    evaluate_rate: parseFloat((item.evaluate_rate ?? '0').replace('%', '')),
    collected_at:  collectedAt,
  };
}

// ── Claude Haiku 名前クレンジング ─────────────────────────────────────────
let lastClaudeCall = 0;
async function cleanNamesBatch(titles) {
  const wait = CLAUDE_SLEEP - (Date.now() - lastClaudeCall);
  if (wait > 0) await sleep(wait);
  lastClaudeCall = Date.now();
  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: `以下${titles.length}件のAliExpress商品名を、スマホカード表示用（最大20文字）に整理してください。\nルール: ブランド名（あれば）+ 商品の核心だけ。結果はJSON配列のみ出力。\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}` }],
    });
    const match = msg.content[0].text.trim().match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON not found');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== titles.length) throw new Error('length mismatch');
    return parsed.map(n => String(n).slice(0, 30).trim());
  } catch (e) {
    return titles.map(t => t.slice(0, 30).trim());
  }
}

async function cleanAllNames(products) {
  if (!products.length) return;
  const batches = Math.ceil(products.length / CLAUDE_BATCH);
  console.log(`\n🤖 Haiku クレンジング (${batches}バッチ)\n`);
  for (let i = 0; i < products.length; i += CLAUDE_BATCH) {
    const slice   = products.slice(i, i + CLAUDE_BATCH);
    const cleaned = await cleanNamesBatch(slice.map(p => p.name));
    cleaned.forEach((name, j) => { products[i + j].name = name; });
    process.stdout.write(`  [${Math.floor(i / CLAUDE_BATCH) + 1}/${batches}] ✓ "${cleaned[0]}" など\n`);
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

// ── ¥100〜¥499 に強いキーワード ──────────────────────────────────────────
const CHEAP_KEYWORDS = [
  // シール・ステッカー・文具（最安値帯）
  { kw: 'cute sticker pack mini',             vertical: 'cute' },
  { kw: 'washi tape set kawaii',              vertical: 'cute' },
  { kw: 'sticky note pad cartoon',           vertical: 'cute' },
  { kw: 'bookmark cute animal clip',         vertical: 'cute' },
  { kw: 'small notebook pocket memo',        vertical: 'cute' },
  { kw: 'waterproof sticker vinyl small',    vertical: 'cute' },
  { kw: 'gel pen set kawaii',                vertical: 'cute' },
  // おもしろ・プチギフト
  { kw: 'fidget ring spinning metal',        vertical: 'funny' },
  { kw: 'mini capsule toy blind figure',     vertical: 'funny' },
  { kw: 'small novelty gift keychain',       vertical: 'funny' },
  { kw: 'diy craft kit mini cheap',          vertical: 'funny' },
  // ガジェット小物（超格安アクセサリ）
  { kw: 'cable clip organizer adhesive',     vertical: 'gadget' },
  { kw: 'silicone cable tie reusable set',   vertical: 'gadget' },
  { kw: 'phone ring grip holder cheap',      vertical: 'gadget' },
  { kw: 'mini tripod phone tabletop small',  vertical: 'gadget' },
  { kw: 'screen stylus pen universal',       vertical: 'gadget' },
  { kw: 'dust plug earphone cap set',        vertical: 'gadget' },
  { kw: 'lens cleaning cloth set',           vertical: 'gadget' },
  // ペット小物
  { kw: 'cat toy feather stick cheap',       vertical: 'pet' },
  { kw: 'dog toy ball squeaky small',        vertical: 'pet' },
  { kw: 'cat hair remover roller',           vertical: 'pet' },
  { kw: 'pet snack pouch treat bag',         vertical: 'pet' },
  // ホーム雑貨
  { kw: 'fridge magnet cute decorative',     vertical: 'home' },
  { kw: 'flameless led candle mini set',     vertical: 'home' },
  { kw: 'hook wall adhesive small',          vertical: 'home' },
  // キッチン小物
  { kw: 'kitchen timer small egg',           vertical: 'kitchen' },
  { kw: 'avocado slicer cheap tool',         vertical: 'kitchen' },
  { kw: 'silicone bag clip seal cheap',      vertical: 'kitchen' },
  // アウトドア・EDC
  { kw: 'mini carabiner clip keychain cheap',vertical: 'outdoor' },
  { kw: 'foldable bag hook portable cheap',  vertical: 'outdoor' },
  { kw: 'compass pocket small cheap',        vertical: 'outdoor' },
  // リラックス・セルフケア
  { kw: 'acupressure ring finger stress',    vertical: 'relax' },
  { kw: 'sleep eye mask cheap foam',         vertical: 'relax' },
];

// ── メイン ────────────────────────────────────────────────────────────────
(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const start = Date.now();

  console.log('═'.repeat(60));
  console.log('  ¥100〜¥499 商品補充スクリプト');
  console.log(`  目標: ${TARGET_COUNT}件追加 / キーワード: ${CHEAP_KEYWORDS.length}本`);
  console.log('═'.repeat(60));

  const existingProducts = fs.existsSync(OUT_FILE)
    ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
    : [];
  const seenIds = new Set(existingProducts.map(p => p.id));
  console.log(`\n📦 既存: ${existingProducts.length}件 (¥100〜¥499: ${existingProducts.filter(p => p.price <= 499).length}件)\n`);

  const rawItems = [];
  console.log(`🔍 収集開始\n`);

  for (let i = 0; i < CHEAP_KEYWORDS.length; i++) {
    if (rawItems.length >= TARGET_COUNT) break;
    const { kw, vertical } = CHEAP_KEYWORDS[i];
    const prefix = `  [${String(i + 1).padStart(2)}/${CHEAP_KEYWORDS.length}]`;

    try {
      const items = await queryProducts(kw);
      let added = 0;
      for (const item of items) {
        if (rawItems.length >= TARGET_COUNT) break;
        const id = String(item.product_id);
        if (seenIds.has(id))           continue;
        if (!passesCheapQuality(item)) continue;
        if (isNG(item.product_title))  continue;
        rawItems.push({ item, vertical });
        seenIds.add(id);
        added++;
      }
      process.stdout.write(`${prefix} +${added}件  「${kw}」 | 累計 ${rawItems.length}件\n`);
    } catch (e) {
      console.error(`  ❌ 「${kw}」: ${e.message}`);
    }
    await sleep(SLEEP_MS);
  }

  if (!rawItems.length) {
    console.log('\n⚠️  新規商品なし。処理を終了します。');
    return;
  }

  const newIds  = rawItems.map(r => String(r.item.product_id));
  const linkMap = await generateAffiliateLinks(newIds);

  const newProducts = rawItems.map(({ item, vertical }) =>
    toSchema(item, vertical, linkMap[String(item.product_id)] ?? null, today)
  );

  await cleanAllNames(newProducts);

  const merged = [...existingProducts, ...newProducts];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

  const elapsed    = ((Date.now() - start) / 1000).toFixed(1);
  const cheapAfter = merged.filter(p => p.price <= 499).length;

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ 完了  ${elapsed}秒`);
  console.log(`   追加: ${newProducts.length}件`);
  console.log(`   合計: ${merged.length}件`);
  console.log(`   ¥100〜¥499 商品: ${cheapAfter}件`);
  console.log('═'.repeat(60));
  console.log(`\n📁 出力: ${OUT_FILE}\n`);
})();
