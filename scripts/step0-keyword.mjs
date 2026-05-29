/**
 * Step 0: キーワード分析・検索意図把握
 * 使い方: node scripts/step0-keyword.mjs <slug> <シードKW>
 * 例:    node scripts/step0-keyword.mjs haylou-osusume HAYLOU
 *
 * 入力:  data/keyword-csvs/keyword-all.csv
 * 出力:  data/articles/{slug}-keyword.json
 *
 * やること:
 *   1. CSVからシードKW関連キーワードを全抽出
 *   2. タイプ別に分類（おすすめ/不安/型番/比較/入門）
 *   3. Claude Haiku で検索意図・SEO推奨を分析
 *   4. step1-plan.mjs が読み込む keyword.json を出力
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// ── CLI ─────────────────────────────────────────────────────
const [slug, seedRaw] = process.argv.slice(2);
if (!slug || !seedRaw) {
  console.error('使い方: node scripts/step0-keyword.mjs <slug> <シードKW>');
  console.error('例:    node scripts/step0-keyword.mjs haylou-osusume HAYLOU');
  process.exit(1);
}
const seed = seedRaw.trim();

const ARTICLES_DIR = path.resolve('data/articles');
const CSV_PATH     = path.resolve('data/keyword-csvs/keyword-all.csv');
const outPath      = path.join(ARTICLES_DIR, `${slug}-keyword.json`);

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSVが見つかりません: ${CSV_PATH}`);
  process.exit(1);
}

console.log(`\n🔍 キーワード分析開始: "${seed}" (slug: ${slug})\n`);

// ── CSVパース ────────────────────────────────────────────────
// BOM除去 + タブ区切りパース
const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '');
const lines = raw.split('\n').filter(l => l.trim());
const header = lines[0].split('\t');

const COL = {
  type:     header.findIndex(h => h.includes('データ種別')),
  seed:     header.findIndex(h => h.includes('シードKW')),
  keyword:  header.findIndex(h => h.includes('キーワード') && !h.includes('シード')),
  diff:     header.findIndex(h => h.includes('SEO難易度')),
  searches: header.findIndex(h => h.includes('月間検索数')),
  cpc:      header.findIndex(h => h.includes('CPC')),
  section:  header.findIndex(h => h.includes('区分')),
};

const seedLower = seed.toLowerCase();

// シードKW または キーワード に seed が含まれる行を抽出
const matched = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  const kw     = (cols[COL.keyword] ?? '').trim();
  const kwSeed = (cols[COL.seed]    ?? '').trim();
  if (!kw) continue;

  const kwLower   = kw.toLowerCase();
  const seedColLo = kwSeed.toLowerCase();

  if (kwLower.includes(seedLower) || seedColLo.includes(seedLower)) {
    const searches = parseInt(cols[COL.searches] ?? '0', 10) || 0;
    const diff     = parseInt(cols[COL.diff]     ?? '0', 10) || 0;
    matched.push({
      keyword:  kw,
      searches,
      difficulty: diff,
      cpc:      parseFloat(cols[COL.cpc] ?? '0') || 0,
      section:  cols[COL.section] ?? '',
    });
  }
}

// 検索数でソート → 重複キーワード除去（大文字小文字統一）
const seen = new Set();
const unique = matched
  .sort((a, b) => b.searches - a.searches)
  .filter(r => {
    const key = r.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

console.log(`✅ 関連KW: ${unique.length}件 抽出`);

if (unique.length === 0) {
  console.warn(`⚠️  "${seed}" に一致するキーワードが見つかりません`);
  console.warn('   シードKWのスペルを確認してください（例: "HAYLOU", "GameSir", "UGREEN"）');
  process.exit(1);
}

// ── タイプ別分類 ─────────────────────────────────────────────
const TYPE_RULES = [
  { type: 'anxiety',    patterns: ['偽物', '危険', '怪しい', '届かない', '関税', '安全', 'トラブル', '返品', '壊れ', '失敗'] },
  { type: 'comparison', patterns: ['比較', 'vs', 'versus', 'どちら', '違い', '差', 'おすすめ vs'] },
  { type: 'recommend',  patterns: ['おすすめ', 'ランキング', '選び方', '買い方', 'コスパ', '最安', 'セール'] },
  { type: 'howto',      patterns: ['使い方', '設定', 'やり方', 'ペアリング', '接続', '繋ぎ方', '方法'] },
  { type: 'info',       patterns: ['とは', 'とは何', '仕組み', 'ブランド', '会社', 'メーカー', '評判'] },
  { type: 'model',      patterns: [] }, // 残り（型番系）
];

function classifyKeyword(kw) {
  const kwLower = kw.toLowerCase();
  for (const rule of TYPE_RULES.slice(0, -1)) {
    if (rule.patterns.some(p => kwLower.includes(p))) return rule.type;
  }
  return 'model';
}

const byType = { anxiety: [], comparison: [], recommend: [], howto: [], info: [], model: [] };
for (const row of unique) {
  const t = classifyKeyword(row.keyword);
  byType[t].push(row);
}

// 各タイプの上位 N 件
const TOP = { anxiety: 10, comparison: 8, recommend: 10, howto: 6, info: 6, model: 15 };
for (const t of Object.keys(byType)) {
  byType[t] = byType[t].slice(0, TOP[t]);
}

// メインKW = recommend 最上位 or 全体最上位
const mainKw = byType.recommend[0] ?? unique[0];

// Claude に渡す最大 60 件
const forClaude = unique.slice(0, 60).map(r => `${r.keyword}（${r.searches.toLocaleString()}）`).join('\n');

console.log(`📊 タイプ別: おすすめ${byType.recommend.length} 不安${byType.anxiety.length} 型番${byType.model.length} 比較${byType.comparison.length} 使い方${byType.howto.length} 情報${byType.info.length}`);
console.log(`🏆 メインKW候補: "${mainKw.keyword}" (${mainKw.searches.toLocaleString()}件/月)\n`);

// ── Claude Haiku: SEO分析 ────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY 未設定 → Claude分析をスキップ');
  saveResult(null);
  process.exit(0);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 });

console.log('🤖 Claude Haiku で検索意図を分析中...');

const prompt = `以下は「${seed}」関連の日本語検索キーワード一覧（月間検索数付き）です。

${forClaude}

このデータを分析して、以下のJSONを出力してください（コードブロック不要、JSONのみ）：

{
  "mainKeyword": "最も重要なメインKW（月間検索数・SEO対策価値を考慮）",
  "searchIntentType": "commercial | informational | comparison | anxiety",
  "searchIntentNote": "検索者が何を知りたいか・何をしたいか（1文で）",
  "titleSuggestion": "H1に使うタイトル案（メインKWを自然に含む・60文字以内）",
  "h2Suggestions": ["記事のH2見出し候補1", "H2見出し候補2", "H2見出し候補3"],
  "metaDescriptionHint": "meta descriptionに含めるべきキーワードを3〜5個（配列）",
  "faqCandidates": ["FAQの質問候補1（実際の検索クエリから）", "FAQ候補2", "FAQ候補3", "FAQ候補4", "FAQ候補5"],
  "canonicalizationRisk": "カニバリゼーション懸念があるキーワード（なければ空文字）",
  "notes": "記事を書く上での重要な注意点（1〜2文）"
}`;

const res = await client.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 1000,
  messages:   [{ role: 'user', content: prompt }],
});

let analysis = {};
try {
  const text = res.content[0].text.trim().replace(/^```json?\s*/m, '').replace(/\s*```$/m, '');
  analysis = JSON.parse(text);
} catch (e) {
  console.warn('⚠️  Claude応答のパースに失敗。空の分析で続行します。');
  analysis = {};
}

// ── 結果保存 ─────────────────────────────────────────────────
function saveResult(claudeAnalysis) {
  const out = {
    slug,
    seedKeyword: seed,
    createdAt: new Date().toISOString().slice(0, 10),
    mainKeyword: {
      keyword:   mainKw.keyword,
      searches:  mainKw.searches,
      difficulty: mainKw.difficulty,
    },
    byType: {
      recommend:  byType.recommend.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
      comparison: byType.comparison.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
      anxiety:    byType.anxiety.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
      howto:      byType.howto.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
      info:       byType.info.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
      model:      byType.model.map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
    },
    topKeywords: unique.slice(0, 30).map(r => ({ keyword: r.keyword, searches: r.searches, difficulty: r.difficulty })),
    ...(claudeAnalysis ?? {}),
  };

  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
}

saveResult(analysis);

// ── コンソール出力 ────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`📋 キーワード分析レポート: ${seed}`);
console.log('═'.repeat(60));
console.log(`メインKW   : ${analysis.mainKeyword ?? mainKw.keyword}`);
console.log(`検索意図   : ${analysis.searchIntentType ?? '—'} — ${analysis.searchIntentNote ?? '—'}`);
console.log(`タイトル案 : ${analysis.titleSuggestion ?? '—'}`);
console.log(`\nFAQ候補:`);
(analysis.faqCandidates ?? []).forEach((q, i) => console.log(`  Q${i + 1}: ${q}`));
console.log(`\n不安系KW (FAQネタ):`);
byType.anxiety.slice(0, 5).forEach(r => console.log(`  - ${r.keyword} (${r.searches.toLocaleString()})`));
console.log(`\n型番系KW (記事で触れるべきモデル):`);
byType.model.slice(0, 5).forEach(r => console.log(`  - ${r.keyword} (${r.searches.toLocaleString()})`));
if (analysis.canonicalizationRisk) {
  console.log(`\n⚠️  カニバリリスク: ${analysis.canonicalizationRisk}`);
}
if (analysis.notes) {
  console.log(`\n📝 注意点: ${analysis.notes}`);
}
console.log('═'.repeat(60));
console.log(`\n✅ 保存完了: ${outPath}`);
console.log('次のステップ: node scripts/step1-plan.mjs ' + slug + '\n');
