/**
 * step1-title-meta.mjs
 * タイトル5案 + metaタグ（description / keywords / OGP）を確定する
 *
 * 使い方: node scripts/step1-title-meta.mjs <slug>
 * 例:    node scripts/step1-title-meta.mjs gamesir-t4-pro-osusume
 *
 * 入力:  data/articles/{slug}-plan.json
 *        data/articles/{slug}-kw.json（あれば）
 * 出力:  data/articles/{slug}-meta.json
 *
 * 処理内容:
 *   1. plan.json の selectedTitle / metaDescription を参照
 *   2. kw.json のメインKW・サブKW・タイトルヒントを参照
 *   3. Claude Sonnet でタイトル5案 + metaタグを生成
 *   4. コンソールに5案を出力 → ユーザーが選択（または後から手動で変更可）
 *   5. {slug}-meta.json として保存
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');
const DOMAIN       = 'https://aliswipe.com';

const args = process.argv.slice(2);
const slug = args[0];

if (!slug) {
  console.error('使い方: node scripts/step1-title-meta.mjs <slug>');
  process.exit(1);
}

const planPath = path.join(ARTICLES_DIR, `${slug}-plan.json`);
if (!fs.existsSync(planPath)) {
  console.error(`❌ plan.json が見つかりません: ${planPath}`);
  console.error('   step1-plan.mjs を先に実行してください。');
  process.exit(1);
}

const outPath = path.join(ARTICLES_DIR, `${slug}-meta.json`);
if (fs.existsSync(outPath) && !args.includes('--force')) {
  console.log(`⚠️  既に存在します: ${outPath}`);
  console.log('   上書きする場合は --force を付けて再実行してください。');

  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  console.log(`\n📌 現在の設定:`);
  console.log(`   selectedTitle: "${existing.selectedTitle}"`);
  console.log(`   metaDescription: "${existing.metaDescription}"`);
  process.exit(0);
}

const plan    = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const kwPath  = path.join(ARTICLES_DIR, `${slug}-kw.json`);
const kw      = fs.existsSync(kwPath) ? JSON.parse(fs.readFileSync(kwPath, 'utf8')) : null;
const category = plan.category ?? 'gadget';
const today   = new Date().toISOString().slice(0, 10);

console.log(`\n📝 「${plan.keyword}」のタイトル・metaタグを生成中...\n`);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

// ── Claudeへのプロンプト構築 ─────────────────────────────────
const mainKwList = kw?.mainKws?.map(k => `${k.keyword}（月間:${k.volume ?? 'N/A'}）`).join(', ') ?? plan.keyword;
const subKwList  = kw?.subKws?.map(k => k.keyword).join(', ') ?? '';
const titleHints = kw?.titleHints?.join('\n  ') ?? '';
const searchIntent = kw?.searchIntent ?? plan.searchIntent ?? '';
const intentNote   = kw?.intentNote   ?? plan.searchIntentNote ?? '';

const systemPrompt = `あなたは日本語SEOタイトルとmeta情報の専門家です。
検索意図に即したタイトル・metaを作成します。
JSONのみ返してください。コードブロックや説明文は不要です。`;

const userPrompt = `以下の情報をもとに、タイトル5案とmeta情報を生成してください。

## 基本情報
- キーワード: ${plan.keyword}
- スラッグ: ${slug}
- カテゴリ: ${category}
- 検索意図: ${searchIntent} — ${intentNote}
- 現在のタイトル案: ${plan.selectedTitle}
- 現在のmeta description: ${plan.metaDescription ?? 'なし'}

## キーワードデータ
- メインKW: ${mainKwList}
- サブKW: ${subKwList}
${titleHints ? `- タイトルヒント:\n  ${titleHints}` : ''}

## 記事の構成概要
${plan.sections?.map(s => `- [${s.type}] ${s.h2}`).join('\n') ?? 'なし'}

---

以下のJSON形式で出力してください：

{
  "titleCandidates": [
    {
      "title": "タイトル案1（32文字以内）",
      "chars": 文字数,
      "reason": "このタイトルが良い理由（1文）",
      "intent": "対象ユーザーの意図"
    },
    ... (5案)
  ],
  "selectedTitle": "titleCandidatesの0番目と同じ値",
  "metaDescription": "120〜150文字。メインKWを自然に含む。CTA的フレーズで終わる。",
  "metaKeywords": ["メインKW", "サブKW1", "サブKW2", "AliExpress", "アリエク"],
  "ogTitle": "OGPタイトル（SNSシェア時。40文字以内）",
  "ogDescription": "OGP説明（SNSシェア時。80〜100文字）",
  "h1Suggestion": "本文のH1タグ候補（selectedTitleと同じか微調整）",
  "breadcrumbName": "パンくずリストの表示名（15文字以内）"
}

## タイトル作成ルール（必須）
- 32文字以内（厳守）
- 「2026年最新」を乱用しない（必要な場合のみ1案に使用）
- 「コスパ最強」「圧倒的」「神」は禁止
- 用途・悩み・比較対象をタイトルに含める
- 5案は性質を変える（おすすめ系・比較系・用途系・評判系・問題解決系など）
- metaDescriptionはメインKWを自然に含み、クリックしたくなる文末で終わる`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model:      'claude-sonnet-4-6',
  max_tokens: 2000,
  system:     systemPrompt,
  messages:   [{ role: 'user', content: userPrompt }],
});

let meta;
try {
  const raw = response.content[0].text.trim()
    .replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  meta = JSON.parse(raw);
} catch (e) {
  console.error('❌ Claude出力のJSONパースに失敗しました');
  console.error(response.content[0].text);
  process.exit(1);
}

// ── 保存 ────────────────────────────────────────────────────
const canonUrl = `${DOMAIN}/${category}/${slug}.html`;
const output = {
  slug,
  keyword:        plan.keyword,
  category,
  generatedAt:    today,
  selectedTitle:  meta.selectedTitle,
  metaDescription: meta.metaDescription,
  metaKeywords:   meta.metaKeywords,
  ogTitle:        meta.ogTitle,
  ogDescription:  meta.ogDescription,
  canonUrl,
  h1Suggestion:   meta.h1Suggestion,
  breadcrumbName: meta.breadcrumbName,
  titleCandidates: meta.titleCandidates,
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

// ── コンソール出力 ───────────────────────────────────────────
console.log('━'.repeat(60));
console.log(`✅ meta.json 保存: ${outPath}\n`);
console.log('📋 タイトル5案（0番目が selectedTitle）:\n');
(meta.titleCandidates ?? []).forEach((c, i) => {
  const selected = i === 0 ? ' ← selected' : '';
  console.log(`  [${i + 1}] ${c.title}（${c.chars}文字）${selected}`);
  console.log(`      → ${c.reason}`);
});
console.log(`\n📄 metaDescription（${meta.metaDescription?.length ?? 0}文字）:`);
console.log(`  ${meta.metaDescription}`);
console.log(`\n🔑 metaKeywords: ${(meta.metaKeywords ?? []).join(' / ')}`);
console.log(`\n🔗 canonical: ${canonUrl}`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 タイトルを変更したい場合:
   ${outPath} を開いて "selectedTitle" を手動で変更してください。
   または --force で再生成できます。

▶ 次: node scripts/step2-research.mjs ${slug}
   （research済みなら）node scripts/step2-verify.mjs ${slug}
`);
