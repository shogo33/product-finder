/**
 * 記事 HTML 内の商品セクションを自動更新するスクリプト
 * 使い方: node scripts/update-article-products.mjs
 *
 * マーカー規則:
 *   <!-- @product-start id="PRODUCT_ID" type="PRODUCT_TYPE" tag="TAG" -->
 *   ...任意のHTML（h2・商品カード・説明文など）...
 *   <!-- @product-end -->
 *
 * 動作:
 *   1. public/ 以下の全 .html ファイルをスキャン
 *   2. @product-start マーカーを検出
 *   3. 商品の状態を確認:
 *      - products.json に存在 → active フラグで判定
 *      - products.json に存在しない → AliExpress API で可用性チェック
 *   4. 非アクティブ商品は同タイプの承認済み代替品を検索
 *   5. Claude Haiku でセクション HTML を書き換え
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const DATA_FILE    = path.resolve('data/products.json');
const APPROVED_FILE = path.resolve('data/approved.json');
const PUBLIC_DIR   = path.resolve('public');

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL     = 'https://api-sg.aliexpress.com/sync';

// Matches the entire product section including markers
const SECTION_RE = /<!-- @product-start id="([^"]+)" type="([^"]*)" tag="([^"]*)" -->([\s\S]*?)<!-- @product-end -->/g;

// ── API helpers ────────────────────────────────────────────

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function checkAvailable(productId) {
  const url = `https://www.aliexpress.com/item/${productId}.html`;
  const params = {
    app_key: APP_KEY, method: 'aliexpress.affiliate.link.generate',
    sign_method: 'sha256', timestamp: String(Date.now()),
    tracking_id: TRACKING_ID, source_values: url, promotion_link_type: '0',
  };
  params.sign = sign(params);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const json = await res.json();
    return json?.aliexpress_affiliate_link_generate_response
                ?.resp_result?.result?.promotion_links
                ?.promotion_link?.[0]?.promotion_link ?? null;
  } catch {
    return null;
  }
}

// ── Data helpers ───────────────────────────────────────────

function parseRate(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace('%', '')) / 100;
}

function score(p) {
  return (Number(p.sales_count) || 0) * parseRate(p.evaluate_rate);
}

function findReplacement(products, approved, productType, tag, excludeIds = []) {
  const candidates = products.filter(p => {
    const id = String(p.product_id);
    return (
      approved[id] === true &&
      p.active !== false &&
      !excludeIds.includes(id) &&
      (p.product_type === productType || p.tag === tag)
    );
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

// ── File scanner ───────────────────────────────────────────

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

// ── Claude rewrite ─────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastClaudeCall = 0;

async function rewriteSection(sectionHtml, oldProductId, newProduct) {
  const now = Date.now();
  const wait = 2000 - (now - lastClaudeCall);
  if (wait > 0) await sleep(wait);
  lastClaudeCall = Date.now();

  const client = new Anthropic({ apiKey: CLAUDE_KEY });

  const productData = {
    product_id:    newProduct.product_id,
    name:          newProduct.title_short || newProduct.title,
    price_jpy:     newProduct.price_jpy,
    evaluate_rate: newProduct.evaluate_rate,
    sales_count:   newProduct.sales_count,
    affiliate_link: newProduct.affiliate_link,
    product_type:  newProduct.product_type,
    tag:           newProduct.tag,
    image_url:     newProduct.image_url,
  };

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `あなたはAliExpress紹介サイトのHTML編集者です。
以下の商品セクションHTMLを、新しい商品データに合わせて書き換えてください。

【ルール】
- HTML構造・CSSクラスをそのまま維持する
- 商品名・スペック・評価・価格・購入リンク・メリット・デメリットを新商品データで更新
- 購入ボタン/リンクの href には affiliate_link を使用する
- evaluate_rate（例: "96.5%"）を ★の数と数値（4.8など）に変換して表示
- price_jpy を「¥X,XXX」形式で表示する
- sales_count を販売実績として自然に言及する
- マーカーコメント <!-- @product-start ... --> と <!-- @product-end --> はそのまま残し、
  id属性の旧商品ID (${oldProductId}) を新商品ID (${newProduct.product_id}) に変更する
- 旧商品を直接指している id属性（例: id="hy300pro"）も新商品に合わせて変更
- HTMLのみを出力し、コードブロックや説明文は不要

【新商品データ】
${JSON.stringify(productData, null, 2)}

【書き換え対象HTML】
${sectionHtml}`,
    }],
  });

  return msg.content[0].text.trim();
}

// ── Main ───────────────────────────────────────────────────

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const approved = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'));
const productMap = new Map(products.map(p => [String(p.product_id), p]));

const htmlFiles = findHtmlFiles(PUBLIC_DIR);
let totalReplaced = 0;
let totalChecked  = 0;

console.log(`\n🔍 記事商品チェック: ${htmlFiles.length}ファイルをスキャン中...\n`);

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const sections = [...content.matchAll(SECTION_RE)];
  if (!sections.length) continue;

  const relPath = path.relative(PUBLIC_DIR, file);
  console.log(`📄 ${relPath}: ${sections.length}件の商品マーカー`);

  let updated = content;
  let fileChanged = false;

  for (const [fullMatch, productId, productType, tag] of sections) {
    totalChecked++;
    const product = productMap.get(productId);
    const inDb    = !!product;
    let isActive;

    if (inDb) {
      isActive = approved[productId] === true && product.active !== false;
      process.stdout.write(`  [${productId}] DBあり → ${isActive ? '✅ 有効' : '🗑 非アクティブ'}\n`);
    } else {
      process.stdout.write(`  [${productId}] DB外 → API確認中...`);
      const link = await checkAvailable(productId);
      isActive = !!link;
      console.log(isActive ? ' ✅ 有効' : ' ❌ 取得不可');
      await sleep(400);
    }

    if (isActive) continue;

    // Find replacement
    const currentIds = [productId];
    const replacement = findReplacement(products, approved, productType, tag, currentIds);

    if (!replacement) {
      console.log(`  ⚠️  代替品が見つかりません (type="${productType}" tag="${tag}")`);
      continue;
    }

    console.log(`  ♻️  置き換え: ${productId} → ${replacement.product_id} (${replacement.title_short || replacement.title?.slice(0, 30)})`);

    if (!CLAUDE_KEY) {
      console.log('  ⚠️  ANTHROPIC_API_KEY 未設定 → Claude書き換えをスキップ');
      continue;
    }

    const newSection = await rewriteSection(fullMatch, productId, replacement);
    updated = updated.replace(fullMatch, newSection);
    fileChanged = true;
    totalReplaced++;
  }

  if (fileChanged) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`  💾 保存: ${relPath}`);
  }
}

console.log(`\n📊 結果: ${totalChecked}件チェック / ${totalReplaced}件置き換え`);
