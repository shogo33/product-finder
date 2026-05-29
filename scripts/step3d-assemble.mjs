/**
 * step3d-assemble.mjs
 * AIを使わず全パーツを結合して完成HTMLを生成する
 *
 * 使い方: node scripts/step3d-assemble.mjs <slug>
 * 例:    node scripts/step3d-assemble.mjs gamesir-t4-pro-osusume
 *
 * 入力:  data/articles/{slug}-scaffold.html    （骨格・カルーセル・CTA）
 *        data/articles/{slug}-prose-{id}.html  （商品解説文 × N）
 *        data/articles/{slug}-metablock.html   （FAQ・まとめ）
 *        data/articles/{slug}-meta.json        （タイトル・meta情報）
 *        data/articles/{slug}-plan.json        （内部リンク・カテゴリ）
 *        data/articles/{slug}-research.json    （商品リスト・価格確認用）
 * 出力:  public/{category}/{slug}.html
 *        data/article-dates.json 更新
 *
 * 処理内容:
 *   1. scaffold に prose × N を注入（PROSE-{id} 置換）
 *   2. METABLOCK_PLACEHOLDER に metablock を注入
 *   3. RELATED_PLACEHOLDER に関連記事ブロックを生成
 *   4. TOC_PLACEHOLDER に自動生成した目次を注入
 *   5. 全体を完全なHTML（head + body）でラップ
 *   6. article-dates.json 更新
 *   7. gen-ogp / fix-seo を自動実行
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ARTICLES_DIR = path.resolve('data/articles');
const DOMAIN       = 'https://aliswipe.com';
const GA_TAG       = 'G-7Y2RN13F5S';

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step3d-assemble.mjs <slug>');
  process.exit(1);
}

console.log(`\n🔨 step3d-assemble: ${slug}\n`);

// ── ファイル読み込み ──────────────────────────────────────────
const scaffoldPath  = path.join(ARTICLES_DIR, `${slug}-scaffold.html`);
const metablockPath = path.join(ARTICLES_DIR, `${slug}-metablock.html`);
const metaPath      = path.join(ARTICLES_DIR, `${slug}-meta.json`);
const planPath      = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath  = path.join(ARTICLES_DIR, `${slug}-research.json`);

for (const p of [scaffoldPath, planPath, researchPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ファイルが見つかりません: ${p}`);
    console.error('   必要なスクリプトを先に実行してください:');
    if (p === scaffoldPath)  console.error('   node scripts/step3a-scaffold.mjs ' + slug);
    process.exit(1);
  }
}

let body         = fs.readFileSync(scaffoldPath, 'utf8');
const metablock  = fs.existsSync(metablockPath) ? fs.readFileSync(metablockPath, 'utf8') : '';
const meta       = fs.existsSync(metaPath)      ? JSON.parse(fs.readFileSync(metaPath,     'utf8')) : null;
const plan       = JSON.parse(fs.readFileSync(planPath,    'utf8'));
const research   = JSON.parse(fs.readFileSync(researchPath, 'utf8'));

const products   = research.products ?? [];
const category   = plan.category ?? meta?.category ?? 'gadget';
const today      = new Date().toISOString().slice(0, 10);

// タイトル・meta情報の優先順位: meta.json > plan.json
const selectedTitle  = meta?.selectedTitle  ?? plan.selectedTitle ?? plan.keyword;
const metaDesc       = meta?.metaDescription ?? plan.metaDescription ?? '';
const metaKeywords   = (meta?.metaKeywords ?? [plan.keyword, 'AliExpress', 'アリエク', 'おすすめ']).join(', ');
const ogTitle        = meta?.ogTitle        ?? selectedTitle;
const ogDesc         = (meta?.ogDescription ?? metaDesc).slice(0, 120);
const canonUrl       = `${DOMAIN}/${category}/${slug}.html`;
const imageUrl       = `${DOMAIN}/images/ogp/${slug}.jpg`;

// ── Step 1: PROSE プレースホルダーを注入 ─────────────────────
console.log('  1. Proseを注入中...');
let proseCount = 0;
for (const [pi, p] of products.entries()) {
  const id        = String(p.product_id ?? `p${pi}`);
  const prosePath = path.join(ARTICLES_DIR, `${slug}-prose-${id}.html`);
  const marker    = `<!-- PROSE-${id} -->`;

  if (!body.includes(marker)) continue;

  if (!fs.existsSync(prosePath)) {
    console.warn(`  ⚠️  prose-${id}.html が見つかりません: ${p.cleanName}`);
    console.warn(`     node scripts/step3b-write.mjs ${slug} ${id} を実行してください`);
    body = body.replace(marker, `<!-- PROSE MISSING: ${p.cleanName} (${id}) -->`);
    continue;
  }

  const proseContent = fs.readFileSync(prosePath, 'utf8')
    .replace(/^<!-- prose:.*-->\n/, ''); // コメントヘッダー除去
  body = body.replace(marker, proseContent);
  console.log(`     ✅ ${p.cleanName}`);
  proseCount++;
}
console.log(`     → ${proseCount}/${products.length}件 注入完了`);

// ── Step 1b: カルーセルをh2直後に移動（画像ファーストルール） ──
// prose注入後、各商品セクション内でcarouselがh2より後ろにある場合は
// h2直後に移動する（step3bの出力形式を変えずに実現）
body = body.replace(
  /<!-- @product-start[^>]*-->([\s\S]*?)<!-- @product-end -->/g,
  (fullMatch, inner) => {
    const h2EndPos = inner.indexOf('</h2>');
    if (h2EndPos === -1) return fullMatch;

    const carouselStart = inner.indexOf('<div class="product-carousel"');
    if (carouselStart === -1) return fullMatch;

    // すでにh2直後にある場合（間が空白のみ）はスキップ
    const between = inner.slice(h2EndPos + 5, carouselStart).trim();
    if (between === '') return fullMatch;

    // カルーセルdivの終端をネスト深度で探す
    let depth = 0, pos = carouselStart;
    while (pos < inner.length) {
      if (inner.startsWith('<div', pos))  { depth++; pos += 4; continue; }
      if (inner.startsWith('</div>', pos)) {
        depth--;
        if (depth === 0) { pos += 6; break; }
        pos += 6; continue;
      }
      pos++;
    }
    const carouselEnd = pos;
    const carousel = inner.slice(carouselStart, carouselEnd);

    // カルーセルを現在位置から取り除いてh2直後に挿入
    const withoutCarousel = inner.slice(0, carouselStart) + inner.slice(carouselEnd);
    const insertPos = h2EndPos + 5;
    const reordered = withoutCarousel.slice(0, insertPos) +
      '\n' + carousel + '\n' +
      withoutCarousel.slice(insertPos);

    return fullMatch.replace(inner, reordered);
  }
);
console.log('  1b. カルーセルをh2直後に配置: ✅');

// ── Step 2: METABLOCK 注入 ────────────────────────────────────
console.log('  2. Metablockを注入中...');
if (metablock && body.includes('<!-- METABLOCK_PLACEHOLDER -->')) {
  const cleanMetablock = metablock.replace(/^<!-- metablock:.*-->\n/, '');
  body = body.replace('<!-- METABLOCK_PLACEHOLDER -->', cleanMetablock);
  console.log('     ✅ FAQ + まとめ 注入完了');
} else if (!metablock) {
  console.warn('     ⚠️  metablock.html が見つかりません → node scripts/step3c-meta.mjs ' + slug);
  body = body.replace('<!-- METABLOCK_PLACEHOLDER -->', '<!-- METABLOCK MISSING -->');
}

// ── Step 3: 関連記事ブロック生成・注入 ───────────────────────
console.log('  3. 関連記事ブロックを生成中...');
const internalLinks = plan.internalLinks ?? [];
let relatedHtml = '';
if (internalLinks.length > 0) {
  const cards = internalLinks.slice(0, 6).map(l => {
    const tag = l.url?.includes('/gadget/') ? 'ガジェット'
              : l.url?.includes('/game/')    ? 'ゲーム'
              : l.url?.includes('/outdoor/') ? 'アウトドア'
              : l.url?.includes('/guide/')   ? 'ガイド'
              : 'おすすめ';
    return `      <a href="${l.url}" class="related-card">
        <div class="rc-tag">${tag}</div>
        <div class="rc-title">${l.anchorText}</div>
      </a>`;
  }).join('\n');
  relatedHtml = `<div class="container">
  <div class="related">
    <div class="related-title">関連記事</div>
    <div class="related-grid">
${cards}
    </div>
  </div>
</div>`;
  console.log(`     ✅ ${internalLinks.length}件の関連記事カード生成`);
}
body = body.replace('<!-- RELATED_PLACEHOLDER -->', relatedHtml);

// ── Step 4: TOC 生成・注入 ────────────────────────────────────
console.log('  4. 目次（TOC）を生成中...');
// h2にIDを付与（まだIDがない場合）
let secIdx = 0;
body = body.replace(/<h2([^>]*)>/g, (match, attrs) => {
  if (/id=/.test(attrs)) return match;
  secIdx++;
  return `<h2${attrs} id="sec-${secIdx}">`;
});

// h2一覧からTOCを生成
const h2Matches = [...body.matchAll(/<h2[^>]+id="(sec-\d+|[^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)];
if (h2Matches.length >= 2) {
  const tocItems = h2Matches.map(([, id, inner]) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    return `      <li><a href="#${id}">${text}</a></li>`;
  }).join('\n');
  const tocHtml = `<nav class="toc">
  <div class="toc-title">📋 この記事の目次</div>
  <ol>
${tocItems}
  </ol>
</nav>`;
  body = body.replace('<!-- TOC_PLACEHOLDER -->', tocHtml);
  console.log(`     ✅ ${h2Matches.length}見出しからTOC生成`);
} else {
  body = body.replace('<!-- TOC_PLACEHOLDER -->', '');
  console.log('     ⚠️  h2見出しが2件未満のためTOCをスキップ');
}

// scaffold コメントヘッダーを除去
body = body.replace(/^<!-- scaffold:[\s\S]*?-->\n/m, '').trim();

// ── Step 5: HTMLテンプレートでラップ ─────────────────────────
console.log('  5. HTMLテンプレートでラップ中...');

const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${selectedTitle} | アリエクswipe｜ガチ検証で選ぶアリエクの神コスパ商品</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="keywords" content="${metaKeywords}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonUrl}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
  <link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

  <style>
    :root { --red:#e8253a; --red-dk:#b81c2c; --bg:#fafaf8; --surface:#ffffff; --text:#1a1a1a; --muted:#6b7280; --border:#e5e7eb; --radius:12px; --max:760px; }
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Noto Sans JP',sans-serif; background:var(--bg); color:var(--text); line-height:1.8; font-size:16px; }
    .article-hero { background:linear-gradient(135deg,#fff1f2 0%,#fff 60%); border-bottom:1px solid var(--border); padding:48px 20px 36px; text-align:center; }
    .article-hero .tag { display:inline-block; background:var(--red); color:#fff; font-size:0.72rem; font-weight:700; letter-spacing:0.08em; padding:4px 12px; border-radius:999px; margin-bottom:16px; }
    .article-hero h1 { font-weight:700; font-size:clamp(1.35rem,4vw,1.9rem); line-height:1.45; max-width:640px; margin:0 auto 16px; }
    .article-hero .meta { font-size:0.82rem; color:var(--muted); }
    .article-hero .meta span + span::before { content:" · "; }
    .container { max-width:var(--max); margin:0 auto; padding:0 20px; }
    .toc { background:#fff8f8; border:1px solid #fecdcf; border-left:4px solid var(--red); border-radius:var(--radius); padding:20px 24px; margin:32px 0; }
    .toc-title { font-weight:700; font-size:0.9rem; margin-bottom:12px; color:var(--red); }
    .toc ol { padding-left:20px; }
    .toc li { margin:6px 0; }
    .toc a { color:var(--text); text-decoration:none; font-size:0.9rem; }
    .toc a:hover { color:var(--red); }
    .article-body { padding:24px 0 48px; }
    .article-body h2 { font-size:1.25rem; font-weight:700; border-left:4px solid var(--red); padding-left:12px; margin:44px 0 16px; scroll-margin-top:80px; }
    .article-body h3 { font-size:1.02rem; font-weight:700; margin:30px 0 12px; padding-left:10px; border-left:2px solid #fecdcf; scroll-margin-top:80px; }
    .article-body p { margin:12px 0; font-size:0.95rem; }
    .article-body ul, .article-body ol { padding-left:24px; margin:12px 0; }
    .article-body li { margin:7px 0; font-size:0.94rem; }
    .article-body strong { color:var(--red-dk); }
    .table-wrap { overflow-x:auto; margin:20px 0; border-radius:var(--radius); border:1px solid var(--border); }
    table { min-width:100%; width:max-content; border-collapse:collapse; font-size:0.88rem; }
    th { background:var(--red); color:#fff; padding:10px 14px; text-align:left; font-weight:700; white-space:nowrap; }
    td { padding:10px 14px; border-bottom:1px solid var(--border); vertical-align:top; white-space:nowrap; }
    tr:last-child td { border-bottom:none; }
    tr:nth-child(even) td { background:#fafaf8; }
    .callout { background:#fffbeb; border:1px solid #fde68a; border-radius:var(--radius); padding:14px 18px; margin:18px 0; font-size:0.88rem; line-height:1.7; }
    .callout::before { content:"💡 "; }
    .callout-danger { background:#fff1f2; border:1px solid #fecdcf; border-radius:var(--radius); padding:14px 18px; margin:18px 0; font-size:0.88rem; line-height:1.7; }
    .callout-danger::before { content:"⚠️ "; }
    .callout-check { background:#f0fdf4; border:1px solid #86efac; border-radius:var(--radius); padding:14px 18px; margin:18px 0; font-size:0.88rem; line-height:1.7; }
    .callout-check::before { content:"✅ "; }
    .article-conclusion { background:#fff8f8; border:1px solid #fecdcf; border-left:4px solid var(--red); border-radius:var(--radius); padding:18px 20px; margin:20px 0; }
    .for-who { background:#f0fdf4; border:1px solid #86efac; border-left:4px solid #22c55e; border-radius:var(--radius); padding:18px 20px; margin:20px 0; }
    .fv-product-image { margin:0 0 28px; text-align:center; }
    .fv-product-image img { max-width:480px; width:100%; border-radius:12px; object-fit:contain; max-height:320px; }
    .product-carousel { position:relative; margin:16px 0 28px; border-radius:12px; overflow:hidden; background:#f5f5f5; user-select:none; }
    .carousel-track { display:flex; will-change:transform; transition:transform 0.3s cubic-bezier(0.25,0.1,0.25,1); }
    .carousel-track img { min-width:100%; height:280px; object-fit:contain; border-radius:12px; display:block; }
    @media (max-width:480px) { .carousel-track img { height:220px; } }
    .carousel-btn { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.9); border:none; border-radius:50%; width:38px; height:38px; font-size:1.3rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.18); }
    .carousel-btn.prev { left:8px; }
    .carousel-btn.next { right:8px; }
    .carousel-dots { display:flex; justify-content:center; gap:6px; padding:8px 0 4px; background:#f5f5f5; }
    .carousel-dot { width:7px; height:7px; border-radius:50%; background:#ddd; border:none; cursor:pointer; padding:0; transition:background 0.2s; }
    .carousel-dot.active { background:var(--red); }
    .cta-box { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin:24px 0; }
    .cta-lead { font-weight:700; font-size:0.95rem; margin-bottom:6px; }
    .cta-sub { font-size:0.82rem; color:var(--muted); margin-bottom:14px; }
    .cta-buttons { display:flex; gap:10px; flex-wrap:wrap; }
    .cta-btn-aliex { display:inline-block; background:var(--red); color:#fff; font-weight:700; font-size:0.9rem; padding:12px 20px; border-radius:8px; text-decoration:none; flex:1; text-align:center; min-width:140px; }
    .cta-btn-amazon { display:inline-block; background:#ff9900; color:#fff; font-weight:700; font-size:0.9rem; padding:12px 20px; border-radius:8px; text-decoration:none; flex:1; text-align:center; min-width:140px; }
    .cta-btn-aliex:hover { background:var(--red-dk); }
    .cta-btn-amazon:hover { background:#e68a00; }
    .cta-inline { background:linear-gradient(135deg,var(--red) 0%,#ff6b35 100%); border-radius:var(--radius); padding:28px 24px; text-align:center; margin:40px 0; color:#fff; }
    .cta-inline .cta-label { font-size:0.75rem; font-weight:700; letter-spacing:0.1em; opacity:0.85; margin-bottom:8px; }
    .cta-inline h3 { font-size:1.1rem; font-weight:700; margin-bottom:8px; }
    .cta-inline p { font-size:0.85rem; opacity:0.9; margin-bottom:20px; }
    .cta-inline a { display:inline-block; background:#fff; color:var(--red); font-weight:700; font-size:0.9rem; padding:12px 28px; border-radius:999px; text-decoration:none; }
    .reddit-quote { background:#f7f9f9; border-left:4px solid #0f1419; border-radius:8px; padding:16px 18px; margin:20px 0; font-size:0.9rem; line-height:1.7; }
    .reddit-quote p { margin:0 0 8px; }
    .reddit-quote cite { font-size:0.76rem; color:var(--muted); font-style:normal; }
    .reddit-quote cite a { color:#0f1419; text-decoration:none; }
    .reddit-voices { background:#fff; border:1px solid var(--border); border-radius:var(--radius); padding:24px; margin:40px 0; }
    .voices-badge { display:inline-block; background:#000; color:#fff; font-size:0.7rem; font-weight:700; padding:2px 10px; border-radius:999px; margin-bottom:8px; }
    .voices-title { font-size:1.05rem; font-weight:700; margin:6px 0 8px; }
    .voices-meta { font-size:0.8rem; color:var(--muted); line-height:1.6; }
    .voice-item { border-top:1px solid var(--border); padding:16px 0; }
    .voice-item:last-child { padding-bottom:0; }
    .voice-label { font-size:0.78rem; font-weight:700; color:var(--muted); margin-bottom:4px; }
    .voice-title { font-size:0.97rem; font-weight:700; margin-bottom:6px; }
    .voice-body { font-size:0.88rem; line-height:1.75; margin:0 0 8px; }
    .related { margin:48px 0 24px; }
    .related-title { font-weight:700; font-size:1rem; margin-bottom:16px; }
    .related-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width:480px) { .related-grid { grid-template-columns:1fr; } }
    .related-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; text-decoration:none; color:var(--text); transition:border-color 0.2s; }
    .related-card:hover { border-color:var(--red); }
    .related-card .rc-tag { font-size:0.7rem; color:var(--red); font-weight:700; margin-bottom:6px; }
    .related-card .rc-title { font-size:0.88rem; font-weight:700; line-height:1.4; }
    .amazon-rec { margin:40px 0 24px; padding:20px; background:#fff8f0; border:1px solid #fcd34d; border-radius:12px; }
    .amazon-rec-title { font-size:0.9rem; font-weight:700; color:#92400e; margin-bottom:14px; }
    .amazon-rec-list { display:flex; flex-direction:column; gap:10px; }
    .amazon-rec-item { display:flex; align-items:center; gap:10px; padding:12px 14px; background:#fff; border:1px solid #fde68a; border-radius:8px; text-decoration:none; color:#1a1a1a; }
    .amazon-rec-item:hover { border-color:#f59e0b; }
    .amazon-rec-label { font-size:0.7rem; font-weight:700; color:#fff; background:#f59e0b; padding:2px 7px; border-radius:10px; white-space:nowrap; flex-shrink:0; }
    .amazon-rec-name { font-size:0.85rem; font-weight:600; flex:1; }
    .amazon-rec-cta { font-size:0.78rem; color:#f59e0b; font-weight:700; white-space:nowrap; flex-shrink:0; }
    .faq-list { margin:20px 0; }
    .faq-item { border:1px solid var(--border); border-radius:var(--radius); margin-bottom:12px; overflow:hidden; }
    .faq-q { background:#fafaf8; padding:14px 18px; font-size:0.95rem; font-weight:700; cursor:pointer; }
    .faq-a { padding:14px 18px; font-size:0.9rem; line-height:1.75; }
    .faq-a p { margin:0; }
    .site-footer { background:#1a1a1a; color:#9ca3af; text-align:center; padding:32px 20px 60px; font-size:0.8rem; }
    .site-footer a { color:#9ca3af; text-decoration:none; }
    .footer-links { display:flex; gap:16px; justify-content:center; margin-bottom:12px; flex-wrap:wrap; }
    .footer-aff-notice { margin-top:12px; font-size:0.72rem; opacity:0.6; line-height:1.6; }
    .cta-sticky { display:none; position:fixed; bottom:0; left:0; right:0; background:linear-gradient(90deg,#e8253a 0%,#ff6b35 100%); color:#fff; text-align:center; padding:12px 20px; z-index:200; }
    .cta-sticky a { color:#fff; text-decoration:none; font-weight:700; font-size:0.88rem; }
    @media (max-width:640px) { .cta-sticky { display:block; } body { padding-bottom:72px; } }
    .pc-float-banner { display:none; position:fixed; bottom:24px; right:24px; width:288px; background:linear-gradient(135deg,#e8253a 0%,#ff6b35 100%); border-radius:16px; box-shadow:0 8px 32px rgba(232,37,58,0.35); padding:20px; z-index:300; color:#fff; opacity:0; transform:translateY(20px); transition:opacity 0.4s,transform 0.4s; pointer-events:none; }
    @media (min-width:641px) { .pc-float-banner { display:block; } }
    .pc-float-banner.pc-float-visible { opacity:1; transform:translateY(0); pointer-events:auto; }
    .pc-float-close { position:absolute; top:10px; right:12px; background:rgba(255,255,255,0.2); border:none; border-radius:50%; width:24px; height:24px; font-size:0.85rem; color:#fff; cursor:pointer; }
    .pc-float-title { font-weight:700; font-size:1rem; margin:0 0 6px; }
    .pc-float-desc { font-size:0.76rem; opacity:0.88; margin:0 0 16px; }
    .pc-float-btn { display:block; background:#fff; color:#e8253a !important; text-align:center; padding:11px; border-radius:999px; font-weight:700; font-size:0.88rem; text-decoration:none; }
    #reading-progress { position:fixed; top:0; left:0; width:0%; height:3px; background:var(--red); z-index:9999; transition:width 0.15s; }
    hr { border:none; border-top:1px solid var(--border); margin:32px 0; }
    .promo-notice { font-size:0.75rem; color:var(--muted); margin-top:12px; }
    /* 商品切り替え線 */
    .product-divider { display:flex; align-items:center; gap:12px; margin:48px 0 40px; }
    .product-divider::before, .product-divider::after { content:''; flex:1; height:2px; background:linear-gradient(90deg, transparent, var(--border), transparent); }
    .product-divider-label { font-size:0.75rem; font-weight:700; color:var(--muted); white-space:nowrap; letter-spacing:0.08em; padding:4px 12px; border:1px solid var(--border); border-radius:999px; background:var(--bg); }
    /* CTA画像 */
    .cta-img-wrap { text-align:center; margin-bottom:14px; }
    .cta-product-img { max-height:160px; max-width:100%; object-fit:contain; border-radius:8px; background:#f5f5f5; }
  </style>

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_TAG}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_TAG}');
  </script>
  <script src="/components.js"></script>
