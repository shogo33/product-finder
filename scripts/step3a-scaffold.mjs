/**
 * step3a-scaffold.mjs
 * AIを使わず research.json + meta.json から骨格HTMLを生成する
 *
 * 使い方: node scripts/step3a-scaffold.mjs <slug>
 * 例:    node scripts/step3a-scaffold.mjs gamesir-t4-pro-osusume
 *
 * 入力:  data/articles/{slug}-research.json
 *        data/articles/{slug}-plan.json
 *        data/articles/{slug}-meta.json（あれば優先）
 * 出力:  data/articles/{slug}-scaffold.html
 *
 * 【重要】 AIは一切使わない。数値・価格・リンク・画像URLはJSONから直接inject。
 *
 * 生成されるHTML構造:
 *   <section class="article-hero"> ... </section>
 *   <div class="container"><div class="article-body">
 *     <!-- CONCLUSION_PLACEHOLDER -->   ← step3c が埋める
 *     <!-- FORWHO_PLACEHOLDER -->        ← step3c が埋める
 *     [比較表: 価格・評価・リンクはFIXED、スペック列はplaceholder]
 *     <!-- TOC_PLACEHOLDER -->           ← step3d が埋める
 *     [FV画像: 1番目の商品の1枚目]
 *     <!-- PROSE-{id} -->               ← step3b が埋める（h2 + 解説文）
 *     [カルーセル: FIXED]
 *     [CTAボックス: FIXED]
 *     <hr>
 *     ... 商品分繰り返し
 *     <!-- CTA_INLINE_PLACEHOLDER -->    ← step3d が注入
 *     <!-- METABLOCK_PLACEHOLDER -->     ← step3c が埋める（イントロ・FAQ・まとめ）
 *     <!-- VOICE-START --><!-- VOICE-END -->
 *     <!-- AMAZON_REC_PLACEHOLDER -->
 *     <!-- RELATED_PLACEHOLDER -->       ← step4-related が埋める
 *   </div></div>
 */

import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step3a-scaffold.mjs <slug>');
  process.exit(1);
}

// ── ファイル読み込み ──────────────────────────────────────────
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const metaPath     = path.join(ARTICLES_DIR, `${slug}-meta.json`);

