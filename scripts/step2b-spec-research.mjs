/**
 * step2b-spec-research.mjs
 * 各商品を個別にWeb検索して「商品タイプ・主要スペック・用途」を確定する
 *
 * 使い方: node scripts/step2b-spec-research.mjs <slug>
 * 例:    node scripts/step2b-spec-research.mjs haylou-osusume
 *
 * 入力:  data/articles/{slug}-research.json
 * 出力:  data/articles/{slug}-research.json（各商品の productProfile を追記）
 *
 * 処理（1商品ずつ独立に処理）:
 *   1. Tavily で "{cleanName} specifications review" を検索
 *   2. Claude Haiku で商品タイプ・スペック・用途を抽出（1商品1コール）
 *   3. research.json の各商品に productProfile を追記
 *
 * productProfile の構造:
 *   productType       : "完全ワイヤレスイヤホン（TWS）" など
 *   productTypeShort  : "TWS" / "ANCイヤホン" / "ヘッドフォン" / "スマートウォッチ" など
 *   keySpecs          : ["Bluetooth 5.3", "IPX4防水", ...] ← 比較表に使う
 *   keyFeatures       : ["ANC搭載", "マルチポイント接続", ...] ← 主な特徴
 *   targetUseCase     : ["通勤", "在宅ワーク"] ← おすすめシーン
 *   notSuitableFor    : ["遮音性重視"] ← 向かない用途
 *   batteryLife       : "イヤホン単体8h / ケース込み48h" など
 *   searchSources     : 参照したURLリスト
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const slug = process.argv[2];
const forceAll = process.argv.includes('--force');

if (!slug) {
  console.error('使い方: node scripts/step2b-spec-research.mjs <slug> [--force]');
  console.error('  --force : 既存のproductProfileも上書き再取得する');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

const TAVILY_KEY = process.env.TAVILY_API_KEY;

const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
if (!fs.existsSync(researchPath)) {
  console.error(`❌ research.json が見つかりません: ${researchPath}`);
  process.exit(1);
}

const research  = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const products  = research.products ?? [];
const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log(`\n🔬 step2b-spec-research: ${slug} (${products.length}件)\n`);

// ── Tavily 検索 ───────────────────────────────────────────────
async function tavilySearch(query) {
  if (!TAVILY_KEY) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:      TAVILY_KEY,
        query,
        search_depth: 'basic',
        max_results:  5,
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

// 複数クエリを試して最初にヒットした結果を返す
async function tavilySearchMulti(name) {
  const queries = [
    `${name} specifications review`,           // クォートなし・英語
    `${name} イヤホン ヘッドフォン スペック`,   // 日本語カテゴリ含む
    `${name} earphone headphone type`,         // カテゴリ判別用
    `${name} レビュー 特徴`,                   // 日本語レビュー
  ];
  for (const q of queries) {
    const results = await tavilySearch(q);
    await sleep(400);
    if (results.length > 0) {
      console.log(`  🌐 Web情報: ${results.length}件（クエリ: "${q.slice(0,40)}"）`);
      return results;
    }
  }
  return [];
}

// ── 1商品のプロフィールを抽出 ─────────────────────────────────
async function extractProductProfile(product) {
  const name = product.cleanName;

  // 既存プロフィールがあればスキップ（--force で上書き）
  if (product.productProfile && !forceAll) {
    console.log(`  ⏭  スキップ（既存profileあり）: ${name}`);
    return product.productProfile;
  }

  console.log(`\n  📦 ${name}`);

  // 1. 複数クエリを試してWeb情報を取得（1商品 = 最大4クエリ、ヒット次第停止）
  const searchResults = await tavilySearchMulti(name);

  const snippets = searchResults
    .slice(0, 4)
    .map(r => `[${r.url}]\n${(r.content ?? '').slice(0, 400)}`)
    .join('\n\n');

  const sources = searchResults.slice(0, 4).map(r => r.url).filter(Boolean);

  if (snippets.length < 20) {
    console.log(`  ⚠️  Web情報なし → 商品名から推測（確信度: low）`);
  }

  // 2. Claude Haiku で構造化抽出（1商品1コール）
  process.stdout.write('  🤖 プロフィール抽出...');

  const prompt = `以下の商品情報から、記事執筆に必要な構造化データを抽出してJSON形式で返してください。
情報が不足している場合は商品名から推測し、不明な項目は null にしてください。
JSONのみ返してください（コードブロック不要）。

商品名: ${name}

## Web検索結果
${snippets || '（検索結果なし）'}

## 出力形式
{
  "productType": "完全ワイヤレスイヤホン（TWS）など具体的なカテゴリ名",
  "productTypeShort": "TWS / ANCイヤホン / 開放型イヤホン / ヘッドフォン / スマートウォッチ など10文字以内",
  "isInEar": true/false（カナル型・インイヤー型かどうか）,
  "isOverEar": true/false（オーバーイヤー・ヘッドフォン型かどうか）,
  "isOpenEar": true/false（開放型・骨伝導・オープンイヤーかどうか）,
  "hasANC": true/false/null,
  "connectivity": "Bluetooth 5.x など",
  "batteryLife": "単体◯h / ケース込み◯h など（不明はnull）",
  "keySpecs": ["スペック1", "スペック2", "スペック3"],
  "keyFeatures": ["特徴1", "特徴2", "特徴3"],
  "targetUseCase": ["通勤", "在宅ワーク", "スポーツ" など最大3件],
  "notSuitableFor": ["向かない用途1" など最大2件],
  "pricePosition": "エントリー / ミドルレンジ / ハイエンド",
  "confidence": "high / medium / low（推測の確信度）"
}`;

  const res = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  });

  await sleep(800);

  let profile;
  try {
    const raw = res.content[0].text.trim()
      .replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
    profile = JSON.parse(raw);
    profile.searchSources = sources;
    console.log(` ✅ (${profile.productTypeShort ?? '不明'} / 確信度:${profile.confidence ?? '?'})`);
  } catch (e) {
    console.log(' ⚠️ パース失敗 → スキップ');
    return null;
  }

  return profile;
}

// ── メイン処理（1商品ずつ順番に処理） ─────────────────────────
let updatedCount = 0;

for (const product of products) {
  const profile = await extractProductProfile(product);
  if (profile) {
    product.productProfile = profile;
    updatedCount++;
  }
}

// ── research.json に保存 ──────────────────────────────────────
fs.writeFileSync(researchPath, JSON.stringify(research, null, 2), 'utf8');

// ── サマリー ─────────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ step2b-spec-research 完了 (${updatedCount}件更新)\n`);

products.forEach((p, i) => {
  const prof = p.productProfile;
  if (!prof) { console.log(`  ${i+1}. ${p.cleanName} → プロフィールなし`); return; }
  console.log(`  ${i+1}. ${p.cleanName}`);
  console.log(`     タイプ: ${prof.productTypeShort ?? '不明'} | ANC: ${prof.hasANC === true ? 'あり' : prof.hasANC === false ? 'なし' : '不明'}`);
  console.log(`     用途: ${(prof.targetUseCase ?? []).join(' / ')}`);
  console.log(`     向かない: ${(prof.notSuitableFor ?? []).join(' / ') || '記載なし'}`);
});

// ── 確信度チェック → 要確認商品があればreview JSONを出力 ──────
const lowConfidence = products.filter(p =>
  p.productProfile?.confidence === 'low' || !p.productProfile
);

if (lowConfidence.length > 0) {
  const reviewPath = path.join(ARTICLES_DIR, `${slug}-profile-review.json`);
  const reviewData = {
    _instruction: 'productTypeShortを確認・修正してください。修正後はそのまま step3a-scaffold.mjs を実行できます（research.jsonに反映済み）。',
    _validTypes:  'TWS / ANCイヤホン / 開放型イヤホン / ヘッドフォン / オーバーイヤーヘッドフォン / スマートウォッチ / ネックバンドイヤホン / 骨伝導イヤホン',
    products: lowConfidence.map(p => ({
      product_id:       p.product_id,
      cleanName:        p.cleanName,
      productTypeShort: p.productProfile?.productTypeShort ?? '未設定',
      hasANC:           p.productProfile?.hasANC ?? null,
      targetUseCase:    p.productProfile?.targetUseCase ?? [],
      confidence:       p.productProfile?.confidence ?? 'none',
    }))
  };
  fs.writeFileSync(reviewPath, JSON.stringify(reviewData, null, 2), 'utf8');

  console.log('\n' + '━'.repeat(60));
  console.log(`\n⚠️  確信度が低い商品が ${lowConfidence.length} 件あります（Webデータ不足）`);
  console.log(`   以下ファイルで productTypeShort を確認・修正してください:\n`);
  console.log(`   📝 ${reviewPath}\n`);
  lowConfidence.forEach(p => {
    console.log(`   - ${p.cleanName}:「${p.productProfile?.productTypeShort ?? '未設定'}」← 要確認`);
  });
  console.log(`\n   修正後: research.json の productProfile を直接編集してから`);
  console.log(`           node scripts/step3a-scaffold.mjs ${slug} を実行してください`);
}

console.log('\n' + '━'.repeat(60));
console.log(`\n▶ 次: node scripts/step3a-scaffold.mjs ${slug}`);
console.log(`   ※ productProfile が比較表・prose 生成に自動反映されます`);