</head>
<body>

<div id="reading-progress"></div>
<script id="site-header-inject"></script>

${body}

<div class="pc-float-banner" id="pc-float-banner">
  <button class="pc-float-close" id="pc-float-close" aria-label="閉じる">✕</button>
  <div class="pc-float-label">⚡ まだまだあります</div>
  <p class="pc-float-title">スワイプで好みの商品を発見しよう</p>
  <p class="pc-float-desc">200件以上の厳選商品をTinder感覚でチェック。ハートでお気に入り登録。</p>
  <a href="/app/" class="pc-float-btn">おすすめ商品をスワイプで見る →</a>
</div>

<div class="cta-sticky" id="cta-sticky"></div>
<script src="/js/cta-sticky.js" defer></script>

<footer class="site-footer" id="site-footer"></footer>

<script>
  document.querySelectorAll('[data-carousel]').forEach(function(c) {
    var t=c.querySelector('.carousel-track'),imgs=t.querySelectorAll('img'),d=c.querySelector('.carousel-dots'),cur=0;
    imgs.forEach(function(_,i){var b=document.createElement('button');b.className='carousel-dot'+(i===0?' active':'');b.setAttribute('aria-label',(i+1)+'枚目');b.addEventListener('click',function(){goTo(i);});d.appendChild(b);});
    function goTo(n){cur=((n%imgs.length)+imgs.length)%imgs.length;t.style.transform='translateX(-'+(cur*100)+'%)';c.querySelectorAll('.carousel-dot').forEach(function(b,i){b.classList.toggle('active',i===cur);});}
    c.querySelector('.prev').addEventListener('click',function(){goTo(cur-1);});
    c.querySelector('.next').addEventListener('click',function(){goTo(cur+1);});
    var sx=0;t.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    t.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)goTo(dx<0?cur+1:cur-1);},{passive:true});
  });
  (function(){var b=document.getElementById('pc-float-banner');if(!b)return;if(localStorage.getItem('pcb')){b.style.display='none';return;}var s=false;window.addEventListener('scroll',function(){if(s)return;if((window.scrollY||window.pageYOffset)>400){s=true;b.classList.add('pc-float-visible');}},{passive:true});document.getElementById('pc-float-close').addEventListener('click',function(){b.style.display='none';localStorage.setItem('pcb','1');});})();
  (function(){var b=document.getElementById('reading-progress');if(!b)return;window.addEventListener('scroll',function(){var s=window.scrollY||window.pageYOffset,h=document.documentElement.scrollHeight-window.innerHeight;b.style.width=(h>0?(s/h)*100:0)+'%';},{passive:true});})();
