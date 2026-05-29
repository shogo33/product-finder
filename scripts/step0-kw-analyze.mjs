/**
 * step0-kw-analyze.mjs
 * keyword-all.csv からキーワード分析を行い {slug}-kw.json を出力する
 *
 * 使い方: node scripts/step0-kw-analyze.mjs <slug> "メインキーワード"
 * 例:    node scripts/step0-kw-analyze.mjs gamesir-t4-pro-osusume "GameSir T4 Pro"
 *
 * 入力:  data/keyword-csvs/keyword-all.csv
 * 出力:  data/articles/{slug}-kw.json
 *
 * 処理内容:
 *   1. CSVからメインKWに関連する行を抽出（部分一致）
 *   2. 検索ボリューム降順でソート
 *   3. Claudeで検索意図分類・メイン/サブKW整理
 *   4. {slug}-kw.json として保存
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');
const CSV_PATH     = path.resolve('data/keyword-csvs/keyword-all.csv');

const args    = process.argv.slice(2);
const slug    = args[0];
const mainKw  = args[1];

if (!slug || !mainKw) {
  console.error('使い方: node scripts/step0-kw-analyze.mjs <slug> "メインキーワード"');
  console.error('例:    node scripts/step0-kw-analyze.mjs gamesir-t4-pro-osusume "GameSir T4 Pro"');
  process.exit(1);
}

const outPath = path.join(ARTICLES_DIR, `${slug}-kw.json`);
fs.mkdirSync(ARTICLES_DIR, { recursive: true });

if (fs.existsSync(outPath) && !args.includes('--force')) {
  console.log(`⚠️  既に存在します: ${outPath}`);
  console.log('   上書きする場合は --force を付けて再実行してください。');
  process.exit(0);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSVが見つかりません: ${CSV_PATH}`);
  process.exit(1);
}

console.log(`\n🔍 「${mainKw}」のキーワード分析を開始...\n`);

// ── CSV パース ────────────────────────────────────────────────
const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const lines   = csvText.split('\n').filter(l => l.trim());
const headers = lines[0].split('\t');

// ヘッダーインデックス
const COL = {
  type:       headers.indexOf('データ種別'),
  seedKw:     headers.indexOf('シードKW'),
  keyword:    headers.indexOf('キーワード'),
  difficulty: headers.indexOf('SEO難易度'),
  volume:     headers.indexOf('月間検索数'),
  cpc:        headers.indexOf('CPC ($)'),
  adComp:     headers.indexOf('広告競合性'),
  rank:       headers.indexOf('検索順位'),
  traffic:    headers.indexOf('推定流入数'),
  url:        headers.indexOf('URL'),
};

function parseRow(line) {
  const cols = line.split('\t');
  return {
    type:       cols[COL.type]       ?? '',
    seedKw:     cols[COL.seedKw]     ?? '',
    keyword:    cols[COL.keyword]    ?? '',
    difficulty: cols[COL.difficulty] === 'null' ? null : Number(cols[COL.difficulty]) || null,
    volume:     cols[COL.volume]     === 'null' ? null : Number(cols[COL.volume])     || null,
    cpc:        cols[COL.cpc]        === 'null' ? null : Number(cols[COL.cpc])        || null,
    adComp:     cols[COL.adComp]     === 'null' ? null : Number(cols[COL.adComp])     || null,
    rank:       cols[COL.rank]       ? Number(cols[COL.rank])    || null : null,
    traffic:    cols[COL.traffic]    ? Number(cols[COL.traffic]) || null : null,
    url:        cols[COL.url]        ?? '',
  };
}

// メインKWに関連する行を抽出（大文字小文字を無視して部分一致）
const mainKwLower  = mainKw.toLowerCase();
// 複数単語に分割して各単語で検索
const mainKwTokens = mainKwLower.split(/[\s　]+/).filter(t => t.length >= 2);

const allRows = lines.slice(1).map(parseRow).filter(r => r.keyword);

const relatedRows = allRows.filter(r => {
  const kw = r.keyword.toLowerCase();
  const seed = r.seedKw.toLowerCase();
  // メインKW全体 or 各トークンいずれかが含まれているか
  return (
    kw.includes(mainKwLower) ||
    mainKwLower.includes(kw) ||
    mainKwTokens.some(t => kw.includes(t) || seed.includes(t))
  );
});

// ボリューム降順ソート（null は末尾）
relatedRows.sort((a, b) => {
  if (b.volume === null && a.volume === null) return 0;
  if (b.volume === null) return -1;
  if (a.volume === null) return 1;
  return b.volume - a.volume;
});

console.log(`📊 関連キーワード: ${relatedRows.length}件 抽出\n`);

if (relatedRows.length === 0) {
  console.warn('⚠️  CSVに一致するキーワードが見つかりませんでした。');
  console.warn('   メインKWのスペルや表記を確認してください。');
  console.warn('   --force で分析を続行します（空データで出力）\n');
}

// 上位30件をClaudeに渡す
const top30 = relatedRows.slice(0, 30);
const kwTable = top30.map(r =>
  `${r.keyword}\t月間:${r.volume ?? 'N/A'}\t難易度:${r.difficulty ?? 'N/A'}\t種別:${r.type}\tシード:${r.seedKw}`
).join('\n');

// ── Claude で意図分析 ────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY 未設定 — Claude分析をスキップして生データを保存します');
  const output = {
    slug,
    mainKeyword:  mainKw,
    analyzedAt:   new Date().toISOString().slice(0, 10),
    totalMatched: relatedRows.length,
    searchIntent: null,
    intentNote:   null,
    mainKws:      top30.slice(0, 5).map(r => ({ keyword: r.keyword, volume: r.volume })),
    subKws:       top30.slice(5, 15).map(r => ({ keyword: r.keyword, volume: r.volume })),
    longTailKws:  top30.slice(15).map(r => ({ keyword: r.keyword, volume: r.volume })),
    rawTop30:     top30,
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✅ 保存（Claude分析なし）: ${outPath}`);
  process.exit(0);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log('🤖 Claude でキーワード意図を分析中...');

const systemPrompt = `あなたはSEOキーワード戦略の専門家です。
日本語キーワードデータを分析し、検索意図・メインKW・サブKWを整理してJSON出力します。
JSONのみ返してください。コードブロックや説明文は不要です。`;

const userPrompt = `以下のキーワードデータを分析してください。
記事対象: ${mainKw}
スラッグ: ${slug}

【キーワードデータ（上位${top30.length}件）】
キーワード\t月間検索数\tSEO難易度\t種別\tシードKW
${kwTable}

以下のJSON形式で出力してください：

{
  "searchIntent": "おすすめ系|比較系|レビュー系|入門系|問題解決系|購入検討系",
  "intentNote": "検索ユーザーが何を求めているか（1〜2文）",
  "mainKws": [
    {"keyword": "最重要KW", "volume": 数値, "role": "このKWの役割"}
  ],
  "subKws": [
    {"keyword": "サブKW", "volume": 数値, "role": "本文・見出しに自然に含める理由"}
  ],
  "longTailKws": [
    {"keyword": "ロングテールKW", "volume": 数値, "role": "FAQ・比較表で対応する理由"}
  ],
  "titleHints": [
    "このデータから導けるタイトル案（検索意図に即したもの）",
    "タイトル案2",
    "タイトル案3"
  ],
  "metaDescHints": "meta descriptionに含めるべきKWと訴求ポイント（1文）",
  "warnings": ["懸念事項があれば。なければ空配列"]
}

【整理のルール】
- mainKws: 月間検索数が多い・記事タイトルに必ず含めるべきKW（1〜3件）
- subKws: 本文・見出しに自然に組み込むKW（3〜8件）
- longTailKws: FAQ・比較表・ニッチな疑問に対応するKW（残り）
- titleHints: 32文字以内・「2026年最新」の乱用禁止・用途/悩みを含める
- 無関係なKW（AKKO社員・芸能人等）は除外して分析すること`;

const response = await client.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  system:     systemPrompt,
  messages:   [{ role: 'user', content: userPrompt }],
});

let analysis;
try {
  const raw = response.content[0].text.trim()
    .replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  analysis = JSON.parse(raw);
} catch (e) {
  console.error('❌ Claude出力のJSONパースに失敗しました');
  console.error(response.content[0].text);
  process.exit(1);
}

// ── 出力 ────────────────────────────────────────────────────
const output = {
  slug,
  mainKeyword:  mainKw,
  analyzedAt:   new Date().toISOString().slice(0, 10),
  totalMatched: relatedRows.length,
  ...analysis,
  rawTop30:     top30,
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

// ── コンソールサマリー ────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ キーワード分析完了: ${outPath}\n`);
console.log(`📌 検索意図: ${analysis.searchIntent} — ${analysis.intentNote}`);
console.log(`\n🔑 メインKW（${analysis.mainKws?.length ?? 0}件）:`);
(analysis.mainKws ?? []).forEach(k => console.log(`  ・${k.keyword}（月間:${k.volume ?? 'N/A'}）— ${k.role}`));
console.log(`\n📎 サブKW（${analysis.subKws?.length ?? 0}件）:`);
(analysis.subKws ?? []).forEach(k => console.log(`  ・${k.keyword}（月間:${k.volume ?? 'N/A'}）`));
console.log(`\n💡 タイトルヒント:`);
(analysis.titleHints ?? []).forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
if (analysis.warnings?.length > 0) {
  console.log(`\n⚠️  注意事項:`);
  analysis.warnings.forEach(w => console.log(`  ・${w}`));
}
console.log('\n' + '━'.repeat(60));
console.log(`▶ 次: node scripts/step1-plan.mjs "${mainKw}" ${slug}`);
console.log(`     または: node scripts/step1-title-meta.mjs ${slug}`);
