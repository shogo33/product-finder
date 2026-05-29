/**
 * Step 3b: 記事ファクトチェック
 * 使い方: node scripts/step3-factcheck.mjs <slug>
 * 例:    node scripts/step3-factcheck.mjs haylou-osusume
 *
 * 入力:  public/{category}/{slug}.html
 *        data/articles/{slug}-research.json
 *        data/articles/{slug}-plan.json
 * 出力:  問題リストをコンソール出力。問題があれば exit 1
 *
 * チェック内容:
 *   [機械的] img alt が自セクションの商品名を含んでいるか
 *   [機械的] 比較表の行数が research.products 件数と一致するか
 *   [Claude] 商品スペックの内部矛盾・Q&A不一致・クロス混線
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step3-factcheck.mjs <slug>');
  process.exit(1);
}

const ARTICLES_DIR = path.resolve('data/articles');
const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);

if (!fs.existsSync(researchPath)) {
  console.error(`❌ research JSON が見つかりません: ${researchPath}`);
  process.exit(1);
}

const plan     = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : {};
const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const category = plan.category ?? 'gadget';
const htmlPath = path.resolve('public', category, `${slug}.html`);

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ HTMLが見つかりません: ${htmlPath}`);
  console.error('   step3-write.mjs を先に実行してください。');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const products = research.products ?? [];

console.log(`\n🔍 ファクトチェック開始: ${slug} (商品${products.length}件)\n`);

// ── 1. 機械的チェック ──────────────────────────────────────────
const mechanicalIssues = [];

// 1a. 商品セクションごとのalt属性チェック
// @product-start id="..." から次の @product-end までの範囲を抽出
const sectionPattern = /<!-- @product-start id="([^"]+)"[^>]*-->([\s\S]*?)<!-- @product-end -->/g;
let match;
while ((match = sectionPattern.exec(html)) !== null) {
  const sectionId   = match[1];
  const sectionHtml = match[2];

  // この商品IDに対応する cleanName を探す
  const product = products.find(p => String(p.product_id) === String(sectionId));
  // ID が数値でない（s30pro 等）の場合はインデックス順で対応付け
  const sectionIndex = [...html.matchAll(/<!-- @product-start/g)].findIndex(m => m.index === match.index - (match[0].length - match[0].length));

  const productName = product?.cleanName ?? null;
  if (!productName) continue;

  // alt属性を全部抽出
  const altMatches = [...sectionHtml.matchAll(/alt="([^"]*)"/g)];
  for (const altMatch of altMatches) {
    const altText = altMatch[1];
    if (!altText) continue;
    // 空または別商品名（他の商品名が含まれているか）を検出
    const otherProducts = products.filter(p => p.cleanName !== productName);
    for (const other of otherProducts) {
      // 名前の主要部分（最初の単語＋型番）が別商品のものになっていないか
      const otherShort = other.cleanName.split(/[\s　]/)[0];
      if (altText.includes(other.cleanName) && !altText.includes(productName)) {
        mechanicalIssues.push(
          `[alt属性] 商品「${productName}」のセクション内に別商品「${other.cleanName}」のalt属性 → alt="${altText}"`
        );
      }
    }
  }
}

// 1b. 比較表の行数チェック（最大行数のtbodyを対象にすることでバッテリー表等の小テーブルを除外）
const allTbodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
if (allTbodies.length > 0) {
  const maxTbody = allTbodies.reduce((best, m) => {
    const count = (m[1].match(/<tr[\s>]/g) ?? []).length;
    const bestCount = (best[1].match(/<tr[\s>]/g) ?? []).length;
    return count > bestCount ? m : best;
  });
  const rows = (maxTbody[1].match(/<tr[\s>]/g) ?? []).length;
  if (rows !== products.length) {
    mechanicalIssues.push(
      `[比較表] research.products は ${products.length} 件だが、メイン比較表の行数が ${rows} 件 → 商品の過不足がある可能性`
    );
  }
}

// 1c. アフィリエイトリンクの重複チェック
const aliLinks = [...html.matchAll(/href="(https:\/\/s\.click\.aliexpress\.com[^"]+)"/g)].map(m => m[1]);
const uniqueLinks = new Set(aliLinks);
if (aliLinks.length > 1 && uniqueLinks.size < aliLinks.length) {
  mechanicalIssues.push(
    `[リンク重複] AliExpressアフィリエイトリンクに重複あり (${aliLinks.length}件中${uniqueLinks.size}件がユニーク) → research.jsonを確認`
  );
}

if (mechanicalIssues.length > 0) {
  console.log('━'.repeat(60));
  console.log('⚠️  【機械的チェック】問題あり');
  console.log('━'.repeat(60));
  mechanicalIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  console.log('');
} else {
  console.log('✅ 機械的チェック：問題なし\n');
}

// ── 2. Claude による矛盾検出 ──────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY がないため Claude チェックをスキップ');
  process.exit(mechanicalIssues.length > 0 ? 1 : 0);
}

// HTMLを要約（本文テキストのみ抽出）
// <style>/<script> を除去してトークンを節約
const strippedHtml = html
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, 18000); // 長すぎる場合は先頭18000文字

// research からスペックサマリーを作成
const specSummary = products.map(p => {
  const spec = p.specResult?.content?.slice(0, 600) ?? 'スペック情報なし';
  return `【${p.cleanName}】\n  価格: ¥${Number(p.price_jpy).toLocaleString('ja-JP')}\n  公式スペック: ${spec}`;
}).join('\n\n');

const FACTCHECK_SYSTEM = `あなたは記事の内部矛盾を検出するファクトチェッカーです。
ユーザーから「記事テキスト」と「商品の正式スペックデータ」が渡されます。
以下の観点で矛盾・誤りを検出し、番号付きリストで日本語報告してください。

## チェック観点
1. 同一商品の同一スペック（ANC有無・コーデック・バッテリー・マルチポイント等）が記事内の複数箇所で矛盾していないか
2. 比較表・仕様リスト・本文説明・「こんな人向け」・FAQの間でスペックの食い違いがないか
3. FAQの質問と回答が全く別のトピックを答えていないか（質問「iPhoneで使えますか」→回答「日本語表示に対応」など）
4. ある商品のスペック（例：LDAC）が別商品のセクションに誤記されていないか
5. アプリ名・ブランド名・モデル名などの固有名詞が記事内で統一されているか
6. 価格・バッテリー時間などの数値が記事内の複数箇所で矛盾していないか

## 出力形式
問題が見つかった場合: 番号付きリストで各問題を報告。各項目に「どこで」「何が」「なぜ問題か」「修正案」を含める。
問題がなかった場合: 「矛盾なし」とだけ出力する。

余計な前置きや「以下に〜」などの導入文は不要。問題リストまたは「矛盾なし」だけ出力。`;

const FACTCHECK_USER = `## 記事テキスト（HTMLタグ除去済み）
${strippedHtml}

---

## 商品の正式スペックデータ（AliExpress + Tavily取得）
${specSummary}`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000 });

console.log('🤖 Claude による矛盾チェック中...');
const response = await client.messages.create({
  model:      'claude-haiku-4-5-20251001',
  max_tokens: 2000,
  system:     FACTCHECK_SYSTEM,
  messages:   [{ role: 'user', content: FACTCHECK_USER }],
});

const claudeResult = response.content[0]?.text?.trim() ?? '';

console.log('\n━'.repeat(60));
if (claudeResult === '矛盾なし' || claudeResult.includes('矛盾なし')) {
  console.log('✅ Claude チェック：矛盾なし');
} else {
  console.log('⚠️  【Claude チェック】検出された問題：');
  console.log('━'.repeat(60));
  console.log(claudeResult);
}
console.log('━'.repeat(60));

const hasIssues = mechanicalIssues.length > 0 || (!claudeResult.includes('矛盾なし') && claudeResult.length > 10);

if (hasIssues) {
  console.log('\n❌ ファクトチェック完了：問題あり → 修正してから公開してください\n');
  process.exit(1);
} else {
  console.log('\n✅ ファクトチェック完了：問題なし\n');
  process.exit(0);
}