for (const p of [researchPath, planPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ファイルが見つかりません: ${p}`);
    process.exit(1);
  }
}

const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const plan     = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const meta     = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;

const products  = research.products ?? [];
const category  = plan.category ?? meta?.category ?? 'gadget';
const today     = new Date().toISOString().slice(0, 10);
const todayDisp = today.replace(/-(\d{2})-(\d{2})$/, '年$1月$2日');

// タイトルは meta.json → plan.json の優先順位で使用
const selectedTitle = meta?.selectedTitle ?? plan.selectedTitle ?? plan.keyword;

const CAT_TAG = {
  gadget: 'ガジェット', game: 'ゲーム', outdoor: 'アウトドア',
  guide: 'ガイド', safety: '安全性', payment: '支払い方法',
  shipping: '配送・追跡', basics: 'おすすめ商品',
};
const heroTag = CAT_TAG[category] ?? 'おすすめ商品';

console.log(`\n🔧 step3a-scaffold: ${slug} (${products.length}件)\n`);

// ── 価格フォーマット ──────────────────────────────────────────
const fmtPrice = (v) => v ? `¥${Number(v).toLocaleString('ja-JP')}` : '価格確認中';
const fmtRate  = (v) => v ? `${v}` : '-';
const fmtSales = (v) => v ? `${Number(v).toLocaleString('ja-JP')}件` : '-';

// ── CTAボックス生成（商品画像つき） ──────────────────────────
function buildCtaBox(p) {
  const aliUrl   = p.affiliateLink ?? '#';
  const amzUrl   = p.amazonPlaceholder?.url ?? null;
  const name     = p.cleanName;
  const imgUrl   = p.images?.[0] ?? p.mainImage ?? null;

  const imgBlock = imgUrl
    ? `<div class="cta-img-wrap">
    <img src="${imgUrl}" alt="${name}" loading="lazy" class="cta-product-img">
  </div>`
    : '';

  const amzBtn = amzUrl
    ? `<a class="cta-btn-amazon" href="${amzUrl}" target="_blank" rel="noopener sponsored">Amazonで見る</a>`
    : `<!-- AMAZON_PENDING: ${name} -->
    <a class="cta-btn-amazon" href="#" data-amazon-query="${name}" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`;

  return `<div class="cta-box">
${imgBlock}  <p class="cta-lead">【${name}】をどちらで買う？価格・配送を比較</p>
  <p class="cta-sub">AliExpress：送料無料・格安・到着2〜4週間｜Amazon：翌日〜2日・返品しやすい</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="${aliUrl}" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    ${amzBtn}
  </div>
</div>`;
}

// ── カルーセル生成 ────────────────────────────────────────────
function buildCarousel(p) {
  const imgs = (p.images ?? []).slice(0, 6);
  if (imgs.length === 0) {
    return `<!-- カルーセル画像なし: ${p.cleanName} -->`;
  }
  const imgTags = imgs.map((url, i) =>
    `    <img src="${url}" alt="${p.cleanName}${i > 0 ? ` 画像${i + 1}` : ''}" loading="${i === 0 ? 'eager' : 'lazy'}">`
  ).join('\n');

  return `<div class="product-carousel" data-carousel>
  <div class="carousel-track">
${imgTags}
  </div>
  <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
  <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
  <div class="carousel-dots"></div>
</div>`;
}

// ── 比較表生成 ────────────────────────────────────────────────
function buildComparisonTable(products, plan) {
  const cols = plan.comparisonTableColumns ?? ['モデル名', '価格（円）', '評価', '販売数'];

  // 確実にJSONから取れる列の対応マップ
  const FIXED_COLS = {
    'モデル名': p => `<a href="${p.affiliateLink ?? p.amazonPlaceholder?.url ?? '#'}" target="_blank" rel="noopener sponsored">${p.cleanName}</a>`,
    '価格（円）':    p => fmtPrice(p.price_jpy),
    '価格目安（円）': p => fmtPrice(p.price_jpy),
    '価格目安':     p => fmtPrice(p.price_jpy),
    '価格':        p => fmtPrice(p.price_jpy),
    '評価':        p => fmtRate(p.evaluate_rate),
    '販売数':      p => fmtSales(p.sales_count),
    'AliExpress': p => p.affiliateLink?.includes('s.click.aliexpress.com')
      ? `<a href="${p.affiliateLink}" target="_blank" rel="noopener sponsored">見る →</a>`
      : '<span style="color:#9ca3af">AliExなし</span>',
    'Amazon': p => p.amazonPlaceholder?.url
      ? `<a href="${p.amazonPlaceholder.url}" target="_blank" rel="noopener sponsored">見る →</a>`
      : '<span style="color:#9ca3af">確認中</span>',
  };

  // productProfile からも FIXED として取れる列を追加（AI不使用・直接inject）
  const PROFILE_COLS = {
    'タイプ':       p => p.productProfile?.productTypeShort ?? null,
    '製品タイプ':   p => p.productProfile?.productTypeShort ?? null,
    '主な特徴':     p => p.productProfile?.keyFeatures?.slice(0, 2).join('・') ?? null,
    'おすすめシーン': p => p.productProfile?.targetUseCase?.join('・') ?? null,
    '用途':         p => p.productProfile?.targetUseCase?.join('・') ?? null,
    'バッテリー持続': p => p.productProfile?.batteryLife ?? null,
    'バッテリー':   p => p.productProfile?.batteryLife ?? null,
    'ANC':         p => p.productProfile?.hasANC === true ? 'あり' : p.productProfile?.hasANC === false ? 'なし' : null,
    '接続':         p => p.productProfile?.connectivity ?? null,
  };

  // 列名を正規化してFIXED_COLSにマッチさせる（括弧・空白の違いを吸収）
  const normalizeCol = c => c.replace(/[（）()]/g, '').replace(/\s+/g, '').toLowerCase();
  const FIXED_COLS_NORM = Object.fromEntries(
    Object.entries(FIXED_COLS).map(([k, v]) => [normalizeCol(k), v])
  );
  const PROFILE_COLS_NORM = Object.fromEntries(
    Object.entries(PROFILE_COLS).map(([k, v]) => [normalizeCol(k), v])
  );

  // SPECプレースホルダーになる列を事前にログ出力（再発防止）
  const specCols = cols.filter(col => {
    const nc = normalizeCol(col);
    return !FIXED_COLS[col] && !FIXED_COLS_NORM[nc] && !PROFILE_COLS[col] && !PROFILE_COLS_NORM[nc];
  });
  if (specCols.length > 0) {
    console.log(`  ⚠️  以下の列はTavily specResultが必要です（nullの場合「-」になります）:`);
    specCols.forEach(c => console.log(`     「${c}」`));
    console.log(`     → step2b-spec-research.mjs を実行するか、列名を変更してください`);
  }

  const headers = cols.map(c => `<th>${c}</th>`).join('');
  const rows = products.map(p => {
    const pid = String(p.product_id ?? 'p0');
    const cells = cols.map(col => {
      const nc = normalizeCol(col);
      // 優先順位: FIXED_COLS → FIXED_COLS_NORM → PROFILE_COLS（productProfile）→ PROFILE_COLS_NORM → SPECプレースホルダー
      const fixedFn   = FIXED_COLS[col]   ?? FIXED_COLS_NORM[nc];
      const profileFn = PROFILE_COLS[col] ?? PROFILE_COLS_NORM[nc];
      if (fixedFn)   return `<td>${fixedFn(p)}</td>`;
      if (profileFn) {
        const val = profileFn(p);
        if (val !== null && val !== undefined) return `<td>${val}</td>`;
      }
      // productProfile にも値がない → SPECプレースホルダー
      return `<td><!-- SPEC-${pid}-${col.replace(/\s/g, '_')} --></td>`;
    }).join('');
    return `  <tr>${cells}</tr>`;
  }).join('\n');

  return `<div class="table-wrap">
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
}

// ── 商品セクション骨格生成 ────────────────────────────────────
function buildProductScaffold(p, idx, isLast) {
  const id       = String(p.product_id ?? `p${idx}`);
  const carousel = buildCarousel(p);
  const ctaBox   = buildCtaBox(p);
  // 切り替え線：最後の商品には不要
  const divider  = isLast ? '' : `
<div class="product-divider">
  <span class="product-divider-label">次の商品</span>
</div>`;

  return `<!-- @product-start id="${id}" type="${heroTag}" tag="${heroTag}" -->
<div class="product-section" data-product-id="${id}">

<!-- PROSE-${id} -->

${carousel}

${ctaBox}

</div>
<!-- @product-end -->${divider}`;
}

// ── FV画像生成（画像のある最初の商品を使う） ─────────────────
function buildFvImage(products) {
  const withImage = products.find(p =>
    (p.images?.length > 0) || p.mainImage
  );
  if (!withImage) return '<!-- FV画像なし -->';
  const fv   = withImage.images?.[0] ?? withImage.mainImage;
  const name = withImage.cleanName ?? '';
  return `<figure class="fv-product-image">
  <img src="${fv}" alt="${name}" loading="eager">
</figure>`;
}

// ── Amazonおすすめウィジェット生成 ────────────────────────────
function buildAmazonRec(products) {
  const items = products
    .filter(p => p.amazonPlaceholder?.url)
    .map(p => `    <a href="${p.amazonPlaceholder.url}" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
      <span class="amazon-rec-label">Amazon</span>
      <span class="amazon-rec-name">${p.cleanName}</span>
      <span class="amazon-rec-cta">Amazonで見る</span>
    </a>`).join('\n');

  if (!items) return '<!-- Amazonおすすめ: 商品のAmazon URLが設定されていません -->';

  return `<!-- Amazonおすすめ -->
<div class="amazon-rec">
  <div class="amazon-rec-title">🛒 Amazonでも買えます</div>
  <div class="amazon-rec-list">
${items}
  </div>
</div>`;
}

// ── アプリ誘導バナー ──────────────────────────────────────────
const CTA_INLINE = `<!-- アプリ誘導バナー -->
<div class="cta-inline">
  <div class="cta-label">✨ PICK UP</div>
  <h3>AIが今話題の商品をスワイプで提案</h3>
  <p>TikTokで見たアレ、AliExpressで見つかるかも。<br>スワイプするだけで掘り出し物に出会えます。</p>
  <a href="https://aliswipe.com/app/" target="_blank" rel="noopener">スワイプでおすすめ商品を見る →</a>
</div>`;

// ── 全体アセンブル ────────────────────────────────────────────
const comparisonTable = buildComparisonTable(products, plan);
const fvImage         = buildFvImage(products);
const amazonRec       = buildAmazonRec(products);

// 商品セクションを中盤でアプリバナーを挿入（2番目以降の最初の商品の後ろ）
const productSections = products.map((p, i) =>
  buildProductScaffold(p, i, i === products.length - 1)
);

// アプリバナーを挿入: 2商品以上なら2番目の後、1商品なら商品セクション後
let productHtml;
if (productSections.length >= 3) {
  // 2番目の商品の後に挿入
  const before = productSections.slice(0, 2).join('\n\n');
  const after  = productSections.slice(2).join('\n\n');
  productHtml  = `${before}\n\n${CTA_INLINE}\n\n${after}`;
} else if (productSections.length === 2) {
  productHtml = `${productSections[0]}\n\n${CTA_INLINE}\n\n${productSections[1]}`;
} else {
  productHtml = `${productSections[0]}\n\n${CTA_INLINE}`;
}

const scaffold = `<!-- scaffold: ${slug} / generated: ${today} -->
<!-- ================================================================
  このファイルは step3a-scaffold.mjs が自動生成した骨格HTMLです。
  直接編集せず、各 placeholder を対応するスクリプトで埋めてください。

  PROSE-{id}            → step3b-write.mjs で埋める
  CONCLUSION_PLACEHOLDER → step3c-meta.mjs で埋める
  FORWHO_PLACEHOLDER    → step3c-meta.mjs で埋める
  SPEC-{id}-{col}       → step3c-meta.mjs で埋める（スペック列）
  TOC_PLACEHOLDER       → step3d-assemble.mjs で自動生成
  METABLOCK_PLACEHOLDER → step3c-meta.mjs で埋める
  RELATED_PLACEHOLDER   → step4-related.mjs で埋める
================================================================ -->

<section class="article-hero">
  <div class="tag">${heroTag}</div>
  <h1>${selectedTitle}</h1>
  <div class="meta">
    <span>${todayDisp}更新</span>
    <span>読了約8分</span>
  </div>
  <p class="promo-notice">当サイトは、Amazonアソシエイトを含むアフィリエイトプログラムを利用しています。</p>
</section>

<div class="container"><div class="article-body">

${fvImage}

<!-- CONCLUSION_PLACEHOLDER -->

<!-- FORWHO_PLACEHOLDER -->

${comparisonTable}

<!-- TOC_PLACEHOLDER -->

${productHtml}

<!-- METABLOCK_PLACEHOLDER -->

<!-- VOICE-START --><!-- VOICE-END -->

${amazonRec}

<!-- RELATED_PLACEHOLDER -->

</div></div>
`;

// ── 保存 ─────────────────────────────────────────────────────
const outPath = path.join(ARTICLES_DIR, `${slug}-scaffold.html`);
fs.writeFileSync(outPath, scaffold, 'utf8');

// ── サマリー ─────────────────────────────────────────────────
console.log('━'.repeat(60));
console.log(`✅ 骨格HTML生成完了: ${outPath}`);
console.log(`\n📋 生成内容:`);
console.log(`   ヒーロー:    タイトル="${selectedTitle.slice(0, 30)}..."`);
console.log(`   比較表:      ${products.length}行 × ${(plan.comparisonTableColumns ?? []).length}列`);
console.log(`   FV画像:      ${products.some(p => p.images?.length > 0 || p.mainImage) ? '✅' : '⚠️ 画像なし'}`);
console.log(`   商品骨格:    ${products.length}件`);
products.forEach((p, i) => {
  const imgs = (p.images ?? []).length;
  const aff  = p.affiliateLink?.includes('s.click.aliexpress.com') ? '✅' : '❌ なし';
  const amz  = p.amazonPlaceholder?.url ? '✅' : '⏳ PENDING';
  console.log(`     ${i + 1}. ${p.cleanName}`);
  console.log(`        画像:${imgs}枚 | AliEx:${aff} | Amazon:${amz}`);
});
console.log(`\n⚠️  以下のプレースホルダーはまだ空です:`);
console.log(`   CONCLUSION / FORWHO  → step3c-meta.mjs で生成`);
console.log(`   PROSE-{id} × ${products.length}件     → step3b-write.mjs で生成`);
console.log(`   METABLOCK            → step3c-meta.mjs で生成`);

// スペック列プレースホルダーの確認（実際のHTMLのSPECマーカーから判定）
const actualSpecCols = [...scaffold.matchAll(/<!-- SPEC-[^-]+-([^-]+(?:_[^-]+)*) -->/g)]
  .map(m => m[1].replace(/_/g, ' '))
  .filter((v, i, a) => a.indexOf(v) === i); // unique
if (actualSpecCols.length > 0) {
  console.log(`   SPEC列 (${actualSpecCols.join(' / ')}) → step3c-meta.mjs で生成`);
}

console.log('\n' + '━'.repeat(60));
console.log(`\n▶ 次: node scripts/step3b-write.mjs ${slug} <product_id>`);
console.log(`   商品ID一覧:`);
products.forEach(p => console.log(`     ${p.product_id}  →  ${p.cleanName}`));
