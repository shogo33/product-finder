/**
 * 多様なキーワードで大量商品を取得するバルクフェッチスクリプト
 * 使い方: node scripts/bulk-fetch.mjs
 * description_ja はスキップ（採用後に別途生成）、title_short は生成する
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const APP_KEY     = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET  = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const API_URL     = 'https://api-sg.aliexpress.com/sync';
const DATA_FILE   = path.resolve('data/products.json');

// ── キーワード定義 ──────────────────────────────────────────
// product_type = dedup の単位（「同じ目的の商品」グループ）
const KEYWORD_LIST = [
  // イヤホン・ヘッドフォン（用途・装着方式が異なるので別 type）
  { keyword: 'TWS earbuds noise cancelling ANC',       tag: 'ガジェット',         type: 'カナル型イヤホン' },
  { keyword: 'bone conduction headphones sport',       tag: 'ガジェット',         type: '骨伝導ヘッドホン' },
  { keyword: 'open ear clip on headphones wireless',   tag: 'ガジェット',         type: 'オープンイヤーイヤホン' },
  // スマートウォッチ
  { keyword: 'smart watch fitness tracker health',     tag: 'ガジェット',         type: 'スマートウォッチ' },
  { keyword: 'smart band sleep monitor heart rate',    tag: 'ガジェット',         type: 'スマートウォッチ' },
  // スピーカー
  { keyword: 'bluetooth speaker waterproof portable',  tag: 'ガジェット',         type: 'Bluetoothスピーカー' },
  { keyword: 'mini bluetooth speaker outdoor',        tag: 'ガジェット',         type: 'Bluetoothスピーカー' },
  // 充電・電源
  { keyword: 'wireless charger fast charging pad',    tag: 'ガジェット',         type: 'ワイヤレス充電器' },
  { keyword: 'power bank 20000mah portable fast',     tag: 'ガジェット',         type: 'モバイルバッテリー' },
  { keyword: 'GaN USB-C charger 65W adapter',         tag: 'PC周辺機器',         type: 'USB充電アダプター' },
  // カメラ・映像
  { keyword: 'action camera 4K waterproof sport',     tag: 'ガジェット',         type: 'アクションカメラ' },
  { keyword: 'webcam HD 1080p streaming PC',          tag: 'PC周辺機器',         type: 'Webカメラ' },
  { keyword: 'ring light LED selfie photo',           tag: 'ガジェット',         type: 'リングライト' },
  // PC周辺機器
  { keyword: 'mechanical keyboard gaming RGB switch', tag: 'PC周辺機器',         type: 'キーボード' },
  { keyword: 'wireless gaming mouse ergonomic',       tag: 'PC周辺機器',         type: 'マウス' },
  { keyword: 'monitor stand riser desk organizer',    tag: 'PC周辺機器',         type: 'モニタースタンド' },
  { keyword: 'laptop cooling pad fan stand',          tag: 'PC周辺機器',         type: 'ノートPC冷却台' },
  { keyword: 'large gaming mouse pad desk mat',       tag: 'PC周辺機器',         type: 'マウスパッド' },
  { keyword: 'USB C docking station HDMI',            tag: 'PC周辺機器',         type: 'ドッキングステーション' },
  { keyword: 'HDMI cable 4K high speed',              tag: 'PC周辺機器',         type: 'HDMIケーブル' },
  // スマホアクセサリー
  { keyword: 'phone holder car mount magnetic',       tag: 'スマホアクセサリー',   type: 'スマホカーホルダー' },
  { keyword: 'selfie stick tripod bluetooth remote',  tag: 'スマホアクセサリー',   type: '自撮り棒' },
  { keyword: 'phone stand desk adjustable',           tag: 'スマホアクセサリー',   type: 'スマホスタンド' },
  // 照明・スマートホーム
  { keyword: 'LED strip light RGB smart room',        tag: 'スマートホーム',       type: 'LEDテープライト' },
  { keyword: 'smart desk lamp LED dimmable',          tag: 'スマートホーム',       type: 'デスクライト' },
  { keyword: 'smart plug WiFi timer outlet',          tag: 'スマートホーム',       type: 'スマートプラグ' },
  // プロジェクター (既存キーワードは除外)
  { keyword: 'mini projector outdoor camping',        tag: 'プロジェクター',       type: 'プロジェクター' },
  // フィットネス
  { keyword: 'resistance bands set gym workout',      tag: 'フィットネス',         type: 'トレーニングバンド' },
  { keyword: 'yoga mat thick non slip exercise',      tag: 'フィットネス',         type: 'ヨガマット' },
  { keyword: 'jump rope speed fitness crossfit',      tag: 'フィットネス',         type: '縄跳び' },
  { keyword: 'massage gun percussion muscle',         tag: 'フィットネス',         type: 'マッサージガン' },
  // キッチン・ホーム
  { keyword: 'electric mini kettle travel portable',  tag: 'キッチン',            type: '電気ケトル' },
  { keyword: 'food container storage set airtight',   tag: 'キッチン',            type: '食品保存容器' },
  { keyword: 'kitchen scale digital precise',         tag: 'キッチン',            type: 'キッチンスケール' },
  { keyword: 'silicone kitchen utensils set',         tag: 'キッチン',            type: 'キッチンツール' },
  // ボードゲーム（重複排除しない）
  { keyword: 'card game uno family adults',           tag: 'ボードゲーム',         type: 'カードゲーム' },
  { keyword: 'chess set wooden board game',           tag: 'ボードゲーム',         type: 'チェスセット' },
  { keyword: 'jigsaw puzzle 1000 pieces landscape',   tag: 'ボードゲーム',         type: 'ジグソーパズル' },
  { keyword: 'dice set polyhedral DND RPG',           tag: 'ボードゲーム',         type: 'ダイスセット' },
  { keyword: 'trading card protector sleeve binder',  tag: 'ボードゲーム',         type: 'カードスリーブ' },
  // その他ガジェット
  { keyword: 'portable fan USB rechargeable mini',    tag: 'ガジェット',           type: 'ポータブルファン' },
  { keyword: 'electric mosquito killer lamp indoor',  tag: 'ガジェット',           type: '虫除けライト' },
  { keyword: 'digital alarm clock LED bedroom',       tag: 'ガジェット',           type: '目覚まし時計' },
  { keyword: 'laser pointer pen presentation USB',    tag: 'PC周辺機器',           type: 'レーザーポインター' },
  { keyword: 'cable organizer management clip',       tag: 'PC周辺機器',           type: 'ケーブル整理' },
  { keyword: 'luggage tag travel accessories',        tag: 'トラベル',             type: 'ラゲッジタグ' },
  { keyword: 'travel adapter universal plug',         tag: 'トラベル',             type: '変換アダプター' },
  { keyword: 'packing cube travel organizer set',     tag: 'トラベル',             type: 'パッキングキューブ' },
];

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

async function generateShortTitle(title) {
  const client = new Anthropic({ apiKey: CLAUDE_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。ブランド名・製品番号があれば残し、スペック詳細・色・個数などは省略してください。商品名だけを出力し、説明や記号は一切不要です。\n\n商品名: ${title}` }]
  });
  return msg.content[0].text.trim();
}

// ── メイン ──────────────────────────────────────────────────
const existing    = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existingIds = new Set(existing.map(p => String(p.product_id)));

let totalAdded = 0;

for (let i = 0; i < KEYWORD_LIST.length; i++) {
  const { keyword, tag, type } = KEYWORD_LIST[i];
  console.log(`\n[${i + 1}/${KEYWORD_LIST.length}] 「${keyword}」(${type}) 取得中...`);

  const json = await callApi('aliexpress.affiliate.product.query', {
    tracking_id: TRACKING_ID,
    keywords: keyword,
    target_currency: 'JPY',
    target_language: 'JA',
    page_size: '50',
    fields: 'product_id,product_title,target_sale_price,original_price,product_main_image_url,product_detail_url,evaluate_rate,lastest_volume,commission_rate',
  });

  const raw = json?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
  let added = 0;

  for (const p of raw) {
    const id = String(p.product_id);
    if (existingIds.has(id)) continue;

    const product = {
      product_id:          id,
      title:               p.product_title,
      title_short:         null,
      price_jpy:           p.target_sale_price,
      original_price_jpy:  p.original_price,
      image_url:           p.product_main_image_url,
      affiliate_link:      p.product_detail_url,
      evaluate_rate:       p.evaluate_rate,
      sales_count:         p.lastest_volume,
      commission_rate:     p.commission_rate ?? null,
      product_type:        type,
      keyword,
      tag,
      fetched_at:          new Date().toISOString(),
      description_ja:      null,
    };

    if (CLAUDE_KEY) {
      product.title_short = await generateShortTitle(p.product_title);
      process.stdout.write(` → ${product.title_short}`);
    }

    existing.push(product);
    existingIds.add(id);
    added++;
    totalAdded++;
    process.stdout.write('\n');
  }

  console.log(`  ✅ ${added}件追加（スキップ: ${raw.length - added}件）`);

  // 100件ごとに中間保存
  if (totalAdded % 100 === 0 && totalAdded > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`  💾 中間保存: 合計 ${existing.length}件`);
  }

  await new Promise(r => setTimeout(r, 600));
}

fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
console.log(`\n✅ 完了: ${totalAdded}件追加（合計 ${existing.length}件）`);
