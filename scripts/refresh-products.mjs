/**
 * refresh-products.mjs — ローリングリフレッシュ（毎日自動実行）
 *
 * 165キーワードを7グループに分割し、毎日1グループ分だけ再収集する。
 * - 今日のカテゴリ: API再問い合わせで生存確認 + collected_at更新 + 新商品追加
 * - 今日以外のカテゴリ: 変更なし
 * - MAX_POOL=1200 を超えたら collected_at が古い順にトリム
 * - data/refresh-state.json にローテーション状態を保存
 *
 * 実行: node scripts/refresh-products.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ override: true });

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE   = path.resolve(__dirname, '../public/products.json');
const STATE_FILE = path.resolve(__dirname, '../data/refresh-state.json');
const API_URL    = 'https://api-sg.aliexpress.com/sync';

// ── 環境変数 ──────────────────────────────────────────────────────────────
const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.error('❌ ALIEXPRESS_APP_KEY / APP_SECRET / TRACKING_ID が未設定');
  process.exit(1);
}
if (!CLAUDE_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が未設定');
  process.exit(1);
}

const claude = new Anthropic({ apiKey: CLAUDE_KEY });

// ── 定数 ─────────────────────────────────────────────────────────────────
const MAX_POOL         = 1200;
const KEYWORDS_PER_DAY = 24;
const PAGE_SIZE        = 50;
const SLEEP_MS         = 1200;
const LINK_BATCH       = 50;
const CLAUDE_BATCH     = 10;
const CLAUDE_SLEEP     = 1500;
const JACCARD_THRESH   = 0.75;

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

// ── フィルター ────────────────────────────────────────────────────────────
function detectChoice(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume ?? '0', 10);
  return price <= 800 && rate >= 95 && sales >= 500;
}

const NG_PATTERNS = [
  /\beu plug\b/i, /\buk plug\b/i, /\b2[234]0v\b/i, /\bpower strip\b/i, /\bwall socket\b/i, /\bschuko\b/i,
  /\badult\b/i, /\bsexy\b/i, /\blaser pointer\b/i, /\bknife\b/i,
  /\bseeds?\b/i, /\bdiet\b/i, /\bsupplement\b/i, /\bskincare\b/i,
  /\bessential oil\b/i, /\bliquid bottle\b/i, /\bgel bottle\b/i, /\bpowder\b/i,
  /\bbaby toy mouth\b/i, /\bpacifier\b/i,
  /\bdisney\b/i, /\bsanrio\b/i, /\banime\b/i, /\bchiikawa\b/i,
  /\bluxury brand\b/i, /\bdesigner replica\b/i,
  /\bt-shirt\b/i, /\bdress\b/i, /\bpants\b/i, /\bjacket\b/i, /\bshoes\b/i,
  /\bchristmas socks\b/i, /\bnovelty socks\b/i, /\bfunny socks\b/i,
  /\bduct tape\b/i, /\bpacking tape\b/i, /\btrash bag\b/i,
  /\bkitchen sponge\b/i, /\bdish cloth\b/i, /\bstorage box big\b/i,
];
function isNG(title) { return NG_PATTERNS.some(re => re.test(title ?? '')); }

function passesQuality(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate   ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume      ?? '0', 10);
  return price >= 100 && price <= 15000 && rate >= 88 && sales >= 50 && !!item.product_main_image_url;
}

// ── 重複排除 ──────────────────────────────────────────────────────────────
const TECH_TOKEN_SET = new Set([
  'usb','cable','charger','hub','hdmi','bluetooth','wireless','fast','charge',
  '100w','65w','45w','20w','15w','pd','gan','3in1','mouse','keyboard',
  'speaker','earbuds','tws','webcam','fan','stand','monitor','light',
  'lamp','desk','mat','powerbank','ssd','magsafe','magnetic','mount','holder',
  'screwdriver','caliper','laser','level','stripper','multitool','drill',
]);

function tokenize(title) {
  const lower = (title ?? '').toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = lower.split(/\s+/).filter(w => TECH_TOKEN_SET.has(w));
  const nums  = (title ?? '').match(/\d+/g) ?? [];
  return new Set([...words, ...nums]);
}

function isTechDuplicate(title, seenSets) {
  const tokens = tokenize(title);
  if (tokens.size === 0) return false;
  for (const seen of seenSets) {
    const inter = [...tokens].filter(t => seen.has(t)).length;
    const union = new Set([...tokens, ...seen]).size;
    if (union > 0 && inter / union >= JACCARD_THRESH) return true;
  }
  return false;
}

// ── スキーマ ──────────────────────────────────────────────────────────────
const VERTICAL_JA = {
  gadget: 'ガジェット', outdoor: 'アウトドア', mens: 'メンズ',
  cute: 'シール・ケース', funny: 'おもしろ', pet: 'ペット',
  home: 'インテリア', relax: 'リラックス',
};
const VERTICAL_COLOR = {
  gadget: 'from-blue-100 to-blue-200', outdoor: 'from-green-100 to-green-200',
  mens: 'from-slate-100 to-slate-200', cute: 'from-pink-100 to-pink-200',
  funny: 'from-amber-100 to-amber-200', pet: 'from-orange-100 to-orange-200',
  home: 'from-purple-100 to-purple-200', kitchen: 'from-yellow-100 to-yellow-200',
  tools: 'from-zinc-100 to-zinc-200', relax: 'from-teal-100 to-teal-200',
};
const VERTICAL_EMOJI = {
  gadget: '⚡', outdoor: '🏕️', mens: '🧔', cute: '🌸', funny: '😄',
  pet: '🐾', home: '🏠', relax: '💆',
};
const JA_TO_VERTICAL = Object.fromEntries(Object.entries(VERTICAL_JA).map(([v, ja]) => [ja, v]));

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

function getVertical(product) {
  return JA_TO_VERTICAL[product.category] ?? JA_TO_VERTICAL[product.tags?.[0]] ?? 'gadget';
}

// ── Claude Haiku 名前クレンジング ─────────────────────────────────────────
let lastClaudeCall = 0;

async function cleanNamesBatch(titles) {
  const wait = CLAUDE_SLEEP - (Date.now() - lastClaudeCall);
  if (wait > 0) await sleep(wait);
  lastClaudeCall = Date.now();

  const numbered = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `以下${titles.length}件のAliExpress商品名を、スマホカード表示用（最大20文字）に整理してください。\nルール: ブランド名（あれば）+ 商品の核心だけ。スペック・色・個数・互換情報は省略。\n結果はJSON配列（文字列${titles.length}個）のみ出力。余計なテキスト不要。\n例: ["Baseus 100W充電ケーブル", "UGREEN USBハブ 7in1"]\n\n商品名リスト:\n${numbered}`,
      }],
    });
    const text  = msg.content[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON配列が見つかりません');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== titles.length) throw new Error('長さ不一致');
    return parsed.map(n => String(n).slice(0, 30).trim());
  } catch (e) {
    console.error(`  ⚠️  名前クレンジング失敗: ${e.message}`);
    return titles.map(t => t.slice(0, 30).trim());
  }
}

async function cleanAllNames(products) {
  if (products.length === 0) return;
  const batches = Math.ceil(products.length / CLAUDE_BATCH);
  console.log(`\n🤖 Haiku クレンジング (${batches}バッチ)\n`);
  for (let i = 0; i < products.length; i += CLAUDE_BATCH) {
    const slice   = products.slice(i, i + CLAUDE_BATCH);
    const cleaned = await cleanNamesBatch(slice.map(p => p.name));
    cleaned.forEach((name, j) => { products[i + j].name = name; });
    process.stdout.write(`  [${Math.floor(i / CLAUDE_BATCH) + 1}/${batches}] ✓ "${cleaned[0]}" など\n`);
  }
}

// ── アフィリエイトリンク生成 ──────────────────────────────────────────────
async function generateAffiliateLinks(productIds) {
  const links = {};
  const batches = [];
  for (let i = 0; i < productIds.length; i += LINK_BATCH) batches.push(productIds.slice(i, i + LINK_BATCH));
  if (batches.length === 0) return links;
  console.log(`\n🔗 アフィリエイトリンク生成 (${batches.length}バッチ)\n`);

  for (let i = 0; i < batches.length; i++) {
    const sourceValues = batches[i].map(id => `https://www.aliexpress.com/item/${id}.html`).join(',');
    try {
      const json = await callApi('aliexpress.affiliate.link.generate', {
        tracking_id: TRACKING_ID,
        source_values: sourceValues,
        promotion_link_type: '0',
      });
      const resultLinks = json?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link ?? [];
      for (const link of resultLinks) {
        const m = (link.source_value ?? '').match(/\/item\/(\d+)\.html/);
        if (m && link.promotion_link) links[m[1]] = link.promotion_link;
      }
      process.stdout.write(`  [${i + 1}/${batches.length}] ${resultLinks.length}件取得\n`);
    } catch (e) {
      console.error(`  ❌ バッチ${i + 1}エラー: ${e.message}`);
    }
    await sleep(SLEEP_MS);
  }
  return links;
}

// ── 状態管理 ──────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { groupIndex: 0, lastRun: null }; }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ── プール管理 ────────────────────────────────────────────────────────────
function loadExisting() {
  if (!fs.existsSync(OUT_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch { return []; }
}

function trimPool(products, maxSize) {
  if (products.length <= maxSize) return products;
  return [...products]
    .sort((a, b) => (a.collected_at || '2020-01-01').localeCompare(b.collected_at || '2020-01-01'))
    .slice(products.length - maxSize);
}

// ── キーワードリスト（collect-products.mjs と同一） ───────────────────────
const KEYWORD_PLAN = [
  { kw: 'Baseus new arrival',               vertical: 'gadget' },
  { kw: 'Baseus magnetic charger',          vertical: 'gadget' },
  { kw: 'UGREEN official cable',            vertical: 'gadget' },
  { kw: 'UGREEN usb hub',                   vertical: 'gadget' },
  { kw: 'Toocki usb c cable',               vertical: 'gadget' },
  { kw: 'Mcdodo gan charger',               vertical: 'gadget' },
  { kw: 'Mcdodo cable',                     vertical: 'gadget' },
  { kw: 'Essager fast charge cable',        vertical: 'gadget' },
  { kw: 'Vention usb hub dock',             vertical: 'gadget' },
  { kw: 'Hoto screwdriver set',             vertical: 'gadget' },
  { kw: '3 in 1 charging cable fast',       vertical: 'gadget' },
  { kw: 'tws earbuds noise cancelling',     vertical: 'gadget' },
  { kw: 'bone conduction headphones',       vertical: 'gadget' },
  { kw: 'rgb soundbar desktop speaker',     vertical: 'gadget' },
  { kw: 'monitor light bar usb',            vertical: 'gadget' },
  { kw: 'cable management under desk',      vertical: 'gadget' },
  { kw: 'magnetic cable clip holder',       vertical: 'gadget' },
  { kw: 'mouse jiggler mover',              vertical: 'gadget' },
  { kw: 'wireless charging pad 15w',        vertical: 'gadget' },
  { kw: 'usb c hub multiport',             vertical: 'gadget' },
  { kw: 'mini bluetooth speaker portable',  vertical: 'gadget' },
  { kw: 'pillow speaker sleep bluetooth',   vertical: 'gadget' },
  { kw: 'smart watch health tracker',       vertical: 'gadget' },
  { kw: 'controller silicone grip case',    vertical: 'gadget' },
  { kw: 'laptop stand aluminum portable',   vertical: 'gadget' },
  { kw: 'gaming desk mat large',            vertical: 'gadget' },
  { kw: 'led desk lamp flexible usb',       vertical: 'gadget' },
  { kw: 'power bank 10000mah slim',         vertical: 'gadget' },
  { kw: 'silent wireless mouse',            vertical: 'gadget' },
  { kw: 'usb desk fan quiet',              vertical: 'gadget' },
  { kw: 'phone holder arm clamp desk',      vertical: 'gadget' },
  { kw: 'artisan keycap resin',             vertical: 'gadget' },
  { kw: 'webcam 1080p usb',               vertical: 'gadget' },
  { kw: 'usb c to 3.5mm audio adapter',    vertical: 'gadget' },
  { kw: 'anti blue light glasses',          vertical: 'gadget' },
  { kw: 'wrist rest keyboard gel',          vertical: 'gadget' },
  { kw: 'screen cleaning kit',             vertical: 'gadget' },
  { kw: 'cable tie velcro reusable',        vertical: 'gadget' },
  { kw: 'phone cooling fan clip',           vertical: 'gadget' },
  { kw: 'portable ssd enclosure usb c',     vertical: 'gadget' },
  { kw: 'Naturehike camping tent',          vertical: 'outdoor' },
  { kw: 'Naturehike sleeping bag',          vertical: 'outdoor' },
  { kw: 'Naturehike ultralight gear',       vertical: 'outdoor' },
  { kw: 'Naturehike hiking backpack',       vertical: 'outdoor' },
  { kw: 'Widesea camping cookware set',     vertical: 'outdoor' },
  { kw: 'Widesea titanium cup',             vertical: 'outdoor' },
  { kw: 'edc carabiner multi function',     vertical: 'outdoor' },
  { kw: 'edc keychain tool kit',            vertical: 'outdoor' },
  { kw: 'led headlamp rechargeable',        vertical: 'outdoor' },
  { kw: 'solar camping lantern',            vertical: 'outdoor' },
  { kw: 'inflatable camping pillow',        vertical: 'outdoor' },
  { kw: 'quick dry microfiber towel',       vertical: 'outdoor' },
  { kw: 'foldable water bottle silicone',   vertical: 'outdoor' },
  { kw: 'emergency survival kit',           vertical: 'outdoor' },
  { kw: 'waterproof dry bag roll top',      vertical: 'outdoor' },
  { kw: 'trekking pole ultralight',         vertical: 'outdoor' },
  { kw: 'edc permanent match',             vertical: 'outdoor' },
  { kw: 'uv blacklight flashlight mini',    vertical: 'outdoor' },
  { kw: 'compass outdoor navigation',       vertical: 'outdoor' },
  { kw: 'paracord bracelet survival',       vertical: 'outdoor' },
  { kw: 'tactical flashlight rechargeable', vertical: 'outdoor' },
  { kw: 'foldable backpack lightweight',    vertical: 'outdoor' },
  { kw: 'camping hammock portable',         vertical: 'outdoor' },
  { kw: 'first aid kit compact',            vertical: 'outdoor' },
  { kw: 'waterproof phone pouch swim',      vertical: 'outdoor' },
  { kw: 'fire starter flint steel',         vertical: 'outdoor' },
  { kw: 'rain poncho packable',             vertical: 'outdoor' },
  { kw: 'hand warmer electric usb',         vertical: 'outdoor' },
  { kw: 'molle pouch attachment',           vertical: 'outdoor' },
  { kw: 'carabiner locking aluminum',       vertical: 'outdoor' },
  { kw: 'car phone holder magnetic',        vertical: 'mens' },
  { kw: 'car wireless charger vent',        vertical: 'mens' },
  { kw: 'car seat gap storage box',         vertical: 'mens' },
  { kw: 'portable tire inflator electric',  vertical: 'mens' },
  { kw: 'car air purifier usb',            vertical: 'mens' },
  { kw: 'car interior ambient led strip',   vertical: 'mens' },
  { kw: 'men tactical sling bag',           vertical: 'mens' },
  { kw: 'men chest crossbody bag',          vertical: 'mens' },
  { kw: 'rfid blocking card holder',        vertical: 'mens' },
  { kw: 'slim minimalist wallet men',       vertical: 'mens' },
  { kw: 'MR GREEN nail clipper set',        vertical: 'mens' },
  { kw: 'MR GREEN ear pick',              vertical: 'mens' },
  { kw: '3d contoured sleep eye mask',      vertical: 'mens' },
  { kw: 'men dress socks business',         vertical: 'mens' },
  { kw: 'nose hair trimmer electric',       vertical: 'mens' },
  { kw: 'dashcam front rear 4k',          vertical: 'mens' },
  { kw: 'car headrest hook organizer',      vertical: 'mens' },
  { kw: 'men bifold leather wallet',        vertical: 'mens' },
  { kw: 'portable electric shaver travel',  vertical: 'mens' },
  { kw: 'car trash can mini',             vertical: 'mens' },
  { kw: 'Mohamm sticker sheet',            vertical: 'cute' },
  { kw: 'Mohamm stationery set',           vertical: 'cute' },
  { kw: 'Journalsay sticker pack',         vertical: 'cute' },
  { kw: 'Journalsay washi tape',           vertical: 'cute' },
  { kw: 'kawaii bear sticker scrapbook',   vertical: 'cute' },
  { kw: 'holographic laser sticker set',   vertical: 'cute' },
  { kw: 'korean journal sticker',          vertical: 'cute' },
  { kw: 'waterproof vinyl sticker roll',   vertical: 'cute' },
  { kw: 'washi tape decorative roll',      vertical: 'cute' },
  { kw: 'clear wave iphone case',          vertical: 'cute' },
  { kw: 'y2k mirror phone case',           vertical: 'cute' },
  { kw: 'magsafe clear iphone case',       vertical: 'cute' },
  { kw: 'pressed flower transparent case', vertical: 'cute' },
  { kw: 'butterfly aesthetic phone case',  vertical: 'cute' },
  { kw: 'gradient color soft phone case',  vertical: 'cute' },
  { kw: 'bear pattern phone case',         vertical: 'cute' },
  { kw: 'cute memo sticky note pad',       vertical: 'cute' },
  { kw: 'journaling kit sticker supply',   vertical: 'cute' },
  { kw: 'scrapbook paper decoration',      vertical: 'cute' },
  { kw: 'retro vintage sticker pack',      vertical: 'cute' },
  { kw: 'funny crab pen holder',           vertical: 'funny' },
  { kw: 'capybara mini figure',            vertical: 'funny' },
  { kw: 'poker mat rubber texas',          vertical: 'funny' },
  { kw: 'fidget toy stress relief',        vertical: 'funny' },
  { kw: 'mini claw machine desktop',       vertical: 'funny' },
  { kw: 'MR GREEN grooming gift set',      vertical: 'funny' },
  { kw: 'funny animal desk decoration',    vertical: 'funny' },
  { kw: 'chess set travel magnetic',       vertical: 'funny' },
  { kw: 'dumbbell bottle opener',          vertical: 'funny' },
  { kw: 'cat keyboard mouse set',          vertical: 'funny' },
  { kw: 'funny cat costume cosplay',       vertical: 'pet' },
  { kw: 'dog lion mane wig',             vertical: 'pet' },
  { kw: 'led dog collar night safety',     vertical: 'pet' },
  { kw: 'rechargeable luminous dog leash', vertical: 'pet' },
  { kw: 'automatic pet fountain filter',   vertical: 'pet' },
  { kw: 'cat water dispenser replacement', vertical: 'pet' },
  { kw: 'catnip wall ball toy',           vertical: 'pet' },
  { kw: 'interactive laser cat toy',       vertical: 'pet' },
  { kw: 'dog cooling mat summer',          vertical: 'pet' },
  { kw: 'pet self cooling pad',            vertical: 'pet' },
  { kw: 'rgb sunset lamp projector',       vertical: 'home' },
  { kw: 'aurora borealis galaxy projector',vertical: 'home' },
  { kw: 'led digital wall clock modern',  vertical: 'home' },
  { kw: '3d luminous wall clock',          vertical: 'home' },
  { kw: 'levitating moon lamp magnetic',   vertical: 'home' },
  { kw: 'anti gravity floating water drops',vertical: 'home' },
  { kw: 'cute tissue box holder cream',    vertical: 'home' },
  { kw: 'ceramic pleated flower vase',     vertical: 'home' },
  { kw: 'motion sensor led light strip',   vertical: 'home' },
  { kw: 'electric massage gun portable',        vertical: 'relax' },
  { kw: 'mini deep tissue muscle massager',     vertical: 'relax' },
  { kw: 'ems foot massager mat electric',       vertical: 'relax' },
  { kw: 'pulse foot acupuncture pad',           vertical: 'relax' },
  { kw: 'smart posture corrector sensor',       vertical: 'relax' },
  { kw: 'back posture vibration reminder',      vertical: 'relax' },
  { kw: 'smart heated eye massager',            vertical: 'relax' },
  { kw: 'usb sleep eyes heating mask',          vertical: 'relax' },
  { kw: 'foam roller muscle workout recovery',  vertical: 'relax' },
  { kw: 'acupressure mat pillow set spine',     vertical: 'relax' },
  { kw: 'resistance band loop set exercise',    vertical: 'relax' },
  { kw: 'cervical neck traction pillow',        vertical: 'relax' },
  { kw: 'camping tent 2 person lightweight',    vertical: 'outdoor' },
  { kw: 'sleeping bag compact cold weather',    vertical: 'outdoor' },
  { kw: 'camping sleeping mat insulating pad',  vertical: 'outdoor' },
  { kw: 'folding camping table aluminum',       vertical: 'outdoor' },
  { kw: 'camping chair foldable portable',      vertical: 'outdoor' },
  { kw: 'camp stove portable windproof gas',    vertical: 'outdoor' },
  { kw: 'water purification filter straw',      vertical: 'outdoor' },
  { kw: 'solar charger panel outdoor portable', vertical: 'outdoor' },
  { kw: 'mosquito repellent bracelet outdoor',  vertical: 'outdoor' },
  { kw: 'mini pocket projector portable',       vertical: 'gadget' },
  { kw: 'smart wifi plug schedule timer',       vertical: 'gadget' },
  { kw: 'ring light usb desk streaming',        vertical: 'gadget' },
  { kw: 'nfc tag programmable sticker',         vertical: 'gadget' },
  { kw: 'tactical pen edc glass breaker',       vertical: 'mens' },
  { kw: 'car key case genuine leather cover',   vertical: 'mens' },
  { kw: 'watch stand wooden display men',       vertical: 'mens' },
  { kw: 'travel organizer pouch insert men',    vertical: 'mens' },
  { kw: 'desktop zen garden mini sand rake',    vertical: 'funny' },
  { kw: 'mini basketball hoop desk suction',    vertical: 'funny' },
  { kw: 'neon led sign small bedroom pink',     vertical: 'funny' },
  { kw: 'desktop punching ball spring stress',  vertical: 'funny' },
  { kw: 'cat tunnel collapsible play tube',     vertical: 'pet' },
  { kw: 'pet carrier backpack outdoor cat dog', vertical: 'pet' },
  { kw: 'cat scratcher corrugated cardboard',   vertical: 'pet' },
  { kw: 'grooming glove pet brush silicone',    vertical: 'pet' },
  { kw: 'led neon sign bedroom aesthetic',      vertical: 'home' },
  { kw: 'fairy lights usb twinkle bedroom',     vertical: 'home' },
  { kw: 'touch lamp bedside warm led',          vertical: 'home' },
  { kw: 'corner floating shelf wall mount',     vertical: 'home' },
  { kw: 'magsafe wallet card holder iphone',    vertical: 'cute' },
  { kw: 'camera lens protector ring iphone',    vertical: 'cute' },
  { kw: 'phone grip ring stand magnetic',       vertical: 'cute' },
];

const NUM_GROUPS = Math.ceil(KEYWORD_PLAN.length / KEYWORDS_PER_DAY);

// ── エントリポイント ──────────────────────────────────────────────────────
(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const start = Date.now();

  const state = loadState();
  const groupStart = state.groupIndex * KEYWORDS_PER_DAY;
  const todayKeywords = KEYWORD_PLAN.slice(groupStart, groupStart + KEYWORDS_PER_DAY);
  const todayVerticals = new Set(todayKeywords.map(k => k.vertical));
  const nextGroupIndex = (state.groupIndex + 1) % NUM_GROUPS;

  console.log('═'.repeat(60));
  console.log(`  商品プール ローリングリフレッシュ ${today}`);
  console.log(`  グループ ${state.groupIndex + 1}/${NUM_GROUPS}  カテゴリ: ${[...todayVerticals].join(', ')}`);
  console.log(`  今日のキーワード: ${todayKeywords.length}本`);
  console.log('═'.repeat(60));

  // 既存データ読み込み、collected_at バックフィル
  const existingProducts = loadExisting();
  existingProducts.forEach(p => { if (!p.collected_at) p.collected_at = today; });
  console.log(`\n📦 既存データ: ${existingProducts.length}件`);

  // 今日のカテゴリ → 再取得対象、それ以外 → そのまま保持
  const keepProducts = existingProducts.filter(p => !todayVerticals.has(getVertical(p)));
  const refreshPool  = existingProducts.filter(p =>  todayVerticals.has(getVertical(p)));
  const refreshById  = Object.fromEntries(refreshPool.map(p => [p.id, p]));

  // seenIds = keepProducts のみ（今日のカテゴリは再取得するため除外）
  const seenIds  = new Set(keepProducts.map(p => p.id));
  const techSets = [];

  console.log(`  → 保持: ${keepProducts.length}件 / 再チェック対象: ${refreshPool.length}件\n`);

  // ── 今日のキーワードで収集 ────────────────────────────────────────────
  console.log(`🔍 収集開始 (${todayKeywords.length}キーワード)\n`);
  const rawItems = [];

  for (let i = 0; i < todayKeywords.length; i++) {
    const { kw, vertical } = todayKeywords[i];
    const prefix = `  [${String(i + 1).padStart(2)}/${todayKeywords.length}]`;

    try {
      const items = await queryProducts(kw);
      let refreshed = 0, added = 0;

      for (const item of items) {
        const id = String(item.product_id);
        if (!passesQuality(item))     continue;
        if (isNG(item.product_title)) continue;

        if (refreshById[id]) {
          // まだ存在確認 → collected_at を今日に更新
          refreshById[id].collected_at = today;
          refreshed++;
          continue;
        }

        if (seenIds.has(id)) continue;

        if (['gadget', 'mens', 'tools'].includes(vertical) &&
            isTechDuplicate(item.product_title, techSets)) continue;

        rawItems.push({ item, vertical, isChoice: detectChoice(item) });
        seenIds.add(id);
        added++;

        if (['gadget', 'mens', 'tools'].includes(vertical)) {
          techSets.push(tokenize(item.product_title));
        }
      }

      process.stdout.write(`${prefix} 更新+${refreshed} 新規+${added}  「${kw}」\n`);
    } catch (e) {
      console.error(`  ❌ 「${kw}」エラー: ${e.message}`);
    }

    await sleep(SLEEP_MS);
  }

  const refreshedCount = refreshPool.filter(p => p.collected_at === today).length;
  const deadCount      = refreshPool.filter(p => p.collected_at !== today).length;
  console.log(`\n  生存確認: ${refreshedCount}件更新, ${deadCount}件は古いままに`);
  console.log(`  新規商品候補: ${rawItems.length}件\n`);

  // ── Phase 2: アフィリエイトリンク ────────────────────────────────────
  const newIds  = rawItems.map(r => String(r.item.product_id));
  const linkMap = await generateAffiliateLinks(newIds);

  // ── スキーマ変換 ──────────────────────────────────────────────────────
  const newProducts = rawItems.map(({ item, vertical, isChoice }) =>
    toSchema(item, vertical, isChoice, linkMap[String(item.product_id)] ?? null, today)
  );

  // ── Phase 3: 新規商品のみ名前クレンジング ─────────────────────────────
  await cleanAllNames(newProducts);

  // ── マージ → トリム → シャッフル → 出力 ──────────────────────────────
  const merged  = [...keepProducts, ...refreshPool, ...newProducts];
  const trimmed = trimPool(merged, MAX_POOL);

  for (let i = trimmed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trimmed[i], trimmed[j]] = [trimmed[j], trimmed[i]];
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(trimmed, null, 2), 'utf8');

  // ── 状態保存 ──────────────────────────────────────────────────────────
  saveState({ groupIndex: nextGroupIndex, lastRun: today });

  // ── サマリー ──────────────────────────────────────────────────────────
  const elapsed    = ((Date.now() - start) / 1000).toFixed(1);
  const trimmedOut = merged.length - trimmed.length;
  const choiceCount = trimmed.filter(p => p.is_choice).length;

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ 完了  ${elapsed}秒`);
  console.log(`   既存: ${existingProducts.length}件 → 合計: ${trimmed.length}件`);
  console.log(`   新規追加: +${newProducts.length}件 / トリム: -${trimmedOut}件`);
  console.log(`   生存更新: ${refreshedCount}件 / 期限切れ候補: ${deadCount}件`);
  console.log(`   Choice: ${choiceCount}件 (${Math.round(choiceCount / trimmed.length * 100)}%)`);
  console.log(`   次回グループ: ${nextGroupIndex + 1}/${NUM_GROUPS}`);
  console.log('═'.repeat(60));
  console.log(`\n📁 出力: ${OUT_FILE}\n`);
})();