</script>
</body>
</html>`;

// ── 保存 ─────────────────────────────────────────────────────
console.log('  6. HTMLを保存中...');
const outDir  = path.resolve('public', category);
const outPath = path.join(outDir, `${slug}.html`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, fullHtml, 'utf8');
console.log(`     ✅ ${outPath}`);

// ── article-dates.json 更新 ───────────────────────────────────
const DATES_FILE = 'data/article-dates.json';
const existingDates = fs.existsSync(DATES_FILE)
  ? JSON.parse(fs.readFileSync(DATES_FILE, 'utf8'))
  : {};
if (!existingDates[slug]) {
  existingDates[slug] = { published: today, modified: today };
} else {
  existingDates[slug].modified = today;
}
fs.writeFileSync(DATES_FILE, JSON.stringify(existingDates, null, 2), 'utf8');
console.log(`     ✅ article-dates.json 更新`);

// ── gen-ogp / fix-seo 自動実行 ───────────────────────────────
console.log('\n  7. OGP画像・SEOメタ情報を更新中...');
try {
  execSync('node scripts/gen-ogp.mjs', { stdio: 'pipe' });
  console.log('     ✅ gen-ogp.mjs 完了');
} catch (e) {
  console.warn('     ⚠️  gen-ogp.mjs エラー（続行）');
}
try {
  execSync('node scripts/fix-seo.mjs', { stdio: 'pipe' });
  console.log('     ✅ fix-seo.mjs 完了');
} catch (e) {
  console.warn('     ⚠️  fix-seo.mjs エラー（続行）');
}

// ── サマリー ─────────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ 記事組み立て完了!\n`);
console.log(`   URL: https://aliswipe.com/${category}/${slug}.html`);
console.log(`   ファイル: ${outPath}`);
console.log(`   タイトル: ${selectedTitle}`);
const byteSize = Buffer.byteLength(fullHtml, 'utf8');
console.log(`   サイズ: ${(byteSize / 1024).toFixed(1)} KB`);

// 残っているプレースホルダーを警告
const remainingPlaceholders = [...fullHtml.matchAll(/<!-- [A-Z_]+-(?:PLACEHOLDER|START|MISSING)[^>]* -->/g)].map(m => m[0]);
if (remainingPlaceholders.length > 0) {
  console.log(`\n⚠️  未埋めプレースホルダーが残っています:`);
  remainingPlaceholders.forEach(p => console.log(`  ${p}`));
}

console.log('\n' + '━'.repeat(60));
console.log(`\n▶ 次のステップ:`);
console.log(`  node scripts/step3-factcheck.mjs ${slug}`);
console.log(`  node scripts/gen-voices.mjs ${slug}`);
console.log(`  npm run gen-all`);
