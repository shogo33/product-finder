/**
 * step4-affiliate-check.mjs
 * アフィリエイト品質チェック（Layer 3）
 *
 * 使い方: node scripts/step4-affiliate-check.mjs <slug>
 * 問題があれば exit 1 で停止
 *
 * チェック内容:
 *   [CRITICAL] 全商品に AliExpress CTAボタンがあるか
 *   [CRITICAL] アフィリエイトリンクに rel="sponsored" があるか
 *   [CRITICAL] AliExpressリンクが正しいドメイン（s.click.aliexpress.com）か
 *   [CRITICAL] 商品数と @product-start マーカー数が一致するか
 *   [WARNING]  全商品に Amazon CTAがあるか（PENDINGも含めて存在するか）
 *   [WARNING]  disabled/pointer-events:none リンクが多すぎないか
 *   [WARNING]  AliExpressリンクの重複がないか
 */

import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step4-affiliate-check.mjs <slug>');
  process.exit(1);
}

const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const plan         = fs.existsSync(planPath)     ? JSON.parse(fs.readFileSync(planPath,     'utf8')) : {};
const research     = fs.existsSync(researchPath) ? JSON.parse(fs.readFileSync(researchPath, 'utf8')) : {};
const category     = plan.category ?? 'gadget';
const htmlPath     = path.resolve('public', category, `${slug}.html`);

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ HTMLが見つかりません: ${htmlPath}`);
  process.exit(1);
}

const html     = fs.readFileSync(htmlPath, 'utf8');
const products = research.products ?? [];

console.log(`\n💰 step4-affiliate-check: ${slug}\n`);

const criticals = [];
const warnings  = [];

// ── 1. @product-start マーカーの数 ───────────────────────────
const productMarkers = [...html.matchAll(/<!-- @product-start id="([^"]+)"/g)].map(m => m[1]);
if (products.length > 0 && productMarkers.length !== products.length) {
  criticals.push(
    `[商品数不一致] research.jsonは${products.length}件、HTMLのproduct-startマーカーは${productMarkers.length}件\n` +
    `  → step3d-assemble.mjs を再実行してください`
  );
}

// ── 2. AliExpressアフィリエイトリンク ────────────────────────
const aliLinks = [...html.matchAll(/href="(https:\/\/s\.click\.aliexpress\.com[^"]*)"/g)].map(m => m[1]);
const intentionalDupes = research.intentionalDuplicateAffLink ?? false;

if (aliLinks.length === 0) {
  criticals.push('[AliExリンク] s.click.aliexpress.comへのリンクが1件もありません\n  → research.jsonのaffiliateLinkを確認してください');
} else if (products.length > 0 && aliLinks.length < products.length) {
  criticals.push(
    `[AliExリンク不足] ${products.length}商品に対してAliExリンクが${aliLinks.length}件しかありません\n` +
    `  → step2-verify.mjs を実行してアフィリリンクを確認してください`
  );
}

// rel="sponsored" チェック
const aliLinksWithoutSponsored = [...html.matchAll(/href="https:\/\/s\.click\.aliexpress\.com[^"]*"[^>]*>/g)]
  .filter(m => !m[0].includes('sponsored'));
if (aliLinksWithoutSponsored.length > 0) {
  criticals.push(
    `[rel=sponsored] ${aliLinksWithoutSponsored.length}件のAliExリンクに rel="sponsored" がありません\n` +
    `  → Google広告ポリシー対応のため必須です`
  );
}

// AliExリンク重複チェック
const uniqueAli = new Set(aliLinks);
if (aliLinks.length > 1 && uniqueAli.size < aliLinks.length) {
  const dupCount = aliLinks.length - uniqueAli.size;
  if (intentionalDupes) {
    warnings.push(
      `[リンク重複・意図的] AliExリンクに${dupCount}件の重複 (research.jsonのintentionalDuplicateAffLink=trueで確認済み)\n` +
      `  理由: ${research.intentionalDuplicateNote ?? '同一ページ販売'}`
    );
  } else {
    criticals.push(
      `[リンク重複] AliExリンクに${dupCount}件の重複があります\n` +
      `  → step2-verify.mjs を実行してresearch.jsonを確認してください`
    );
  }
}

// ── 3. cta-box の存在確認 ─────────────────────────────────────
const ctaBoxes = [...html.matchAll(/class="cta-box"/g)].length;
if (products.length > 0 && ctaBoxes < products.length) {
  criticals.push(
    `[CTAボックス] ${products.length}商品に対してcta-boxが${ctaBoxes}個しかありません\n` +
    `  → step3d-assemble.mjs を再実行してください`
  );
}

// ── 4. Amazonリンクの状態確認 ────────────────────────────────
const amazonPending   = [...html.matchAll(/<!-- AMAZON_PENDING:/g)].length;
// class・href の順序を問わず検出
const amazonLive      = [...html.matchAll(/class="cta-btn-amazon"[^>]*href="https?:\/\/(amzn\.|www\.amazon\.|amazon\.)[^"]+"/g)].length
                      + [...html.matchAll(/href="https?:\/\/(amzn\.|www\.amazon\.|amazon\.)[^"]*"[^>]*class="cta-btn-amazon"/g)].length;
const amazonTotal     = amazonPending + amazonLive;

if (products.length > 0) {
  if (amazonTotal === 0) {
    warnings.push(
      `[Amazonリンク] Amazon CTAが1件もありません\n` +
      `  → step2-url2affiliate.mjs に --amazon を追加してください`
    );
  } else if (amazonTotal < products.length) {
    warnings.push(
      `[Amazonリンク] ${products.length}商品中${amazonTotal}件のみAmazon CTA設定済み（うちPENDING:${amazonPending}件）\n` +
      `  → Amazon URLが未設定の商品はAmazonアフィリエイトURLを発行してください`
    );
  } else if (amazonPending > 0) {
    warnings.push(
      `[Amazon PENDING] ${amazonPending}件のAmazonリンクがPENDING（確認中）のままです\n` +
      `  → Amazonアフィリエイトリンクを取得して置き換えてください`
    );
  }
}

// ── 5. disabled リンクの確認 ─────────────────────────────────
const disabledLinks = [...html.matchAll(/aria-disabled="true"/g)].length;
if (disabledLinks > amazonPending) {
  warnings.push(
    `[disabled リンク] aria-disabled="true"のリンクが${disabledLinks}件（Amazon PENDING: ${amazonPending}件）\n` +
    `  → Amazon PENDING以外のdisabledリンクを確認してください`
  );
}

// ── 6. CTAボタンのHTMLスタイル確認 ──────────────────────────
const ctatBtnAliex  = [...html.matchAll(/class="cta-btn-aliex"/g)].length;
const ctaBtnAmazon  = [...html.matchAll(/class="cta-btn-amazon"/g)].length;

// ── レポート出力 ─────────────────────────────────────────────
console.log('━'.repeat(60));

// サマリーカード
console.log('💰 アフィリエイトリンク状況:');
console.log(`  AliExpress アフィリリンク: ${aliLinks.length}件（ユニーク:${uniqueAli.size}件）`);
console.log(`  CTAボタン[AliEx]:          ${ctatBtnAliex}件`);
console.log(`  CTAボタン[Amazon]:         ${ctaBtnAmazon}件（うちPENDING:${amazonPending}件・LIVE:${amazonLive}件）`);
console.log(`  @product-startマーカー:    ${productMarkers.length}件`);
console.log('');

if (criticals.length > 0) {
  console.log(`❌ CRITICAL（${criticals.length}件）`);
  criticals.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
}
if (warnings.length > 0) {
  console.log(`\n⚠️  WARNING（${warnings.length}件）`);
  warnings.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
}

console.log('\n' + '━'.repeat(60));

if (criticals.length > 0) {
  console.log(`\n❌ アフィリエイトチェック失敗: CRITICAL ${criticals.length}件 を修正してください\n`);
  process.exit(1);
} else {
  console.log(`\n✅ アフィリエイトチェック通過（WARNING ${warnings.length}件）`);
  console.log(`▶ 次: node scripts/gen-voices.mjs ${slug}\n`);
  process.exit(0);
}
