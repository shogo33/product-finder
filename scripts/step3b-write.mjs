/**
 * step3b-write.mjs
 * 1商品の解説文（prose）だけをClaudeで生成する
 *
 * 使い方: node scripts/step3b-write.mjs <slug> <product_id>
 * 例:    node scripts/step3b-write.mjs gamesir-t4-pro-osusume 4001076841625
 *        node scripts/step3b-write.mjs gamesir-t4-pro-osusume all   ← 全商品を順番に処理
 *
 * 入力:  data/articles/{slug}-research.json
 *        data/articles/{slug}-plan.json
 *        data/articles/{slug}-amzreview.json（あれば）
 *        data/articles/{slug}-scaffold.html（PROSE-{id}プレースホルダーの確認用）
 * 出力:  data/articles/{slug}-prose-{product_id}.html
 *        ※ scaffold.html の <!-- PROSE-{id} --> は step3d-assemble.mjs が置換する
 *
 * 【原則】
 *   - 1コール = 1商品。他商品のデータは一切渡さない
 *   - 生成するのは prose のみ（h2見出し + 説明文 + Reddit引用 + callout）
 *   - スペック数値・価格・リンクは scaffold に既にある → ここでは書かない
 *   - Amazonレビューがあれば「〜という声が多い」形式で反映
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args      = process.argv.slice(2);
const slug      = args[0];
const targetId  = args[1];

if (!slug || !targetId) {
  console.error('使い方: node scripts/step3b-write.mjs <slug> <product_id|all>');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

// ── ファイル読み込み ──────────────────────────────────────────
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);

for (const p of [researchPath, planPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ファイルが見つかりません: ${p}`);
    process.exit(1);
  }
}

const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const plan     = JSON.parse(fs.readFileSync(planPath, 'utf8'));

const amzPath   = path.join(ARTICLES_DIR, `${slug}-amzreview.json`);
const amzData   = fs.existsSync(amzPath) ? JSON.parse(fs.readFileSync(amzPath, 'utf8')) : null;

const allProducts = research.products ?? [];

// 対象商品を特定
const targets = targetId === 'all'
  ? allProducts
  : allProducts.filter(p => String(p.product_id) === String(targetId));

if (targets.length === 0) {
  console.error(`❌ product_id "${targetId}" が research.json に見つかりません`);
  console.error(`   利用可能なID: ${allProducts.map(p => p.product_id).join(', ')}`);
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000 });

// ── 1商品の prose を生成 ──────────────────────────────────────
async function generateProse(product, index) {
  const id = String(product.product_id ?? `p${index}`);
  console.log(`\n[${index + 1}/${targets.length}] ${product.cleanName} (ID: ${id})`);

  // この商品のAmazonレビューデータを探す
  const amzReview = amzData?.reviews?.find(r =>
    String(r.productId) === id || r.productName?.includes(product.cleanName?.split(' ')[0])
  ) ?? null;

  // plan.sections から該当商品のセクションメモを探す
  const sectionNote = plan.sections?.find(s =>
    s.type === 'product' && (
      s.h2?.includes(product.cleanName?.split(' ')[0]) ||
      s.notes?.some(n => n.includes(product.cleanName?.split(' ')[0]))
    )
  );

  // Reddit口コミ（上位3件）
  const redditText = (product.redditReviews ?? []).slice(0, 3).map(r =>
    `  [${r.subreddit}] "${r.snippet.slice(0, 250)}"  URL: ${r.url}`
  ).join('\n') || '  なし';

  // Amazonレビュー
  const amzText = amzReview
    ? `良い点: ${(amzReview.positivePoints ?? []).join(' / ')}\n悪い点: ${(amzReview.negativePoints ?? []).join(' / ')}\n記事用スニペット: ${amzReview.articleSnippet ?? ''}`
    : 'なし';

  // 公式スペック（500文字以内）
  const specText = product.specResult?.content?.slice(0, 500) ?? 'なし';

  // productProfile（step2b-spec-research で確定した構造化データ）
  const prof = product.productProfile;
  const profileText = prof
    ? `商品タイプ: ${prof.productType ?? prof.productTypeShort ?? '不明'}
ANC: ${prof.hasANC === true ? 'あり' : prof.hasANC === false ? 'なし' : '不明'}
バッテリー: ${prof.batteryLife ?? '不明'}
接続: ${prof.connectivity ?? '不明'}
主なスペック: ${(prof.keySpecs ?? []).join(' / ') || 'なし'}
主な特徴: ${(prof.keyFeatures ?? []).join(' / ') || 'なし'}
おすすめ用途: ${(prof.targetUseCase ?? []).join(' / ') || 'なし'}
向かない用途: ${(prof.notSuitableFor ?? []).join(' / ') || 'なし'}`
    : 'なし（step2b-spec-research.mjs を実行すると精度が上がります）';

  const persona = plan.persona ?? 'AliExpressを使い倒しているガジェットオタク。スペックの細かい差異に詳しく、読者に対して熱量を持って語りかけるスタイル。';

  const SYSTEM = `あなたは渡されたデータをもとに、商品レビュー記事の「1商品分の解説セクション」だけを執筆する専門ライターです。

## 絶対ルール
1. **渡された1商品の情報だけで書く** — 他商品との比較や言及は一切しない
2. **スペック数値・価格・リンク・画像は書かない** — これらはすでにHTMLに存在する
3. **Redditの声を blockquote で必ず使う** — そのまま翻訳せず「海外ガチ勢の実感」として昇華する
4. **AmazonレビューがあればAmazon傾向として1〜2文必ず書く**（「〜という声が多い」形式）
5. **デメリット・注意点を必ず1箇所以上書く**
6. **「想像とのズレ」を1箇所書く**（写真より少し大きい・思ったより〜など）
7. h2の見出しを必ず含める
8. 禁止表現: コスパ最強・圧倒的・神・革命的・非常に優秀・快適・高性能・最強・完璧
9. **ネットスラング・バズワード絶対禁止**:
   - 「〜の件」「〜た件」「〜な件について」
   - 「という時点で、もう〜」「時点でもう勝ち」
   - 「〜がある意味〜」「ある種の〜」「ある意味では」（曖昧な言い回し）
   - 「なんなら〜」「そもそも論で言うと」
   - 「〜というか、もはや〜」「もはや〜レベル」
   - 「刺さる人には刺さる」
   - 「〜でしかない」（強調スラング）
   - 「〜してほしい（懇願形）」（読者への過度な親しみ）

## 文体ルール（最重要）
ペルソナ: ${persona}
- **ですます調で統一**：「〜です。」「〜ます。」「〜になります。」で完結させる
- ネット的な感嘆・大げさな表現を使わない。事実をそのまま伝える
- PREP法: 結論から書き始める
- 1文を短く・箇条書きを多用
- 「〜という声が多い」「〜という報告があります」形式を使う（断定レビューは禁止）
- 熱量は「語り口」ではなく「情報密度と具体性」で表現する

## 出力形式
HTMLのみ。マークダウン記法・コードブロック不要。
出力する要素:
- <h2> 見出し（この商品のセクション見出し）
- <p> 段落（複数）
- <div class="callout"> または <div class="callout-danger"> （1〜2個）
- <blockquote class="reddit-quote"> （Redditデータがあれば必ず1〜2個）
- <ul> 良い点・悪い点リスト
- <p> Amazonレビュー傾向（あれば）`;

  const USER = `## 執筆対象商品
商品名: ${product.cleanName}
記事キーワード: ${plan.keyword}
カテゴリ: ${plan.category}

## セクション構成メモ
${sectionNote ? sectionNote.notes?.join('\n') ?? sectionNote.h2 : '特になし（商品の特徴・用途・向いている人・向かない人を中心に書く）'}

## 商品プロフィール（確定情報・必ずこの情報を使って書くこと）
${profileText}

## 公式スペック情報（Tavily取得）
${specText}

## Reddit口コミ（生データ）
${redditText}

## Amazonレビューデータ
${amzText}

---
上記の情報だけを使って、この商品1件の解説セクションHTMLを出力してください。
スペック数値・価格・購入リンクは書かないでください（別のHTMLで既に存在します）。`;

  process.stdout.write('  → Claude Sonnet 生成中...');

  let prose = '';
  const stream = await client.messages.stream({
    model:      'claude-sonnet-4-6',
    max_tokens: 4000,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: USER }],
  });
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      prose += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log(' ✅');

  // コードブロック除去
  prose = prose.trim()
    .replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();

  // ── 禁止表現の自動修正（AI生成直後・保存前） ─────────────────
  // 助詞・活用形ごとに分割して文法的に正確な置換（グループキャプチャ不使用）
  // 長いパターンを先に並べて短いパターンの誤マッチを防ぐ
  const BANNED_MAP = [
    // ネットスラング・バズワード（文体品質維持）
    { pattern: /という時点で、?もう/g,   replace: 'だけで十分' },
    { pattern: /という時点でもう/g,      replace: 'だけで十分' },
    { pattern: /た件について?/g,         replace: 'について' },
    { pattern: /な件について?/g,         replace: 'について' },
    { pattern: /の件について?/g,         replace: 'について' },
    { pattern: /た件[。、\s]/g,          replace: '。' },
    { pattern: /な件[。、\s]/g,          replace: '。' },
    { pattern: /の件[。、\s]/g,          replace: 'だ。' },
    { pattern: /刺さる人には刺さる/g,    replace: '向いている人には向いている' },
    { pattern: /でしかない/g,            replace: 'だ' },
    { pattern: /もはや.{0,8}レベル/g,    replace: 'に近い水準' },
    { pattern: /なんなら/g,              replace: '場合によっては' },
    { pattern: /ある意味/g,              replace: '' },
    { pattern: /ある種の/g,              replace: '' },
    // コスパ最強
    { pattern: /コスパ最強の/g,         replace: '価格帯で性能が高い' },
    { pattern: /コスパ最強です/g,       replace: '価格に対して性能が高いです' },
    { pattern: /コスパ最強/g,           replace: '価格帯での高い性能' },
    // 圧倒的（助詞ごとに分岐）
    { pattern: /圧倒的な/g,             replace: 'かなり高い' },
    { pattern: /圧倒的に/g,             replace: 'かなり' },
    { pattern: /圧倒的/g,               replace: 'かなりの' },
    // 革命的
    { pattern: /革命的な/g,             replace: '大きな変化をもたらす' },
    { pattern: /革命的に/g,             replace: '大きく' },
    { pattern: /革命的/g,               replace: '大きな変化' },
    // 非常に優秀
    { pattern: /非常に優秀な/g,         replace: '性能が高い' },
    { pattern: /非常に優秀/g,           replace: '性能が高い' },
    // 高性能
    { pattern: /高性能な/g,             replace: 'スペックが充実した' },
    { pattern: /高性能で/g,             replace: 'スペックが充実していて' },
    { pattern: /高性能/g,               replace: 'スペックの充実' },
    // 快適（い形容詞に変換するため助詞ごとに分岐）
    { pattern: /快適な/g,               replace: '使いやすい' },
    { pattern: /快適に/g,               replace: '使いやすく' },
    { pattern: /快適で/g,               replace: '使いやすく' },
    { pattern: /快適さ/g,               replace: '使いやすさ' },
    { pattern: /快適/g,                 replace: '使いやすい' },
    // 神〇〇
    { pattern: /神機/g,                 replace: '優れたモデル' },
    { pattern: /神スペック/g,           replace: '充実したスペック' },
    { pattern: /神値段/g,               replace: '手ごろな価格' },
    // 完璧
    { pattern: /完璧な/g,               replace: 'バランスが取れた' },
    { pattern: /完璧です/g,             replace: 'バランスが取れています' },
    { pattern: /完璧/g,                 replace: 'バランスよく仕上がった' },
    // 断定レビュー（長いものを先に）
    { pattern: /購入して使いました/g,   replace: '購入したという声があります' },
    { pattern: /実際に使いました/g,     replace: '使ったという声があります' },
    { pattern: /実際に試しました/g,     replace: '試したという報告があります' },
    { pattern: /使ってみました/g,       replace: '使ったという報告があります' },
    // AI構文（長いものを先に）
    { pattern: /誰にでもおすすめできます/g, replace: '幅広い用途に対応します' },
    { pattern: /誰にでもおすすめです/g, replace: '幅広い用途に向いています' },
    { pattern: /誰にでもおすすめ/g,     replace: '幅広い用途に向いた' },
    { pattern: /に定評があります/g,     replace: 'という評価が多い傾向があります' },
    { pattern: /の一品です/g,           replace: 'という選択肢です' },
  ];

  const proseOriginal = prose;
  const fixLog = [];
  for (const { pattern, replace } of BANNED_MAP) {
    const before = prose;
    prose = prose.replace(pattern, replace);
    if (prose !== before) {
      fixLog.push(`  🔧 "${pattern.source}" → "${replace}"`);
    }
  }

  if (fixLog.length > 0) {
    console.log(`  ⚠️  禁止表現を自動修正（${fixLog.length}件）:`);
    fixLog.forEach(l => console.log(l));
  }

  // ── 保存 ─────────────────────────────────────────────────
  const outPath = path.join(ARTICLES_DIR, `${slug}-prose-${id}.html`);
  const output  = `<!-- prose: ${product.cleanName} / product_id: ${id} / generated: ${new Date().toISOString().slice(0,10)} -->\n${prose}\n`;
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`  → 保存: ${outPath}`);

  return { id, cleanName: product.cleanName, outPath };
}

// ── メイン処理 ────────────────────────────────────────────────
console.log(`\n✍️  step3b-write: ${slug}`);
console.log(`   対象: ${targets.length}件 (${targets.map(p => p.cleanName).join(' / ')})\n`);

const results = [];
for (let i = 0; i < targets.length; i++) {
  const result = await generateProse(targets[i], i);
  results.push(result);
  if (i < targets.length - 1) await sleep(1500); // レートリミット対策
}

// ── サマリー ─────────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ prose 生成完了 (${results.length}件)\n`);
results.forEach((r, i) => console.log(`  ${i + 1}. ${r.cleanName}\n     → ${r.outPath}`));

// scaffold への組み込み状態を確認
const scaffoldPath = path.join(ARTICLES_DIR, `${slug}-scaffold.html`);
if (fs.existsSync(scaffoldPath)) {
  const scaffoldHtml = fs.readFileSync(scaffoldPath, 'utf8');
  const remaining = results.filter(r => scaffoldHtml.includes(`<!-- PROSE-${r.id} -->`));
  if (remaining.length > 0) {
    console.log(`\n📌 scaffold に残っているPROSEプレースホルダー:`);
    remaining.forEach(r => console.log(`  PROSE-${r.id} (${r.cleanName})`));
    console.log('  → step3d-assemble.mjs で自動置換されます');
  }
}

// まだ生成されていないproseがあるか確認
const notDone = allProducts.filter((p, i) => {
  const id = String(p.product_id ?? `p${i}`);
  const prosePath = path.join(ARTICLES_DIR, `${slug}-prose-${id}.html`);
  return !fs.existsSync(prosePath);
});
if (notDone.length > 0) {
  console.log(`\n⚠️  まだ prose が生成されていない商品:`);
  notDone.forEach(p => console.log(`  → node scripts/step3b-write.mjs ${slug} ${p.product_id}  (${p.cleanName})`));
} else {
  console.log(`\n✅ 全商品のproseが揃いました`);
  console.log(`▶ 次: node scripts/step3c-meta.mjs ${slug}`);
}
