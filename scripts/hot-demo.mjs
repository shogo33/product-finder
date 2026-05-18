import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY    = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL    = 'https://api-sg.aliexpress.com/sync';

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha256', APP_SECRET).update(sorted).digest('hex').toUpperCase();
}

async function callApi(method, extra) {
  const params = { app_key: APP_KEY, method, sign_method: 'sha256', timestamp: String(Date.now()), ...extra };
  params.sign = sign(params);
  const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  return res.json();
}

// ガジェット系人気商品を3件取得
const json = await callApi('aliexpress.affiliate.product.query', {
  tracking_id: TRACKING_ID,
  keywords: 'wireless earbuds bluetooth',
  target_currency: 'JPY',
  target_language: 'JA',
  sort: 'SALE_PRICE_ASC',
  page_size: '3',
  fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume',
});

const products = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
if (!products.length) { console.error('商品が取得できませんでした', JSON.stringify(json)); process.exit(1); }

const client = new Anthropic({ apiKey: CLAUDE_KEY });

for (const p of products) {
  console.log('\n' + '═'.repeat(60));
  console.log(`📦 商品ID:    ${p.product_id}`);
  console.log(`📝 タイトル:  ${p.product_title}`);
  console.log(`💴 価格:      ¥${p.target_sale_price}（元値 ¥${p.original_price}）`);
  console.log(`🖼  画像URL:   ${p.product_main_image_url}`);
  console.log(`🔗 リンク:    ${p.product_detail_url}`);
  console.log(`⭐ 評価:      ${p.evaluate_rate}`);
  console.log(`📊 販売数:    ${p.lastest_volume}件`);
  console.log();

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `以下のAliExpress人気商品を日本人向けに紹介してください。
商品名: ${p.product_title}
価格: ¥${p.target_sale_price}（元値¥${p.original_price}）
評価: ${p.evaluate_rate} / 販売数: ${p.lastest_volume}件

【形式】キャッチコピー1行 + 紹介文2〜3文（コスパ・魅力を強調）`
    }]
  });
  console.log('✍️  ', msg.content[0].text);
}
