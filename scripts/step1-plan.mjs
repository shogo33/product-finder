/**
 * Step 1: SEOキーワードから記事構成案（H2/H3）を生成
 * 使い方: node scripts/step1-plan.mjs "キーワード" <slug> [カテゴリ=gadget]
 * 例:    node scripts/step1-plan.mjs "Baseus モバイルバッテリー おすすめ" baseus-mobile-battery-osusume2 basics
 * 出力:  data/articles/{slug}-plan.json
 *
 * カテゴリ一覧: gadget / game / outdoor / guide / safety / payment / shipping
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const ARTICLES_DIR = path.resolve('data/articles');
fs.mkdirSync(ARTICLES_DIR, { recursive: true });

// ── CLI引数 ──────────────────────────────────────────────
const args    = process.argv.slice(2);
const keyword = args[0];
const slug    = args[1];
const category = args[2] ?? 'gadget';

if (!keyword || !slug) {
  console.error('使い方: node scripts/step1-plan.mjs "キーワード" <slug> [カテゴリ=basics]');
  console.error('例:    node scripts/step1-plan.mjs "UGREEN マウス おすすめ" ugreen-mouse-osusume2 gadget
  process.exit(1);
}

const outPath = path.join(ARTICLES_DIR, `${slug}-plan.json`);

if (fs.existsSync(outPath) && !args.includes('--force')) {
  console.log(`⚠️  構成案が既に存在します: ${outPath}`);
  console.log('   上書きする場合は --force を付けて再実行してください。');
  process.exit(0);
}

if (!CLAUDE_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が .env に設定されていません');
  process.exit(1);
}

console.log(`\n📝 「${keyword}」の記事構成案を生成中...\n`);

// ── 既存の内部リンク候補を収集 ──────────────────────────
const publicDir = path.resolve('public');
const knownPages = [];
function collectPages(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { collectPages(full); continue; }
    if (!e.name.endsWith('.html')) continue;
    const rel = '/' + path.relative(publicDir, full).replace(/\\/g, '/');
    const html = fs.readFileSync(full, 'utf8');
    const m = html.match(/<title>([\s\S]*?)<\/title>/);
    if (m) knownPages.push({ url: rel, title: m[1].replace(/ \| アリエクswipe.*$/, '').trim() });
  }
}
try { collectPages(publicDir); } catch {}
const pageListText = knownPages.slice(0, 20)
  .map(p => `  ${p.url}  →  ${p.title}`)
  .join('\n');

// ── Claude Sonnet で構成案生成 ────────────────────────────
const client = new Anthropic({ apiKey: CLAUDE_KEY });

const systemPrompt = `あなたは日本のAliExpressアフィリエイトサイト「アリエクswipe（aliswipe.com）」のSEOコンテンツ戦略家です。
検索意図を深く分析し、競合を上回る記事構成を設計します。
必ずJSONのみを返してください。マークダウンのコードブロック記法（\`\`\`）や説明文は不要です。`;

const userPrompt = `以下のキーワードで記事構成案をJSONで生成してください。

キーワード: ${keyword}
スラッグ: ${slug}
カテゴリ（ディレクトリ）: ${category}
対象サイト: AliExpressアフィリエイト記事（日本語・モバイルファースト）

【サイト内の既存ページ（内部リンク候補）】
${pageListText}

---

以下の構造でJSONを出力してください：

{
  "keyword": "${keyword}",
  "slug": "${slug}",
  "category": "${category}",
  "searchIntent": "おすすめ系|比較系|レビュー系|入門系|問題解決系",
  "searchIntentNote": "検索意図の詳細（1〜2文）",
  "persona": "この記事を書く書き手の人格設定（例：「AliExpressを使い倒している節約オタクで、スペックの細かい差異に異常に詳しい。読者に対して熱量高く語りかける」）。キーワードと検索意図から最も共感されやすい人物像を設定する。1〜2文で記述。",
  "targetProductCount": 3〜7の整数,
  "titles": [
    "SEOタイトル案1（32文字以内・年号【2026年最新】を含む）",
    "SEOタイトル案2（32文字以内）",
    "SEOタイトル案3（32文字以内）"
  ],
  "selectedTitle": "titles配列の0番目を設定",
  "metaDescription": "120〜150文字。キーワード自然含有・CTA的フレーズで終わる",
  "intro": "PREP法で書いた導入文200〜300文字。検索ユーザーの悩みへの共感から始める",
  "sections": [
    {
      "id": "section1",
      "h2": "H2見出し（主キーワードを自然に含む）",
      "h3s": ["H3見出し1", "H3見出し2"],
      "type": "brand_overview|product|comparison|howto|faq|conclusion",
      "notes": "このセクションで書くべき内容メモ（箇条書き2〜3点）"
    }
  ],
  "faqQuestions": [
    "よくある質問1（検索クエリ形式）",
    "よくある質問2",
    "よくある質問3",
    "よくある質問4",
    "よくある質問5"
  ],
  "comparisonTableColumns": ["モデル名", "価格（円）", "その他スペック列（合計4〜6列）"],
  "internalLinks": [
    {"url": "/basics/aliexpress-what-is.html", "anchorText": "AliExpressとは"}
  ],
  "competitorDifferentiators": [
    "競合との差別化ポイント1",
    "競合との差別化ポイント2"
  ],
  "createdAt": "${new Date().toISOString().slice(0, 10)}"
}

【必須ルール】
- sections は 6〜9個（ブランド概要1＋商品紹介${3}〜${7}個＋比較表1＋選び方1＋FAQ1＋まとめ1）
- 商品紹介は1商品につき1 section（type: "product"）
- faqQuestions は必ず5個
- comparisonTableColumns は価格・スペック・特徴など4〜6列
- internalLinks はサイト内既存ページから2〜4個を自然な文脈で選ぶ
- JSONのみ返す`;

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
});

const raw = response.content[0].text.trim();

// コードブロックが含まれていた場合の対処
let plan;
try {
  const jsonText = raw.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
  plan = JSON.parse(jsonText);
} catch {
  console.error('❌ JSONパースエラー。生出力:');
  console.error(raw);
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(plan, null, 2), 'utf8');

console.log(`✅ 構成案を保存しました: ${outPath}\n`);
console.log(`📋 プレビュー`);
console.log(`   検索意図 : ${plan.searchIntent} — ${plan.searchIntentNote}`);
console.log(`   推奨商品数: ${plan.targetProductCount}`);
console.log(`   タイトル候補:`);
plan.titles.forEach((t, i) => console.log(`     ${i + 1}. ${t}`));
console.log(`   セクション: ${plan.sections.map(s => s.h2).join(' / ')}`);
console.log(`   FAQ       : ${plan.faqQuestions.length}件`);
console.log(`\n▶ 次: node scripts/step2-research.mjs ${slug}`);
