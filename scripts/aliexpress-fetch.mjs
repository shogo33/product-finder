/**
 * AliExpress Affiliate API + Claude 自動紹介文生成スクリプト
 * 使い方: node scripts/aliexpress-fetch.mjs <商品ID> [商品ID2 ...]
 * 例:    node scripts/aliexpress-fetch.mjs 1005006789012345
 */

import crypto from 'crypto';
import 'dotenv/config';

const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL    = 'https://api-sg.aliexpress.com/sync';

// ── AliExpress API署名生成 ──────────────────────────────
function sign(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

// ── 商品詳細取得 ────────────────────────────────────────
async function getProductDetail(productIds) {
  const params = {
    app_key:     APP_KEY,
    method:      'aliexpress.affiliate.product.detail.get',
    sign_method: 'sha256',
    timestamp:   String(Date.now()),
    product_ids: Array.isArray(productIds) ? productIds.join(',') : productIds,
    fields:      'product_id,product_title,sale_price,original_price,product_main_image_url,product_detail_url,commission_rate,evaluate_rate,lastest_volume',
    tracking_id: 'ariexfinder',
  };
  params.sign = sign(params);

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${query}`);
  const json = await res.json();

  const result = json?.aliexpress_affiliate_product_detail_get_response?.resp_result;
  if (result?.resp_code !== 200) {
    throw new Error(`API Error: ${result?.resp_msg ?? JSON.stringify(json)}`);
  }
  return result.result.products.product;
}

// ── Claudeで日本語紹介文生成 ─────────────────────────────
async function generateDescription(product) {
  const prompt = `以下のAliExpress商品情報をもとに、日本人向けの魅力的な紹介文を日本語で書いてください。

商品名: ${product.product_title}
価格: ${product.sale_price}（元値: ${product.original_price}）
評価: ${product.evaluate_rate}
販売数: ${product.lastest_volume}件
手数料率: ${product.commission_rate}

【出力形式】
- キャッチコピー（1行、30文字以内）
- 紹介文（3〜4文、商品の魅力・使い方・コスパを強調）
- おすすめポイント（箇条書き3点）

読者はアリエクに興味があるが購入に少し不安を持っている日本人です。安心感と期待感を与えてください。`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Claude Error: ${json.error.message}`);
  return json.content[0].text;
}

// ── メイン ──────────────────────────────────────────────
async function main() {
  const productIds = process.argv.slice(2);
  if (productIds.length === 0) {
    console.error('使い方: node scripts/aliexpress-fetch.mjs <商品ID> [商品ID2 ...]');
    process.exit(1);
  }

  console.log(`\n🔍 商品情報を取得中... (${productIds.join(', ')})\n`);
  const products = await getProductDetail(productIds);

  for (const product of products) {
    console.log('═'.repeat(60));
    console.log(`📦 商品ID:    ${product.product_id}`);
    console.log(`📝 タイトル:  ${product.product_title}`);
    console.log(`💴 価格:      ${product.sale_price}（元値 ${product.original_price}）`);
    console.log(`🖼  画像URL:   ${product.product_main_image_url}`);
    console.log(`🔗 アフィリンク: ${product.product_detail_url}`);
    console.log(`⭐ 評価:      ${product.evaluate_rate}`);
    console.log(`📊 販売数:    ${product.lastest_volume}件`);
    console.log();

    if (CLAUDE_KEY && CLAUDE_KEY !== 'your_anthropic_api_key_here') {
      console.log('✍️  紹介文を生成中...\n');
      const description = await generateDescription(product);
      console.log(description);
    } else {
      console.log('ℹ️  ANTHROPIC_API_KEYを.envに設定すると紹介文も自動生成されます');
    }
    console.log();
  }
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
