/**
 * collect-products.mjs  ―  マージ対応・完成版
 *
 * 実行: node scripts/collect-products.mjs
 * 出力: public/products.json  (既存データ + 新規データのマージ)
 *
 * Phase 1: 全KW (165本) をスイープ → 既存IDをスキップして新規のみ収集
 * Phase 2: Choiceヒューリスティック広域スイープ (25本)
 * Phase 3: バッチでアフィリエイトリンク生成 (新規のみ)
 * Phase 4: Claude Haikuで商品名を日本語クレンジング (新規のみ)
 * + 既存データと合体してシャッフル出力
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

// ── 環境変数チェック ──────────────────────────────────────────────────────
const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;

if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
  console.error('❌ ALIEXPRESS_APP_KEY / APP_SECRET / TRACKING_ID が未設定です');
  process.exit(1);
}
if (!CLAUDE_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が未設定です');
  process.exit(1);
}

const claude = new Anthropic({ apiKey: CLAUDE_KEY });

// ── 設定 ─────────────────────────────────────────────────────────────────
const CLAUDE_BATCH   = 10;
const CLAUDE_SLEEP   = 1500;
const JACCARD_THRESH = 0.75;  // 重複排除閾値（0.60→0.75 に緩和）

const PHASE1_QUOTA = {
  gadget:  400,
  outdoor: 350,
  mens:    200,
  cute:    250,
  funny:   120,
  pet:     180,
  home:    220,
  relax:   180,
};
const PHASE2_QUOTA = 200;
const PAGE_SIZE    = 50;
const SLEEP_MS     = 1200;
const LINK_BATCH   = 50;

// ── ユーティリティ ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    fields: [
      'product_id', 'product_title', 'product_main_image_url',
      'target_sale_price', 'evaluate_rate', 'lastest_volume',
    ].join(','),
  });
  return json?.aliexpress_affiliate_product_query_response
              ?.resp_result?.result?.products?.product ?? [];
}

// ── Choiceフラグ判定（ヒューリスティック） ────────────────────────────────
// APIが promotion_name / ship_to_days を返さないため価格・販売数・評価で代替
function detectChoice(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume ?? '0', 10);
  return price <= 800 && rate >= 95 && sales >= 500;
}

// ── 3層激辛NGフィルター ───────────────────────────────────────────────────
const NG_PATTERNS = [
  // ① 物理・電圧NG
  /\beu plug\b/i, /\buk plug\b/i, /\b2[234]0v\b/i,
  /\bpower strip\b/i, /\bwall socket\b/i, /\bschuko\b/i,
  // ② 安全性・信用NG
  /\badult\b/i, /\bsexy\b/i, /\blaser pointer\b/i, /\bknife\b/i,
  /\bseeds?\b/i, /\bdiet\b/i, /\bsupplement\b/i, /\bskincare\b/i,
  /\bessential oil\b/i, /\bliquid bottle\b/i, /\bgel bottle\b/i,
  /\bpowder\b/i, /\bbaby toy mouth\b/i, /\bpacifier\b/i,
  // ③ 著作権・偽物NG
  /\bdisney\b/i, /\bsanrio\b/i, /\banime\b/i, /\bchiikawa\b/i,
  /\bluxury brand\b/i, /\bdesigner replica\b/i,
  // ④ がっかりNG（衣服）
  /\bt-shirt\b/i, /\bdress\b/i, /\bpants\b/i, /\bjacket\b/i, /\bshoes\b/i,
  // socks は christmas/novelty のみ弾く（men dress socks 救済）
  /\bchristmas socks\b/i, /\bnovelty socks\b/i, /\bfunny socks\b/i,
  // ⑤ 国内購入推奨NG
  /\bduct tape\b/i, /\bpacking tape\b/i, /\btrash bag\b/i,
  /\bkitchen sponge\b/i, /\bdish cloth\b/i, /\bstorage box big\b/i,
];

function isNG(title) {
  return NG_PATTERNS.some(re => re.test(title ?? ''));
}

// ── 品質足切り ────────────────────────────────────────────────────────────
function passesQuality(item) {
  const price = parseFloat(item.target_sale_price ?? '0');
  const rate  = parseFloat((item.evaluate_rate   ?? '0').replace('%', ''));
  const sales = parseInt(item.lastest_volume      ?? '0', 10);
  return (
    price >= 100 &&
    price <= 15000 &&
    rate  >= 88 &&
    sales >= 50 &&
    !!item.product_main_image_url
  );
}

// ── トークン重複排除（ガジェット・メンズ・工具系） ────────────────────────
const TECH_TOKEN_SET = new Set([
  'usb','cable','charger','hub','hdmi','bluetooth','wireless','fast','charge',
  '100w','65w','45w','20w','15w','pd','gan','3in1','mouse','keyboard',
  'speaker','earbuds','tws','webcam','fan','stand','monitor','light',
  'lamp','desk','mat','powerbank','ssd','magsafe','magnetic','mount','holder',
  // 工具系トークン追加
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

// ── スキーマ定義 ──────────────────────────────────────────────────────────
const VERTICAL_JA = {
  gadget:  'ガジェット',
  outdoor: 'アウトドア',
  mens:    'メンズ',
  cute:    'シール・ケース',
  funny:   'おもしろ',
  pet:     'ペット',
  home:    'インテリア',
  kitchen: 'キッチン',
  tools:   '工具・DIY',
  relax:   'リラックス',
};
const VERTICAL_COLOR = {
  gadget:  'from-blue-100 to-blue-200',
  outdoor: 'from-green-100 to-green-200',
  mens:    'from-slate-100 to-slate-200',
  cute:    'from-pink-100 to-pink-200',
  funny:   'from-amber-100 to-amber-200',
  pet:     'from-orange-100 to-orange-200',
  home:    'from-purple-100 to-purple-200',
  kitchen: 'from-yellow-100 to-yellow-200',
  tools:   'from-zinc-100 to-zinc-200',
  relax:   'from-teal-100 to-teal-200',
};
const VERTICAL_EMOJI = {
  gadget: '⚡', outdoor: '🏕️', mens: '🧔', cute: '🌸', funny: '😄',
  pet: '🐾', home: '🏠', kitchen: '🍳', tools: '🔧', relax: '💆',
};

function toSchema(item, vertical, isChoice, affiliateUrl) {
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
  };
}

// ── Claude Haiku バッチ名前クレンジング ───────────────────────────────────
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
        content: `以下${titles.length}件のAliExpress商品名を、スマホカード表示用（最大20文字）に整理してください。
ルール: ブランド名（あれば）+ 商品の核心だけ。スペック・色・個数・互換情報は省略。
結果はJSON配列（文字列${titles.length}個）のみ出力。余計なテキスト不要。
例: ["Baseus 100W充電ケーブル", "UGREEN USBハブ 7in1"]

商品名リスト:
${numbered}`,
      }],
    });

    const text  = msg.content[0].text.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON配列が見つかりません');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length !== titles.length) {
      throw new Error('配列の長さが一致しません');
    }
    return parsed.map(n => String(n).slice(0, 30).trim());
  } catch (e) {
    console.error(`  ⚠️  名前クレンジング失敗: ${e.message} → 元タイトルを使用`);
    return titles.map(t => t.slice(0, 30).trim());
  }
}

async function cleanAllNames(products) {
  const total   = products.length;
  const batches = Math.ceil(total / CLAUDE_BATCH);
  console.log(`\n🤖 Phase 4: Claude Haiku 名前クレンジング (${batches}バッチ / 約${Math.ceil(batches * CLAUDE_SLEEP / 60000)}分)\n`);

  for (let i = 0; i < total; i += CLAUDE_BATCH) {
    const slice   = products.slice(i, i + CLAUDE_BATCH);
    const titles  = slice.map(p => p.name);
    const cleaned = await cleanNamesBatch(titles);

    cleaned.forEach((name, j) => { products[i + j].name = name; });

    const batchNum = Math.floor(i / CLAUDE_BATCH) + 1;
    process.stdout.write(
      `  [${String(batchNum).padStart(3)}/${batches}] ✓ "${cleaned[0]}" など${slice.length}件\n`
    );
  }
}

// ── アフィリエイトリンクのバッチ生成 ─────────────────────────────────────
async function generateAffiliateLinks(productIds) {
  const links   = {};
  const batches = [];
  for (let i = 0; i < productIds.length; i += LINK_BATCH) {
    batches.push(productIds.slice(i, i + LINK_BATCH));
  }

  console.log(`\n🔗 Phase 3: アフィリエイトリンク生成 (${batches.length}バッチ)\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch        = batches[i];
    const sourceValues = batch
      .map(id => `https://www.aliexpress.com/item/${id}.html`)
      .join(',');

    try {
      const json = await callApi('aliexpress.affiliate.link.generate', {
        tracking_id: TRACKING_ID,
        source_values: sourceValues,
        promotion_link_type: '0',
      });

      const resultLinks =
        json?.aliexpress_affiliate_link_generate_response
            ?.resp_result?.result?.promotion_links
            ?.promotion_link ?? [];

      for (const link of resultLinks) {
        const m = (link.source_value ?? '').match(/\/item\/(\d+)\.html/);
        if (m && link.promotion_link) links[m[1]] = link.promotion_link;
      }

      process.stdout.write(
        `  [${String(i + 1).padStart(2)}/${batches.length}] ${resultLinks.length}件取得\n`
      );
    } catch (e) {
      console.error(`  ❌ バッチ${i + 1}エラー: ${e.message}`);
    }

    await sleep(SLEEP_MS);
  }

  return links;
}

// ── Phase 2 用: タイトルからverticalを推定 ────────────────────────────────
function guessVertical(title) {
  const t = (title ?? '').toLowerCase();
  if (/\bpet\b|cat\b|dog\b|paw\b|kitten|puppy|feline|canine|catnip|fountain filter/.test(t)) return 'pet';
  if (/projector|wall clock|flower vase|tissue box|moon lamp|aurora|galaxy lamp|levitat|floating drop|rgb lamp/.test(t)) return 'home';
  if (/frother|coffee scale|pepper mill|bag sealer|silicone lid|vacuum seal|kitchen scale/.test(t)) return 'kitchen';
  if (/screwdriver set|caliper|laser level|wire stripper|snowflake tool|multi.?tool/.test(t)) return 'tools';
  if (/massage gun|massager|posture|heated eye|heating mask|ems foot|acupuncture/.test(t)) return 'relax';
  if (/sticker|washi|kawaii|phone case|journal|notebook/.test(t)) return 'cute';
  if (/camping|outdoor|hiking|survival|flashlight|headlamp|backpack/.test(t)) return 'outdoor';
  if (/\bcar\b|wallet|shaver|sling|rfid|dashcam/.test(t)) return 'mens';
  if (/funny|fidget|poker|capybara|crab|chess/.test(t)) return 'funny';
  return 'gadget';
}

// ── キーワードリスト（全165本） ───────────────────────────────────────────
const KEYWORD_PLAN = [
  // ── ガジェット・デスク (40) ──────────────────────────────────────────────
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
  { kw: 'usb c hub multiport',              vertical: 'gadget' },
  { kw: 'mini bluetooth speaker portable',  vertical: 'gadget' },
  { kw: 'pillow speaker sleep bluetooth',   vertical: 'gadget' },
  { kw: 'smart watch health tracker',       vertical: 'gadget' },
  { kw: 'controller silicone grip case',    vertical: 'gadget' },
  { kw: 'laptop stand aluminum portable',   vertical: 'gadget' },
  { kw: 'gaming desk mat large',            vertical: 'gadget' },
  { kw: 'led desk lamp flexible usb',       vertical: 'gadget' },
  { kw: 'power bank 10000mah slim',         vertical: 'gadget' },
  { kw: 'silent wireless mouse',            vertical: 'gadget' },
  { kw: 'usb desk fan quiet',               vertical: 'gadget' },
  { kw: 'phone holder arm clamp desk',      vertical: 'gadget' },
  { kw: 'artisan keycap resin',             vertical: 'gadget' },
  { kw: 'webcam 1080p usb',                vertical: 'gadget' },
  { kw: 'usb c to 3.5mm audio adapter',    vertical: 'gadget' },
  { kw: 'anti blue light glasses',          vertical: 'gadget' },
  { kw: 'wrist rest keyboard gel',          vertical: 'gadget' },
  { kw: 'screen cleaning kit',              vertical: 'gadget' },
  { kw: 'cable tie velcro reusable',        vertical: 'gadget' },
  { kw: 'phone cooling fan clip',           vertical: 'gadget' },
  { kw: 'portable ssd enclosure usb c',     vertical: 'gadget' },

  // ── アウトドア・防災 (30) ────────────────────────────────────────────────
  { kw: 'Naturehike camping tent',           vertical: 'outdoor' },
  { kw: 'Naturehike sleeping bag',           vertical: 'outdoor' },
  { kw: 'Naturehike ultralight gear',        vertical: 'outdoor' },
  { kw: 'Naturehike hiking backpack',        vertical: 'outdoor' },
  { kw: 'Widesea camping cookware set',      vertical: 'outdoor' },
  { kw: 'Widesea titanium cup',              vertical: 'outdoor' },
  { kw: 'edc carabiner multi function',      vertical: 'outdoor' },
  { kw: 'edc keychain tool kit',             vertical: 'outdoor' },
  { kw: 'led headlamp rechargeable',         vertical: 'outdoor' },
  { kw: 'solar camping lantern',             vertical: 'outdoor' },
  { kw: 'inflatable camping pillow',         vertical: 'outdoor' },
  { kw: 'quick dry microfiber towel',        vertical: 'outdoor' },
  { kw: 'foldable water bottle silicone',    vertical: 'outdoor' },
  { kw: 'emergency survival kit',            vertical: 'outdoor' },
  { kw: 'waterproof dry bag roll top',       vertical: 'outdoor' },
  { kw: 'trekking pole ultralight',          vertical: 'outdoor' },
  { kw: 'edc permanent match',              vertical: 'outdoor' },
  { kw: 'uv blacklight flashlight mini',     vertical: 'outdoor' },
  { kw: 'compass outdoor navigation',        vertical: 'outdoor' },
  { kw: 'paracord bracelet survival',        vertical: 'outdoor' },
  { kw: 'tactical flashlight rechargeable',  vertical: 'outdoor' },
  { kw: 'foldable backpack lightweight',     vertical: 'outdoor' },
  { kw: 'camping hammock portable',          vertical: 'outdoor' },
  { kw: 'first aid kit compact',             vertical: 'outdoor' },
  { kw: 'waterproof phone pouch swim',       vertical: 'outdoor' },
  { kw: 'fire starter flint steel',          vertical: 'outdoor' },
  { kw: 'rain poncho packable',              vertical: 'outdoor' },
  { kw: 'hand warmer electric usb',          vertical: 'outdoor' },
  { kw: 'molle pouch attachment',            vertical: 'outdoor' },
  { kw: 'carabiner locking aluminum',        vertical: 'outdoor' },

  // ── 車載・メンズ (20) ────────────────────────────────────────────────────
  { kw: 'car phone holder magnetic',         vertical: 'mens' },
  { kw: 'car wireless charger vent',         vertical: 'mens' },
  { kw: 'car seat gap storage box',          vertical: 'mens' },
  { kw: 'portable tire inflator electric',   vertical: 'mens' },
  { kw: 'car air purifier usb',              vertical: 'mens' },
  { kw: 'car interior ambient led strip',    vertical: 'mens' },
  { kw: 'men tactical sling bag',            vertical: 'mens' },
  { kw: 'men chest crossbody bag',           vertical: 'mens' },
  { kw: 'rfid blocking card holder',         vertical: 'mens' },
  { kw: 'slim minimalist wallet men',        vertical: 'mens' },
  { kw: 'MR GREEN nail clipper set',         vertical: 'mens' },
  { kw: 'MR GREEN ear pick',                vertical: 'mens' },
  { kw: '3d contoured sleep eye mask',       vertical: 'mens' },
  { kw: 'men dress socks business',          vertical: 'mens' },
  { kw: 'nose hair trimmer electric',        vertical: 'mens' },
  { kw: 'dashcam front rear 4k',            vertical: 'mens' },
  { kw: 'car headrest hook organizer',       vertical: 'mens' },
  { kw: 'men bifold leather wallet',         vertical: 'mens' },
  { kw: 'portable electric shaver travel',   vertical: 'mens' },
  { kw: 'car trash can mini',               vertical: 'mens' },

  // ── シール・ケース・文具 (20) ────────────────────────────────────────────
  { kw: 'Mohamm sticker sheet',              vertical: 'cute' },
  { kw: 'Mohamm stationery set',             vertical: 'cute' },
  { kw: 'Journalsay sticker pack',           vertical: 'cute' },
  { kw: 'Journalsay washi tape',             vertical: 'cute' },
  { kw: 'kawaii bear sticker scrapbook',     vertical: 'cute' },
  { kw: 'holographic laser sticker set',     vertical: 'cute' },
  { kw: 'korean journal sticker',            vertical: 'cute' },
  { kw: 'waterproof vinyl sticker roll',     vertical: 'cute' },
  { kw: 'washi tape decorative roll',        vertical: 'cute' },
  { kw: 'clear wave iphone case',            vertical: 'cute' },
  { kw: 'y2k mirror phone case',             vertical: 'cute' },
  { kw: 'magsafe clear iphone case',         vertical: 'cute' },
  { kw: 'pressed flower transparent case',   vertical: 'cute' },
  { kw: 'butterfly aesthetic phone case',    vertical: 'cute' },
  { kw: 'gradient color soft phone case',    vertical: 'cute' },
  { kw: 'bear pattern phone case',           vertical: 'cute' },
  { kw: 'cute memo sticky note pad',         vertical: 'cute' },
  { kw: 'journaling kit sticker supply',     vertical: 'cute' },
  { kw: 'scrapbook paper decoration',        vertical: 'cute' },
  { kw: 'retro vintage sticker pack',        vertical: 'cute' },

  // ── おもしろ・趣味 (10) ──────────────────────────────────────────────────
  { kw: 'funny crab pen holder',             vertical: 'funny' },
  { kw: 'capybara mini figure',              vertical: 'funny' },
  { kw: 'poker mat rubber texas',            vertical: 'funny' },
  { kw: 'fidget toy stress relief',          vertical: 'funny' },
  { kw: 'mini claw machine desktop',         vertical: 'funny' },
  { kw: 'MR GREEN grooming gift set',        vertical: 'funny' },
  { kw: 'funny animal desk decoration',      vertical: 'funny' },
  { kw: 'chess set travel magnetic',         vertical: 'funny' },
  { kw: 'dumbbell bottle opener',            vertical: 'funny' },
  { kw: 'cat keyboard mouse set',            vertical: 'funny' },

  // ── ペット用品・コスプレ (10) ─────────────────────────────────────────────
  { kw: 'funny cat costume cosplay',         vertical: 'pet' },
  { kw: 'dog lion mane wig',                vertical: 'pet' },
  { kw: 'led dog collar night safety',       vertical: 'pet' },
  { kw: 'rechargeable luminous dog leash',   vertical: 'pet' },
  { kw: 'automatic pet fountain filter',     vertical: 'pet' },
  { kw: 'cat water dispenser replacement',   vertical: 'pet' },
  { kw: 'catnip wall ball toy',             vertical: 'pet' },
  { kw: 'interactive laser cat toy',         vertical: 'pet' },
  { kw: 'dog cooling mat summer',            vertical: 'pet' },
  { kw: 'pet self cooling pad',              vertical: 'pet' },

  // ── ホーム・インテリア・映え部屋 (9) ──────────────────────────────────────
  { kw: 'rgb sunset lamp projector',         vertical: 'home' },
  { kw: 'aurora borealis galaxy projector',  vertical: 'home' },
  { kw: 'led digital wall clock modern',    vertical: 'home' },
  { kw: '3d luminous wall clock',            vertical: 'home' },
  { kw: 'levitating moon lamp magnetic',     vertical: 'home' },
  { kw: 'anti gravity floating water drops', vertical: 'home' },
  { kw: 'cute tissue box holder cream',      vertical: 'home' },
  { kw: 'ceramic pleated flower vase',       vertical: 'home' },
  { kw: 'motion sensor led light strip',     vertical: 'home' },

  // ── リラクゼーション・健康ガジェット (12) ────────────────────────────────
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

  // ── アウトドア 追加 (9) ──────────────────────────────────────────────────
  { kw: 'camping tent 2 person lightweight',    vertical: 'outdoor' },
  { kw: 'sleeping bag compact cold weather',    vertical: 'outdoor' },
  { kw: 'camping sleeping mat insulating pad',  vertical: 'outdoor' },
  { kw: 'folding camping table aluminum',       vertical: 'outdoor' },
  { kw: 'camping chair foldable portable',      vertical: 'outdoor' },
  { kw: 'camp stove portable windproof gas',    vertical: 'outdoor' },
  { kw: 'water purification filter straw',      vertical: 'outdoor' },
  { kw: 'solar charger panel outdoor portable', vertical: 'outdoor' },
  { kw: 'mosquito repellent bracelet outdoor',  vertical: 'outdoor' },

  // ── ガジェット 追加 (4) ──────────────────────────────────────────────────
  { kw: 'mini pocket projector portable',       vertical: 'gadget' },
  { kw: 'smart wifi plug schedule timer',       vertical: 'gadget' },
  { kw: 'ring light usb desk streaming',        vertical: 'gadget' },
  { kw: 'nfc tag programmable sticker',         vertical: 'gadget' },

  // ── メンズ 追加 (4) ─────────────────────────────────────────────────────
  { kw: 'tactical pen edc glass breaker',       vertical: 'mens' },
  { kw: 'car key case genuine leather cover',   vertical: 'mens' },
  { kw: 'watch stand wooden display men',       vertical: 'mens' },
  { kw: 'travel organizer pouch insert men',    vertical: 'mens' },

  // ── おもしろ 追加 (4) ────────────────────────────────────────────────────
  { kw: 'desktop zen garden mini sand rake',    vertical: 'funny' },
  { kw: 'mini basketball hoop desk suction',    vertical: 'funny' },
  { kw: 'neon led sign small bedroom pink',     vertical: 'funny' },
  { kw: 'desktop punching ball spring stress',  vertical: 'funny' },

  // ── ペット 追加 (4) ─────────────────────────────────────────────────────
  { kw: 'cat tunnel collapsible play tube',     vertical: 'pet' },
  { kw: 'pet carrier backpack outdoor cat dog', vertical: 'pet' },
  { kw: 'cat scratcher corrugated cardboard',   vertical: 'pet' },
  { kw: 'grooming glove pet brush silicone',    vertical: 'pet' },

  // ── インテリア 追加 (4) ──────────────────────────────────────────────────
  { kw: 'led neon sign bedroom aesthetic',      vertical: 'home' },
  { kw: 'fairy lights usb twinkle bedroom',     vertical: 'home' },
  { kw: 'touch lamp bedside warm led',          vertical: 'home' },
  { kw: 'corner floating shelf wall mount',     vertical: 'home' },

  // ── シール・ケース 追加 (3) ──────────────────────────────────────────────
  { kw: 'magsafe wallet card holder iphone',    vertical: 'cute' },
  { kw: 'camera lens protector ring iphone',    vertical: 'cute' },
  { kw: 'phone grip ring stand magnetic',       vertical: 'cute' },
];

const SWEEP_KEYWORDS = [
  'usb charging accessory',
  'phone accessories popular',
  'cable organizer kit',
  'portable mini gadget',
  'everyday carry tool',
  'travel accessories compact',
  'outdoor portable tool',
  'camping gear popular',
  'waterproof bag outdoor',
  'rechargeable light tool',
  'desk office organizer',
  'home storage creative',
  'aesthetic room decoration',
  'multifunction pocket tool',
  'smart home gadget',
  'men daily essentials',
  'car interior accessories',
  'wallet card holder men',
  'grooming tool kit',
  'sleep aid accessory',
  'kawaii stationery set',
  'diy craft decoration',
  'creative gift gadget',
  'funny desk decoration',
  'keychain bottle opener',
];

// ── 既存データ読み込み ────────────────────────────────────────────────────
function loadExisting() {
  if (!fs.existsSync(OUT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ── メイン収集処理 ────────────────────────────────────────────────────────
async function collect(seenIds) {
  const rawItems   = [];
  const vertCounts = Object.fromEntries(Object.keys(PHASE1_QUOTA).map(k => [k, 0]));
  const techSets   = [];

  const totalPhase1 = KEYWORD_PLAN.length;

  // ── Phase 1 ──────────────────────────────────────────────────────────────
  console.log(`\n🚀 Phase 1: 全KW収集 (${totalPhase1}クエリ)\n`);

  for (let i = 0; i < KEYWORD_PLAN.length; i++) {
    const { kw, vertical } = KEYWORD_PLAN[i];
    const quota  = PHASE1_QUOTA[vertical] ?? 0;
    const prefix = `  [${String(i + 1).padStart(3)}/${totalPhase1}]`;

    if (vertCounts[vertical] >= quota) {
      process.stdout.write(`${prefix} SKIP  「${kw}」(クォータ達成)\n`);
      continue;
    }

    try {
      const items = await queryProducts(kw);
      let added = 0;

      for (const item of items) {
        if (vertCounts[vertical] >= quota) break;
        const id = String(item.product_id);
        if (seenIds.has(id))           continue;
        if (!passesQuality(item))      continue;
        if (isNG(item.product_title))  continue;

        if (['gadget', 'mens', 'tools'].includes(vertical) &&
            isTechDuplicate(item.product_title, techSets)) continue;

        rawItems.push({ item, vertical, isChoice: detectChoice(item) });
        seenIds.add(id);
        vertCounts[vertical]++;
        added++;

        if (['gadget', 'mens', 'tools'].includes(vertical)) {
          techSets.push(tokenize(item.product_title));
        }
      }

      const total = Object.values(vertCounts).reduce((a, b) => a + b, 0);
      process.stdout.write(`${prefix} +${String(added).padStart(2)}件  「${kw}」 | 新規累計 ${total}件\n`);
    } catch (e) {
      console.error(`  ❌ 「${kw}」エラー: ${e.message}`);
    }

    await sleep(SLEEP_MS);
  }

  // ── Phase 2 ──────────────────────────────────────────────────────────────
  console.log(`\n🌊 Phase 2: Choice広域スイープ (${SWEEP_KEYWORDS.length}クエリ)\n`);
  let sweepCount = 0;

  for (let i = 0; i < SWEEP_KEYWORDS.length; i++) {
    if (sweepCount >= PHASE2_QUOTA) break;
    const kw = SWEEP_KEYWORDS[i];

    try {
      const items = await queryProducts(kw);
      let added = 0;

      for (const item of items) {
        if (sweepCount >= PHASE2_QUOTA) break;
        const id = String(item.product_id);
        if (seenIds.has(id))          continue;
        if (!passesQuality(item))     continue;
        if (isNG(item.product_title)) continue;
        if (!detectChoice(item))      continue;

        const vertical = guessVertical(item.product_title);
        rawItems.push({ item, vertical, isChoice: true });
        seenIds.add(id);
        sweepCount++;
        added++;
      }

      process.stdout.write(
        `  [${String(i + 1).padStart(2)}/${SWEEP_KEYWORDS.length}] +${String(added).padStart(2)}件  「${kw}」 | Choice累計 ${sweepCount}件\n`
      );
    } catch (e) {
      console.error(`  ❌ 「${kw}」エラー: ${e.message}`);
    }

    await sleep(SLEEP_MS);
  }

  return rawItems;
}

// ── エントリポイント ──────────────────────────────────────────────────────
(async () => {
  const start = Date.now();

  console.log('═'.repeat(62));
  console.log('  AliExpress 商品プール収集スクリプト (マージ対応版)');
  console.log('  推定所要時間: 約20〜25分');
  console.log('═'.repeat(62));

  // 既存データ読み込み → seenIds に登録
  const existingProducts = loadExisting();
  const seenIds          = new Set(existingProducts.map(p => p.id));
  console.log(`\n📦 既存データ: ${existingProducts.length}件 (IDをスキップリストに登録)\n`);

  // Phase 1 + 2 で新規データ収集
  const rawItems = await collect(seenIds);

  if (rawItems.length === 0) {
    console.log('\n⚠️  新規商品なし。既存データをそのまま出力します。');
    fs.writeFileSync(OUT_FILE, JSON.stringify(existingProducts, null, 2), 'utf8');
    return;
  }

  // Phase 3: 新規商品のアフィリエイトリンクのみ生成
  const newIds  = rawItems.map(r => String(r.item.product_id));
  const linkMap = await generateAffiliateLinks(newIds);

  // スキーマ変換
  const newProducts = rawItems.map(({ item, vertical, isChoice }) =>
    toSchema(item, vertical, isChoice, linkMap[String(item.product_id)] ?? null)
  );

  // Phase 4: 新規商品のみ名前クレンジング（既存は処理済みのためスキップ）
  await cleanAllNames(newProducts);

  // 既存 + 新規 をマージしてシャッフル
  const merged = [...existingProducts, ...newProducts];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

  // ── サマリー ────────────────────────────────────────────────────────────
  const elapsed     = ((Date.now() - start) / 1000).toFixed(1);
  const choiceCount = merged.filter(p => p.is_choice).length;
  const total       = merged.length;
  const withLink    = merged.filter(p => !p.url.includes('aliexpress.com/item')).length;

  const vtCounts = {};
  merged.forEach(p => { vtCounts[p.category] = (vtCounts[p.category] ?? 0) + 1; });

  console.log('\n' + '═'.repeat(62));
  console.log(`✅ 完了  ${elapsed}秒`);
  console.log(`   既存データ:         ${existingProducts.length}件`);
  console.log(`   新規追加:           ${newProducts.length}件`);
  console.log(`   合計:               ${total}件`);
  console.log(`   うちChoice:         ${choiceCount}件 (${Math.round(choiceCount / total * 100)}%)`);
  console.log(`   アフィリンク生成:   ${withLink}件 / ${total}件`);
  console.log('\n【バーティカル別内訳 (合計)】');
  Object.entries(vtCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, n]) => {
      const bar = '█'.repeat(Math.max(1, Math.round(n / 50))).padEnd(20, '░');
      console.log(`   ${tag.padEnd(14)} ${String(n).padStart(4)}件  ${bar}`);
    });
  console.log('═'.repeat(62));
  console.log(`\n📁 出力先: ${OUT_FILE}\n`);
})();
