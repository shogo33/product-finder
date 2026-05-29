/**
 * step4-content-check.mjs
 * 記事ルール準拠チェック（CLAUDE.mdのガイドライン）
 *
 * 使い方: node scripts/step4-content-check.mjs <slug>
 * 問題があれば exit 1 で停止
 *
 * チェック内容（Layer 1: コンテンツ品質）:
 *   [CRITICAL] 結論ブロックが冒頭にあるか
 *   [CRITICAL] こんな人向けブロックあるか
 *   [CRITICAL] FAQセクションあるか
 *   [CRITICAL] Reddit声またはVOICEブロックあるか
 *   [CRITICAL] 禁止表現が使われていないか
 *   [WARNING]  比較表が前半にあるか（全体の60%以内）
 *   [WARNING]  デメリット・注意点の記述があるか
 *   [WARNING]  本文中の内部リンクが3件以上あるか
 *   [WARNING]  Amazonレビュー傾向の記述があるか
 *   [AI]       ペルソナの熱量チェック（Claude Haiku）
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step4-content-check.mjs <slug>');
  process.exit(1);
}

const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const plan         = fs.existsSync(planPath)     ? JSON.parse(fs.readFileSync(planPath, 'utf8'))     : {};
const category     = plan.category ?? 'gadget';
const htmlPath     = path.resolve('public', category, `${slug}.html`);

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ HTMLが見つかりません: ${htmlPath}`);
  console.error('   step3d-assemble.mjs を先に実行してください。');
  process.exit(1);
}

const html     = fs.readFileSync(htmlPath, 'utf8');
const research = fs.existsSync(researchPath) ? JSON.parse(fs.readFileSync(researchPath, 'utf8')) : {};
const products = research.products ?? [];

console.log(`\n📋 step4-content-check: ${slug}\n`);

const criticals = [];
const warnings  = [];

// ── 1. 結論ブロック ───────────────────────────────────────────
const hasConclusion = /class="article-conclusion"/.test(html) || /class="conclusion"/.test(html);
if (!hasConclusion) {
  criticals.push('[結論ブロック] article-conclusionクラスのブロックが見つかりません\n  → step3c-meta.mjs を再実行してください');
}

// ── 2. こんな人向け ───────────────────────────────────────────
const hasForWho = /class="for-who"/.test(html) || /こんな人向け/.test(html) || /こんな方向け/.test(html);
if (!hasForWho) {
  criticals.push('[こんな人向け] for-whoブロックが見つかりません\n  → step3c-meta.mjs を再実行してください');
}

// ── 3. FAQ ─────────────────────────────────────────────────────
const hasFaq = /class="faq/.test(html) || /よくある質問/.test(html) || /FAQ/.test(html);
if (!hasFaq) {
  criticals.push('[FAQ] FAQセクションが見つかりません\n  → step3c-meta.mjs を再実行してください');
}

// ── 4. Reddit声 ───────────────────────────────────────────────
const hasVoice = /reddit-quote/.test(html) || /reddit-voices/.test(html) || /VOICE-START/.test(html);
if (!hasVoice) {
  criticals.push('[Reddit声] reddit-quoteまたはVOICEブロックが見つかりません\n  → step3b-write.mjs または gen-voices.mjs を実行してください');
}

// ── 5. 禁止表現 ───────────────────────────────────────────────
const BANNED = [
  'コスパ最強', '圧倒的', '革命的', '非常に優秀', '快適',
  '誰にでもおすすめ', 'に定評があります', 'の一品です',
  '使いました', '実際に試しました',
];
// <style>/<script>タグ内は除外してチェック
const bodyText = html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '');

const foundBanned = BANNED.filter(w => bodyText.includes(w));
if (foundBanned.length > 0) {
  criticals.push(`[禁止表現] 以下の禁止表現が使われています: ${foundBanned.join('、')}\n  → 該当箇所を「〜という声が多い」「〜用途なら十分」等に書き換えてください`);
}

// ── 5b. 未置換プレースホルダー検出（組み立て漏れ） ────────────────
// VOICE-START は gen-voices 待ちなので除外。AMAZON_PENDING も意図的。
// VOICE-START/END は gen-voices 待ち、AMAZON_PENDING はAmazon確認待ち → 正常
const EXPECTED_PLACEHOLDERS = ['VOICE-START', 'VOICE-END', 'AMAZON_PENDING', 'Amazonおすすめ'];
const remainingMarkers = [...html.matchAll(/<!-- ([A-Z_][A-Z0-9_-]*(?:\s[^>]{0,60})?) -->/g)]
  .map(m => m[1].trim())
  .filter(m => !EXPECTED_PLACEHOLDERS.some(ex => m.startsWith(ex)));
if (remainingMarkers.length > 0) {
  criticals.push(
    `[未置換プレースホルダー] ${remainingMarkers.length}件のプレースホルダーが残っています:\n` +
    remainingMarkers.slice(0, 6).map(m => `  <!-- ${m} -->`).join('\n') +
    (remainingMarkers.length > 6 ? `\n  ...他${remainingMarkers.length - 6}件` : '') +
    `\n  → step3c-meta.mjs / step3d-assemble.mjs が正常に完了しているか確認してください`
  );
}

// ── 6. 比較表セルの内容チェック（「-」だらけ検出） ──────────────
const tableCells = [...bodyText.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());
if (tableCells.length > 0) {
  const dashCells  = tableCells.filter(c => c === '-' || c === '–' || c === '').length;
  const dashRatio  = dashCells / tableCells.length;
  if (dashRatio > 0.5) {
    criticals.push(
      `[比較表が空] テーブルセルの${Math.round(dashRatio * 100)}%（${dashCells}/${tableCells.length}件）が「-」または空です\n` +
      `  → specResultがnullの場合に発生します。以下のいずれかを実施してください:\n` +
      `     1. step2-research.mjs を再実行してTavilyスペック取得を試みる\n` +
      `     2. plan.json の comparisonTableColumns を「モデル名/価格目安（円）/AliExpress/Amazon」のみに絞る\n` +
      `     3. step3c-meta.mjs を再実行（plan セクションメモからおすすめシーンを推測）`
    );
  } else if (dashRatio > 0.3) {
    warnings.push(
      `[比較表が薄い] テーブルセルの${Math.round(dashRatio * 100)}%（${dashCells}/${tableCells.length}件）が「-」です\n` +
      `  → specResultの欠落がある可能性があります`
    );
  }
}

// ── 6b. 比較表の位置（前半60%以内） ──────────────────────────
const tablePos   = html.indexOf('<table');
const totalLen   = html.length;
if (tablePos === -1) {
  warnings.push('[比較表] tableタグが見つかりません\n  → 比較表を追加してください');
} else if (tablePos / totalLen > 0.6) {
  warnings.push(`[比較表の位置] 比較表がページ後半（${Math.round(tablePos/totalLen*100)}%地点）にあります\n  → 冒頭付近（60%以内）に移動することを推奨します`);
}

// ── 7. デメリット記述 ─────────────────────────────────────────
const hasDemerit = /デメリット|注意点|欠点|弱点|惜しい|残念|発熱|重め|大きめ|遅い|初期不良|箱潰れ/.test(bodyText);
if (!hasDemerit) {
  warnings.push('[デメリット] デメリット・注意点の記述が見つかりません\n  → 各商品セクションに欠点・注意点を追加してください');
}

// ── 8. 内部リンク数 ──────────────────────────────────────────
// aliswipe.com ドメインまたは相対パスの内部リンクをカウント（関連記事セクション外）
const bodyWithoutRelated = bodyText.replace(/<div[^>]*class="related[\s\S]*?<\/div>/gi, '');
const internalLinks = [
  ...(bodyWithoutRelated.matchAll(/href="(\/[^"]+\.html|https:\/\/aliswipe\.com\/[^"]+)"/g))
].length;
if (internalLinks < 3) {
  warnings.push(`[内部リンク] 本文中の内部リンクが${internalLinks}件（推奨3件以上）\n  → 本文中に関連記事への自然なリンクを追加してください`);
}

// ── 9. Amazonレビュー傾向 ─────────────────────────────────────
const hasAmzReview = /という声が多い|という報告がある|Amazonレビューでは|Amazonでは/.test(bodyText);
if (!hasAmzReview) {
  warnings.push('[Amazonレビュー] Amazonレビュー傾向の記述が見つかりません\n  → step2-amazon-review.mjs でレビューを取得し、step3b-write.mjs で再生成してください');
}

// ── レポート出力（機械チェック） ─────────────────────────────
console.log('━'.repeat(60));
if (criticals.length === 0 && warnings.length === 0) {
  console.log('✅ 機械チェック：問題なし\n');
} else {
  if (criticals.length > 0) {
    console.log(`❌ CRITICAL（${criticals.length}件）`);
    criticals.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNING（${warnings.length}件）`);
    warnings.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
  }
}

// ── AI チェック（ペルソナ熱量・自然な語り口） ──────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\n⚠️  ANTHROPIC_API_KEY 未設定 — AIチェックをスキップ');
  process.exit(criticals.length > 0 ? 1 : 0);
}

console.log('\n━'.repeat(60));
console.log('🤖 Claude でコンテンツ品質チェック中...');

// HTMLから本文テキストを抽出（スタイル・スクリプト除去）
const textContent = html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, 6000);

const persona = plan.persona ?? '（ペルソナ未設定）';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 1000,
  system:     `あなたは記事品質チェッカーです。以下の観点で問題があれば指摘してください。問題がなければ「品質OK」とだけ出力。余計な前置きは不要。`,
  messages:   [{
    role: 'user',
    content: `## チェック観点
1. ペルソナの熱量: "${persona}" というペルソナで書かれているか。無難な「〜です・ます」調ではなく、そのジャンルが好きな人間が語りかけているか
2. AI構文: 「〜と言えるでしょう」「〜が魅力的です」「〜を検討してみてはいかがでしょうか」等のAI臭い表現がないか
3. 「想像とのズレ」の記述: 「写真より少し大きい」「思ったより発熱が少ない」等の現実感のある記述が1箇所以上あるか
4. 用途別の向き不向き: 「誰にでもおすすめ」ではなく、特定の用途・ユーザー層向けに書かれているか

## 記事テキスト（冒頭6000文字）
${textContent}

問題があれば番号付きリストで報告。問題がなければ「品質OK」とだけ出力。`,
  }],
});

const aiResult = response.content[0]?.text?.trim() ?? '';
console.log('\n' + '━'.repeat(60));
if (aiResult.includes('品質OK') || aiResult.length < 20) {
  console.log('✅ AIチェック：品質OK\n');
} else {
  console.log('⚠️  AIチェック：以下の点を改善してください:\n');
  console.log(aiResult);
  warnings.push('[AIチェック] 上記の品質改善を推奨します');
}

console.log('━'.repeat(60));

const hasCriticals = criticals.length > 0;
if (hasCriticals) {
  console.log(`\n❌ コンテンツチェック失敗: CRITICAL ${criticals.length}件 を修正してから次のステップへ進んでください\n`);
  process.exit(1);
} else {
  console.log(`\n✅ コンテンツチェック通過（WARNING ${warnings.length}件）`);
  console.log(`▶ 次: node scripts/step4-seo-check.mjs ${slug}\n`);
  process.exit(0);
}
