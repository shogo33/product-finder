/**
 * add-section.mjs
 * 既存記事にサブキーワード対応セクションを追記する
 * 使い方: node scripts/add-section.mjs <slug> "<サブキーワード>" [before-faq|before-voice|"<カスタム文字列>"]
 *
 * 例:
 *   node scripts/add-section.mjs gamesir-controller-osusume "GameSir ホールエフェクト コントローラー"
 *   node scripts/add-section.mjs ugreen-mouse-osusume "UGREEN マウス 静音" before-voice
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const slug          = process.argv[2];
const subKeyword    = process.argv[3];
const insertionMode = process.argv[4] || 'before-faq';

if (!slug || !subKeyword) {
  console.error('使い方: node scripts/add-section.mjs <slug> "<サブキーワード>" [before-faq|before-voice|"<カスタム文字列>"]');
  process.exit(1);
}

const htmlPath = path.resolve(`public/basics/${slug}.html`);
if (!fs.existsSync(htmlPath)) {
  console.error(`❌ 記事が見つかりません: ${htmlPath}`);
  process.exit(1);
}

// ── コンテキスト抽出 ──────────────────────────────────────
function extractContext(html) {
  const title    = (html.match(/property="og:title"\s+content="([^"]+)"/)    || [])[1] || '';
  const desc     = (html.match(/property="og:description"\s+content="([^"]+)"/) || [])[1] || '';
  const keywords = (html.match(/name="keywords"\s+content="([^"]+)"/)        || [])[1] || '';
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
  return { title, desc, keywords, h2s };
}

// ── 挿入位置を決定 ───────────────────────────────────────
function findInsertionIndex(html, mode) {
  if (mode === 'before-faq') {
    const idx = html.indexOf('<h2 id="faq"');
    if (idx !== -1) return idx;
    // フォールバック: FAQ系テキスト
    const idx2 = html.indexOf('よくある質問');
    const tagStart = idx2 !== -1 ? html.lastIndexOf('<h2', idx2) : -1;
    if (tagStart !== -1) return tagStart;
  }

  if (mode === 'before-voice') {
    const idx = html.indexOf('<!-- VOICE-START -->');
    if (idx !== -1) return idx;
  }

  // カスタム文字列
  const idx = html.indexOf(mode);
  if (idx !== -1) return idx;

  // 最終フォールバック: </main> の直前
  const mainEnd = html.indexOf('</main>');
  if (mainEnd !== -1) return mainEnd;

  console.warn('⚠️  挿入位置が見つからなかったためファイル末尾近くに追記します');
  return html.length;
}

// ── keywords メタ更新 ────────────────────────────────────
function updateKeywordsMeta(html, newKw) {
  const m = html.match(/(<meta name="keywords" content=")([^"]*)(")/);
  if (!m) return html;
  if (m[2].includes(newKw)) return html; // 既にある
  const updated = m[2] ? `${m[2]}, ${newKw}` : newKw;
  return html.replace(m[0], `${m[1]}${updated}${m[3]}`);
}

// ── Claude でセクション生成 ──────────────────────────────
async function generateSection(ctx, subKw) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000 });

  const prompt = `あなたは以下の記事の執筆者です。この記事に新しいセクションを1つ追加します。

【記事情報】
タイトル: ${ctx.title}
概要: ${ctx.desc}
既存のH2見出し一覧:
${ctx.h2s.map(h => `  - ${h}`).join('\n')}

【追加するサブキーワード】
${subKw}

【出力ルール】
- HTMLのみ出力（コードブロック・説明文は一切不要）
- 構造: <h2>見出し</h2> + <p>本文</p> × 2〜3段落
- 合計文字数: 300〜500文字程度
- 見出しにサブキーワードを自然に含める
- 既存記事の文体・トーン・熱量に合わせる
- 既存H2の内容と重複しないこと
- 広告的な誇張・根拠のない断言は避ける
- クラス名・style属性は不要（プレーンな <h2><p> タグのみ）`;

  console.log(`\n✍️  「${subKw}」セクション生成中...`);

  let result = '';
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      result += chunk.delta.text;
      process.stdout.write('.');
    }
  }
  console.log(' done');

  // コードフェンスが混入していた場合は除去
  return result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
}

// ── メイン ───────────────────────────────────────────────
let html = fs.readFileSync(htmlPath, 'utf8');
const ctx = extractContext(html);

console.log(`\n📄 記事  : ${ctx.title}`);
console.log(`🎯 サブKW: ${subKeyword}`);
console.log(`📍 挿入  : ${insertionMode}`);

const section = await generateSection(ctx, subKeyword);
const insertAt = findInsertionIndex(html, insertionMode);

html = html.slice(0, insertAt) + '\n\n' + section + '\n\n' + html.slice(insertAt);
html = updateKeywordsMeta(html, subKeyword);

fs.writeFileSync(htmlPath, html, 'utf8');

console.log(`\n✅ 保存: ${htmlPath}`);
console.log(`📝 keywordsメタ更新済み`);
console.log(`\n生成されたセクション:\n${'─'.repeat(60)}`);
console.log(section);
console.log('─'.repeat(60));
console.log(`\n▶ 確認後: npm run gen-all`);
