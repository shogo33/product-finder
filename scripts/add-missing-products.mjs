/**
 * add-missing-products.mjs — 不足カテゴリの商品補充（ワンタイム実行）
 *
 * テント・寝袋・ペットキャリア・ネオンサイン等の不足商品を追加する。
 * 実行: node scripts/add-missing-products.mjs
 * 推定所要時間: 約8〜12分
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
const TARGET_COUNT = 200;

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
  const rate  = parseFloat((item.evaluate_rate   ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume      ?? '0', 10);
  return price >= 100 && price <= 15000 && rate >= 88 && sales >= 50 && !!item.product_main_image_url;
}

function detectChoice(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume ?? '0', 10);
  return price <= 800 && rate >= 95 && sales >= 500;
}

const NG_PATTERNS = [
  /\beu plug\b/i, /\buk plug\b/i, /\b2[234]0v\b/i,
  /\badult\b/i, /\bsexy\b/i, /\bknife\b/i, /\bseeds?\b/i, /\bdiet\b/i,
  /\bsupplement\b/i, /\bskincare\b/i, /\bdisney\b/i, /\bsanrio\b/i,
  /\banime\b/i, /\bchiikawa\b/i, /\bt-shirt\b/i, /\bdress\b/i,
  /\bpants\b/i, /\bjacket\b/i, /\bshoes\b/i,
];
function isNG(title) { return NG_PATTERNS.some(re => re.test(title ?? '')); }

const VERTICAL_JA    = { gadget:'ガジェット', outdoor:'アウトドア', mens:'メンズ', cute:'シール・ケース', funny:'おもしろ', pet:'ペット', home:'インテリア', relax:'リラックス' };
const VERTICAL_COLOR = { gadget:'from-blue-100 to-blue-200', outdoor:'from-green-100 to-green-200', mens:'from-slate-100 to-slate-200', cute:'from-pink-100 to-pink-200', funny:'from-amber-100 to-amber-200', pet:'from-orange-100 to-orange-200', home:'from-purple-100 to-purple-200', relax:'from-teal-100 to-teal-200' };
const VERTICAL_EMOJI = { gadget:'⚡', outdoor:'🏕️', mens:'🧔', cute:'🌸', funny:'😄', pet:'🐾', home:'🏠', relax:'💆' };

function toSchema(item, vertical, isChoice, affiliateUrl, collectedAt) {
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
    is_choice:     isChoice,
    color:         VERTICAL_COLOR[vertical] ?? 'from-stone-100 to-stone-200',
    emoji:         VERTICAL_EMOJI[vertical] ?? '📦',
    sales_count:   parseInt(item.lastest_volume ?? '0', 10),
    evaluate_rate: parseFloat((item.evaluate_rate ?? '0').replace('%', '')),
    collected_at:  collectedAt,
  };
}

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
    if (!match) throw new Error('no json');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== titles.length) throw new Error('length');
    return parsed.map(n => String(n).slice(0, 30).trim());
  } catch { return titles.map(t => t.slice(0, 30).trim()); }
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
    const sv = batches[i].map(id => `https://www.aliexpress.com/item/${id}.html`).join(',');
    try {
      const json = await callApi('aliexpress.affiliate.link.generate', { tracking_id: TRACKING_ID, source_values: sv, promotion_link_type: '0' });
      const res = json?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link ?? [];
      for (const link of res) {
        const m = (link.source_value ?? '').match(/\/item\/(\d+)\.html/);
        if (m && link.promotion_link) links[m[1]] = link.promotion_link;
      }
      process.stdout.write(`  [${i + 1}/${batches.length}] ${res.length}件\n`);
    } catch (e) { console.error(`  ❌ バッチ${i + 1}: ${e.message}`); }
    await sleep(SLEEP_MS);
  }
  return links;
}

// ── 不足している重要キーワード（全カテゴリ） ─────────────────────────────
const MISSING_KEYWORDS = [
  // アウトドア：テント・寝袋・バーナー・チェア等
  { kw: 'camping tent 2 person lightweight waterproof', vertical: 'outdoor' },
  { kw: 'ultralight backpacking tent solo',             vertical: 'outdoor' },
  { kw: 'sleeping bag mummy cold 3 season',             vertical: 'outdoor' },
  { kw: 'sleeping bag compact lightweight',             vertical: 'outdoor' },
  { kw: 'camping sleeping pad foam insulating',         vertical: 'outdoor' },
  { kw: 'self inflating sleeping mat camping',          vertical: 'outdoor' },
  { kw: 'folding camping table aluminum ultralight',    vertical: 'outdoor' },
  { kw: 'camping chair lightweight foldable',           vertical: 'outdoor' },
  { kw: 'camp stove portable gas burner windproof',     vertical: 'outdoor' },
  { kw: 'titanium camping cookware pot set',            vertical: 'outdoor' },
  { kw: 'water filter straw purification survival',     vertical: 'outdoor' },
  { kw: 'solar panel charger portable outdoor',         vertical: 'outdoor' },
  { kw: 'bug repellent bracelet mosquito outdoor',      vertical: 'outdoor' },
  { kw: 'camping hammock lightweight nylon',            vertical: 'outdoor' },
  { kw: 'tarp camping shelter ultralight',              vertical: 'outdoor' },

  // ガジェット：プロジェクター・スマートプラグ・リングライト等
  { kw: 'mini pocket projector portable led',           vertical: 'gadget' },
  { kw: 'pico projector phone wireless',                vertical: 'gadget' },
  { kw: 'smart wifi plug voice control',                vertical: 'gadget' },
  { kw: 'ring light usb selfie desk led',               vertical: 'gadget' },
  { kw: 'nfc tag sticker programmable phone',           vertical: 'gadget' },
  { kw: 'borescope inspection camera usb android',      vertical: 'gadget' },
  { kw: 'air quality monitor co2 sensor',               vertical: 'gadget' },

  // メンズ：タクティカルペン・時計スタンド・旅行ポーチ等
  { kw: 'tactical pen edc glass breaker writing',       vertical: 'mens' },
  { kw: 'car key case leather smart cover',             vertical: 'mens' },
  { kw: 'watch stand display holder wooden',            vertical: 'mens' },
  { kw: 'travel toiletry organizer pouch men',          vertical: 'mens' },
  { kw: 'men shoulder bag crossbody leather',           vertical: 'mens' },
  { kw: 'zipper coin purse men small',                  vertical: 'mens' },

  // おもしろ：卓上禅・ネオンサイン・ミニバスケ等
  { kw: 'desktop zen garden mini sand rake',            vertical: 'funny' },
  { kw: 'mini basketball hoop wall desk suction',       vertical: 'funny' },
  { kw: 'neon sign led bedroom pink aesthetic',         vertical: 'funny' },
  { kw: 'desktop punching ball stress relief spring',   vertical: 'funny' },
  { kw: 'magic tricks cards beginner set',              vertical: 'funny' },
  { kw: 'miniature building kit diy',                   vertical: 'funny' },

  // ペット：キャリア・爪とぎ・トンネル・グルーミング等
  { kw: 'cat tunnel collapsible play tube toy',         vertical: 'pet' },
  { kw: 'pet backpack carrier cat dog small',           vertical: 'pet' },
  { kw: 'cat scratcher corrugated cardboard pad',       vertical: 'pet' },
  { kw: 'silicone grooming glove pet brush dog cat',    vertical: 'pet' },
  { kw: 'elevated pet bowl stand raised feeder',        vertical: 'pet' },
  { kw: 'cat tree tower scratching post small',         vertical: 'pet' },
  { kw: 'dog leash retractable reflective',             vertical: 'pet' },

  // インテリア：ネオンサイン・フェアリーライト・タッチランプ等
  { kw: 'led neon sign bedroom aesthetic room',         vertical: 'home' },
  { kw: 'usb fairy string lights star twinkle bedroom', vertical: 'home' },
  { kw: 'touch bedside lamp warm dimmer',               vertical: 'home' },
  { kw: 'floating wall shelf corner mount small',       vertical: 'home' },
  { kw: 'macrame wall hanging boho decor',              vertical: 'home' },
  { kw: 'diffuser aroma ultrasonic usb',                vertical: 'home' },
  { kw: 'himalayan salt lamp usb',                      vertical: 'home' },

  // リラックス：フォームローラー・指圧マット・バンド等
  { kw: 'foam roller exercise muscle recovery',         vertical: 'relax' },
  { kw: 'acupressure mat pillow set back pain',         vertical: 'relax' },
  { kw: 'resistance band loop set fabric exercise',     vertical: 'relax' },
  { kw: 'cervical neck traction pillow stretcher',      vertical: 'relax' },
  { kw: 'trigger point massage ball set',               vertical: 'relax' },
  { kw: 'yoga block set foam exercise',                 vertical: 'relax' },

  // シール・ケース：MagSafeウォレット・カメラリング等
  { kw: 'magsafe wallet card holder iphone slim',       vertical: 'cute' },
  { kw: 'camera lens ring protector iphone 15',         vertical: 'cute' },
  { kw: 'phone grip ring stand magnetic magsafe',       vertical: 'cute' },
  { kw: 'clear hard case flower pressed resin',         vertical: 'cute' },
];

// ── メイン ────────────────────────────────────────────────────────────────
(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const start = Date.now();

  console.log('═'.repeat(62));
  console.log('  不足商品補充スクリプト（テント・寝袋・ペットキャリア等）');
  console.log(`  キーワード: ${MISSING_KEYWORDS.length}本 / 目標: ${TARGET_COUNT}件`);
  console.log('═'.repeat(62));

  const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : [];
  const seenIds  = new Set(existing.map(p => p.id));

  // カテゴリ別既存件数を表示
  const catCounts = {};
  existing.forEach(p => { catCounts[p.category] = (catCounts[p.category] ?? 0) + 1; });
  console.log('\n📊 現在のカテゴリ別件数:');
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log(`   ${cat.padEnd(16)} ${n}件`);
  });
  console.log(`\n📦 既存合計: ${existing.length}件\n`);

  const rawItems = [];
  console.log('🔍 収集開始\n');

  for (let i = 0; i < MISSING_KEYWORDS.length; i++) {
    if (rawItems.length >= TARGET_COUNT) break;
    const { kw, vertical } = MISSING_KEYWORDS[i];
    const prefix = `  [${String(i + 1).padStart(2)}/${MISSING_KEYWORDS.length}]`;

    try {
      const items = await queryProducts(kw);
      let added = 0;
      for (const item of items) {
        if (rawItems.length >= TARGET_COUNT) break;
        const id = String(item.product_id);
        if (seenIds.has(id))          continue;
        if (!passesQuality(item))     continue;
        if (isNG(item.product_title)) continue;
        rawItems.push({ item, vertical, isChoice: detectChoice(item) });
        seenIds.add(id);
        added++;
      }
      process.stdout.write(`${prefix} +${added}件  「${kw}」 | 累計 ${rawItems.length}件\n`);
    } catch (e) {
      console.error(`  ❌ 「${kw}」: ${e.message}`);
    }
    await sleep(SLEEP_MS);
  }

  if (!rawItems.length) { console.log('\n⚠️  新規商品なし。'); return; }

  const newIds  = rawItems.map(r => String(r.item.product_id));
  const linkMap = await generateAffiliateLinks(newIds);

  const newProducts = rawItems.map(({ item, vertical, isChoice }) =>
    toSchema(item, vertical, isChoice, linkMap[String(item.product_id)] ?? null, today)
  );

  await cleanAllNames(newProducts);

  const merged = [...existing, ...newProducts];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // カテゴリ別追加件数
  const addedByCat = {};
  newProducts.forEach(p => { addedByCat[p.category] = (addedByCat[p.category] ?? 0) + 1; });

  console.log('\n' + '═'.repeat(62));
  console.log(`✅ 完了  ${elapsed}秒`);
  console.log(`   追加: ${newProducts.length}件 → 合計: ${merged.length}件`);
  console.log('\n【カテゴリ別追加件数】');
  Object.entries(addedByCat).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log(`   ${cat.padEnd(16)} +${n}件`);
  });
  console.log('═'.repeat(62));
})();
