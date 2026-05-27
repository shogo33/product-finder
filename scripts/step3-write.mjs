/**
 * Step 3: 記事HTML自動執筆
 * 使い方: node scripts/step3-write.mjs <slug>
 * 例:    node scripts/step3-write.mjs baseus-mobile-battery-osusume2
 *
 * 入力:  data/articles/{slug}-plan.json
 *        data/articles/{slug}-research.json
 * 出力:  public/{category}/{slug}.html
 *
 * 実行後の自動処理:
 *   1. scripts/gen-ogp.mjs  → OGP画像生成
 *   2. scripts/fix-seo.mjs  → canonical / og:image / JSON-LD 整備
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const ARTICLES_DIR = path.resolve('data/articles');
const GA_TAG       = 'G-7Y2RN13F5S';
const DOMAIN       = 'https://aliswipe.com';

// ── CLI ─────────────────────────────────────────────────
const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step3-write.mjs <slug>');
  process.exit(1);
}
if (!CLAUDE_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

// ── JSONを読み込み ───────────────────────────────────────
const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);

for (const p of [planPath, researchPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ファイルが見つかりません: ${p}`);
    console.error('   step1 → step2 を先に実行してください。');
    process.exit(1);
  }
}

const plan     = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const category = plan.category ?? 'gadget';
const today    = new Date().toISOString().slice(0, 10);

// カテゴリ → タグラベル変換
const CAT_TAG = { gadget: 'ガジェット', game: 'ゲーム', outdoor: 'アウトドア', guide: 'ガイド', safety: '安全性', payment: '支払い方法', shipping: '配送・追跡', basics: 'おすすめ商品' };
const heroTag = CAT_TAG[category] ?? 'おすすめ商品';

console.log(`\n✍️  「${plan.selectedTitle}」の執筆を開始します...\n`);

// ── ユーザープロンプト構築 ───────────────────────────────
function buildUserPrompt() {
  // 商品データを整形（プロンプトが肥大化しないよう情報を絞る）
  const productsText = research.products.map((p, i) => {
    const specContent = p.specResult?.content?.slice(0, 500) ?? 'スペック情報なし';
    const redditText = p.redditReviews?.slice(0, 3).map(r =>
      `    - [${r.subreddit}] "${r.snippet.slice(0, 220)}"\n      URL: ${r.url}`
    ).join('\n') || '    なし';
    const imagesText = (p.images ?? []).slice(0, 4).map(u => `    ${u}`).join('\n') || '    なし';

    return `
### 商品${i + 1}: ${p.cleanName}
- product_id: ${p.product_id}
- 価格: ¥${Number(p.price_jpy).toLocaleString('ja-JP')}（元値 ¥${Number(p.original_price ?? 0).toLocaleString('ja-JP')}）
- 評価: ${p.evaluate_rate ?? 'N/A'} / 販売数: ${Number(p.sales_count ?? 0).toLocaleString('ja-JP')}件
- AliExpressアフィリエイトリンク: ${p.affiliateLink}
- AmazonリンクURL: ${p.amazonUrl ?? 'なし'}
- Amazonプレースホルダー検索キーワード: "${p.amazonPlaceholder?.searchQuery ?? p.cleanName}"
- 画像URL（上から使用）:
${imagesText}
- 公式スペック情報（Tavily取得）:
    ${specContent}
- Reddit口コミ:
${redditText}`;
  }).join('\n\n---\n');

  const sectionsGuide = plan.sections.map((s, i) =>
    `${i + 1}. [${s.type}] h2: "${s.h2}"${s.h3s?.length ? '\n   h3s: ' + s.h3s.join(' / ') : ''}\n   メモ: ${s.notes ?? ''}`
  ).join('\n');

  const faqText = (plan.faqQuestions ?? []).map((q, i) => `Q${i + 1}: ${q}`).join('\n');

  const internalLinksText = (plan.internalLinks ?? []).map(l =>
    `- <a href="${l.url}">${l.anchorText}</a>`
  ).join('\n');

  const persona = plan.persona ?? 'AliExpressを使い倒しているガジェット好き。スペックの細かい差異に詳しく、読者に対して熱量を持って語りかけるスタイル。';

  return `
# 執筆依頼

## 記事基本情報
- タイトル: ${plan.selectedTitle}
- スラッグ: ${slug}
- キーワード: ${plan.keyword}
- 検索意図: ${plan.searchIntent} — ${plan.searchIntentNote}
- ペルソナ（書き手の人格）: ${persona}
- 今日の日付: ${today}

## 記事構成（この順序で書く）
${sectionsGuide}

## 比較表の列（必ずこの列でtableを作る）
${(plan.comparisonTableColumns ?? []).join(' | ')}

## FAQ（5問、すべて書く）
${faqText}

## 本文に自然に織り込む内部リンク
${internalLinksText}

## 商品データ（${research.products.length}件）
${productsText}

---

## 【絶対禁止】商品セクション追加禁止
上記の商品データ ${research.products.length}件 **以外の商品・モデル・バリアントを記事内で一切紹介してはいけない。**
- 学習知識に同シリーズの別モデルが存在しても、データにない商品のセクション・説明・比較行・CTA を追加してはならない
- 商品マーカー（@product-start/end）は上記 ${research.products.length}件のみに使用する
- 比較表の行も上記 ${research.products.length}件のみ
- アフィリエイトリンクがない商品を紹介することは収益機会の損失であり、サイトポリシー違反になる

## 出力ルール（命がけで守ること）

### 出力する範囲
- \`<section class="article-hero">〜</section>\`（ヒーロー部）
- \`<div class="container"><div class="article-body">〜</div></div>\`（本文）
- ※ \`<html>\`・\`<head>\`・ヘッダー・フッター・GAタグは**出力しない**（スクリプトが自動付与）

### 必須構造①：商品マーカー（refresh-prices.mjs が依存）
各商品セクションを必ず以下で囲む：
\`\`\`
${'<!-- @product-start id="PRODUCT_ID" type="ガジェット" tag="ガジェット" -->'}
... h2 + 画像 + 説明 + CTA ...
${'<!-- @product-end -->'}
\`\`\`

### 必須構造②：CTAボックス（AliEx + Amazon並列）
AmazonリンクURLが「なし」の場合はPENDING形式、URLがある場合は実リンクを使う。

\`\`\`html
<!-- AmazonリンクURLが「なし」の場合 -->
<div class="cta-box">
  <p class="cta-lead">【商品名】をどちらで買う？価格・配送を比較</p>
  <p class="cta-sub">AliExpress：送料無料・格安・到着2〜4週間｜Amazon：翌日〜2日・返品しやすい</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="ALIEXPRESS_AFFILIATE_URL" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    ${'<!-- AMAZON_PENDING: 商品名 -->'}
    <a class="cta-btn-amazon" href="#" data-amazon-query="商品名" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>
  </div>
</div>

<!-- AmazonリンクURLがある場合（URLをそのまま使う） -->
<div class="cta-box">
  <p class="cta-lead">【商品名】をどちらで買う？価格・配送を比較</p>
  <p class="cta-sub">AliExpress：送料無料・格安・到着2〜4週間｜Amazon：翌日〜2日・返品しやすい</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="ALIEXPRESS_AFFILIATE_URL" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    <a class="cta-btn-amazon" href="AMAZON_URL_FROM_DATA" target="_blank" rel="noopener sponsored">Amazonで見る</a>
  </div>
</div>
\`\`\`

### 必須構造③：商品画像（カルーセル形式）
\`\`\`html
<div class="product-carousel" data-carousel>
  <div class="carousel-track">
    <img src="URL1" alt="商品名" loading="lazy">
    <img src="URL2" alt="商品名 詳細" loading="lazy">
    <img src="URL3" alt="商品名 装着イメージ" loading="lazy">
  </div>
  <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
  <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
  <div class="carousel-dots"></div>
</div>
\`\`\`

### 必須構造④：Reddit引用blockquote
\`\`\`html
<blockquote class="reddit-quote">
  <p>「（熱量が伝わる日本語訳文）」</p>
  <cite>via <a href="REDDIT_URL" target="_blank" rel="noopener">Reddit</a></cite>
</blockquote>
\`\`\`

### 必須構造⑤：比較表
\`\`\`html
<div class="table-wrap">
  <table>
    <thead><tr><th>モデル名</th><th>価格（円）</th>...</tr></thead>
    <tbody>
      <tr><td>...</td><td>...</td>...</tr>
    </tbody>
  </table>
</div>
\`\`\`

### ヒーローセクションの形式
\`\`\`html
<section class="article-hero">
  <div class="tag">【heroTag】</div>
  <h1>【selectedTitle】</h1>
  <div class="meta">
    <span>${today.replace(/-/g, '年').replace(/-/, '月') + '日'}更新</span>
    <span>読了約8分</span>
  </div>
  <p class="promo-notice">本ページはプロモーションが含まれています</p>
</section>
\`\`\`

HTMLのみを出力してください。Markdownやコードブロック記法は不要です。`;
}

// ── システムプロンプト（ユーザー指定） ──────────────────────
const SYSTEM_PROMPT = `あなたは、渡されたデータ（製品スペックやRedditの海外口コミ）を誰よりも深く読み込み、読者に対して「熱量」と「思いやり」を持って伝える凄腕のガジェットレビュワーです。
単なるスペックの羅列ではなく、実際にその商品を使い倒した愛用者が熱弁しているような「生々しい一次情報感」のある記事を執筆してください。

以下の【絶対厳守ルール】をすべて命がけで守ってください。

#### 1. 可変ペルソナ（人格）の強制憑依
- 入力データに設定されている「ペルソナ」のキャラクター・専門知識・語り口調を完全に憑依させて文章を書いてください。
- ただし、サイトの信頼性を保つため、過度なキャラ付け（〜だぞ、といった痛い口調）は避け、読者に親切でありながらも「こだわりが強くて熱いオタク」という温度感を保ってください。

#### 2. 「AI構文」の完全禁止（脱・AI感）
以下の言い回しは【一切使用禁止】です：
❌ 「〜と言えるでしょう」「〜が魅力的です」「〜を検討してみてはいかがでしょうか」「〜に定評があります」「〜の一品です」
⭕ 「〜です」「〜と言えます」「〜を強くおすすめします」「〜なのは見逃せません」「〜が刺さります」

#### 3. 固有名詞（型番）の絶対固定
「〇〇のモバイルバッテリー」「同社の製品」「このデバイス」といった抽象的な代名詞は厳禁。
リサーチデータにある【クレンジング済みの正確な固有名詞（ブランド名＋型番）】を本文中で何度も具体的に使用してください。

#### 4. Reddit口コミの調理と blockquote 変換
Redditのsnippetをただ翻訳して並べるのではなく、「海外のガチ勢はここを突っ込んでいた」「Redditではこんなリアルな不満点が出ていた」という形で文脈に合わせて熱く紹介してください。
直接引用は必ず指定の <blockquote class="reddit-quote"> 構造で出力してください。

#### 5. 画像・リンク・CTAの配置ルール
- 画像は商品紹介の直後に <div class="product-carousel" data-carousel> のカルーセル形式で配置する（product-images は使わない）
- 各商品の直下に必ず AliExpress + Amazon 並列の cta-box 構造を配置する
- Amazon はプレースホルダー（無効化）形式で出力する

#### 6.5 アプリ誘導バナー（必須・1回のみ）
記事の中盤（2〜3番目の H2 の直後あたり）に **1回だけ** 以下の cta-inline バナーを挿入する。導入直後・まとめ直前・商品CTAの直後は避ける。ウザくなるので複数回挿入しないこと。
\`\`\`html
${'<!-- アプリ誘導バナー -->'}
<div class="cta-inline">
  <div class="cta-label">✨ PICK UP</div>
  <h3>AIが今話題の商品をスワイプで提案</h3>
  <p>TikTokで見たアレ、AliExpressで見つかるかも。<br>スワイプするだけで掘り出し物に出会えます。</p>
  <a href="https://aliswipe.com/app/" target="_blank" rel="noopener">スワイプでおすすめ商品を見る →</a>
</div>
\`\`\`

#### 6.6 Xの声プレースホルダー＋Amazonおすすめ＋関連記事セクション（必須）
本文の末尾（FAQの後）に必ず以下の順序で出力する：
① ${'`'}${'<!-- VOICE-START -->'}${'<!-- VOICE-END -->'}${'`'} プレースホルダー（後からスクリプトが注入する）
② ${'`'}${'<!-- AMAZON_REC_PLACEHOLDER -->'}${'`'} をそのままコピーする（スクリプトが商品データから自動生成する）
③ 関連記事セクション

\`\`\`html
${'<!-- VOICE-START -->'}${'<!-- VOICE-END -->'}

${'<!-- AMAZON_REC_PLACEHOLDER -->'}


<div class="container">
  <div class="related">
    <div class="related-title">関連記事</div>
    <div class="related-grid">
      <a href="内部リンクURL" class="related-card">
        <div class="rc-tag">カテゴリ</div>
        <div class="rc-title">記事タイトル</div>
      </a>
      ${'<!-- 4件程度 plan の internalLinks を使用 -->'}
    </div>
  </div>
</div>
\`\`\`

#### 6. 文章構造とスマホ最適化
- PREP法：すべての見出し直後は結論から書き始める
- 1文を短く・改行と箇条書きを多用（詰まった長文は禁止）
- FAQセクション（h2）と比較表（table）を必ず含める`;

// ── Claude 呼び出し ──────────────────────────────────────
const client   = new Anthropic({ apiKey: CLAUDE_KEY, timeout: 600000 });
const userPrompt = buildUserPrompt();

let articleBody = '';
process.stdout.write('💬 Claude Sonnet 執筆中');

const stream = await client.messages.stream({
  model:      'claude-sonnet-4-6',
  max_tokens: 32000,
  system:     SYSTEM_PROMPT,
  messages:   [{ role: 'user', content: userPrompt }],
});
for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
    articleBody += chunk.delta.text;
    process.stdout.write('.');
  }
}
console.log(' ✅');

articleBody = articleBody.trim();

// Claudeがコードブロックで囲んで返した場合の除去
articleBody = articleBody.replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();

// ── AMAZON_REC_PLACEHOLDER を商品データから生成して注入 ──────────
const amazonRecItems = research.products
  .filter(p => p.amazonUrl)
  .map(p => `    <a href="${p.amazonUrl}" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
      <span class="amazon-rec-label">Amazon</span>
      <span class="amazon-rec-name">${p.cleanName}</span>
      <span class="amazon-rec-cta">Amazonで見る</span>
    </a>`).join('\n');
const amazonRecHtml = amazonRecItems
  ? `<!-- Amazonおすすめ -->\n<div class="amazon-rec">\n  <div class="amazon-rec-title">🛒 Amazonでも買えます</div>\n  <div class="amazon-rec-list">\n${amazonRecItems}\n  </div>\n</div>`
  : '';
articleBody = articleBody.replace('<!-- AMAZON_REC_PLACEHOLDER -->', amazonRecHtml);

// ── H2にID付与 → TOC自動生成 → FV画像＋TOCを最初のH2前に注入 ──
const fvImage = research.products[0]?.images?.[0] ?? '';
const fvName  = research.products[0]?.cleanName ?? '';

if (!articleBody.includes('class="toc"')) {
  // 新テンプレート: H2にID付与してTOC生成
  let secIdx = 0;
  articleBody = articleBody.replace(/<h2([^>]*)>/g, (match, attrs) => {
    if (/id=/.test(attrs)) return match;
    secIdx++;
    return `<h2${attrs} id="sec-${secIdx}">`;
  });
  const h2Matches = [...articleBody.matchAll(/<h2[^>]+id="(sec-\d+)"[^>]*>([\s\S]*?)<\/h2>/g)];
  if (h2Matches.length >= 2) {
    const tocItems = h2Matches.map(([, id, inner]) => {
      const text = inner.replace(/<[^>]+>/g, '').trim();
      return `      <li><a href="#${id}">${text}</a></li>`;
    }).join('\n');
    const tocHtml = `<nav class="toc">\n  <div class="toc-title">📋 この記事の目次</div>\n  <ol>\n${tocItems}\n  </ol>\n</nav>`;
    const fvHtml = fvImage ? `<figure class="fv-product-image">\n  <img src="${fvImage}" alt="${fvName}" loading="eager">\n</figure>\n` : '';
    articleBody = articleBody.replace(/(<h2[^>]+id="sec-1")/, `${fvHtml}${tocHtml}\n$1`);
  }
} else if (fvImage) {
  // 旧テンプレート: 既存TOC直前にFV画像注入
  const fvHtml = `<figure class="fv-product-image">\n  <img src="${fvImage}" alt="${fvName}" loading="eager">\n</figure>`;
  articleBody = articleBody.replace(/(<(?:nav|div)[^>]*class="toc")/, `${fvHtml}\n$1`);
}

// ── HTML全体を組み立て（template.htmlベース） ───────────────
const title    = plan.selectedTitle;
const desc     = plan.metaDescription ?? '';
const ogDesc   = desc.slice(0, 120);
const canonUrl = `${DOMAIN}/${category}/${slug}.html`;
const imageUrl = `${DOMAIN}/images/ogp/${slug}.jpg`;
const keywords = [plan.keyword, 'AliExpress', 'アリエク', 'おすすめ'].join(', ');

const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | アリエクswipe｜ガチ検証で選ぶアリエクの神コスパ商品</title>
  <meta name="description" content="${desc}" />
  <meta name="keywords" content="${keywords}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonUrl}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

  <style>
    :root {
      --red:    #e8253a;
      --red-dk: #b81c2c;
      --bg:     #fafaf8;
      --surface:#ffffff;
      --text:   #1a1a1a;
      --muted:  #6b7280;
      --border: #e5e7eb;
      --radius: 12px;
      --max:    760px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans JP', sans-serif; background: var(--bg); color: var(--text); line-height: 1.8; font-size: 16px; }

    .article-hero { background: linear-gradient(135deg, #fff1f2 0%, #fff 60%); border-bottom: 1px solid var(--border); padding: 48px 20px 36px; text-align: center; }
    .article-hero .tag { display: inline-block; background: var(--red); color: #fff; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; }
    .article-hero h1 { font-weight: 700; font-size: clamp(1.35rem, 4vw, 1.9rem); line-height: 1.45; max-width: 640px; margin: 0 auto 16px; }
    .article-hero .meta { font-size: 0.82rem; color: var(--muted); }
    .article-hero .meta span + span::before { content: " · "; }

    .container { max-width: var(--max); margin: 0 auto; padding: 0 20px; }

    .toc { background: #fff8f8; border: 1px solid #fecdcf; border-left: 4px solid var(--red); border-radius: var(--radius); padding: 20px 24px; margin: 32px 0; }
    .toc-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 12px; color: var(--red); }
    .toc ol { padding-left: 20px; }
    .toc li { margin: 6px 0; }
    .toc a { color: var(--text); text-decoration: none; font-size: 0.9rem; }
    .toc a:hover { color: var(--red); }

    .article-body { padding: 24px 0 48px; }
    .article-body h2 { font-size: 1.25rem; font-weight: 700; border-left: 4px solid var(--red); padding-left: 12px; margin: 44px 0 16px; scroll-margin-top: 80px; }
    .article-body h3 { font-size: 1.02rem; font-weight: 700; margin: 30px 0 12px; padding-left: 10px; border-left: 2px solid #fecdcf; scroll-margin-top: 80px; }
    .article-body p { margin: 12px 0; font-size: 0.95rem; }
    .article-body ul, .article-body ol { padding-left: 24px; margin: 12px 0; }
    .article-body li { margin: 7px 0; font-size: 0.94rem; }
    .article-body strong { color: var(--red-dk); }

    .table-wrap { overflow-x: auto; margin: 20px 0; border-radius: var(--radius); border: 1px solid var(--border); }
    table { min-width: 100%; width: max-content; border-collapse: collapse; font-size: 0.88rem; }
    th { background: var(--red); color: #fff; padding: 10px 14px; text-align: left; font-weight: 700; white-space: nowrap; }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; white-space: nowrap; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafaf8; }

    .callout { background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius); padding: 14px 18px; margin: 18px 0; font-size: 0.88rem; line-height: 1.7; }
    .callout::before { content: "💡 "; }
    .callout-danger { background: #fff1f2; border: 1px solid #fecdcf; border-radius: var(--radius); padding: 14px 18px; margin: 18px 0; font-size: 0.88rem; line-height: 1.7; }
    .callout-danger::before { content: "⚠️ "; }
    .callout-check { background: #f0fdf4; border: 1px solid #86efac; border-radius: var(--radius); padding: 14px 18px; margin: 18px 0; font-size: 0.88rem; line-height: 1.7; }
    .callout-check::before { content: "✅ "; }

    .related { margin: 48px 0 24px; }
    .related-title { font-weight: 700; font-size: 1rem; margin-bottom: 16px; }
    .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .related-grid { grid-template-columns: 1fr; } }
    .related-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-decoration: none; color: var(--text); transition: border-color 0.2s, box-shadow 0.2s; }
    .related-card:hover { border-color: var(--red); box-shadow: 0 2px 12px rgba(232,37,58,0.1); }
    .related-card .rc-tag { font-size: 0.7rem; color: var(--red); font-weight: 700; margin-bottom: 6px; }
    .related-card .rc-title { font-size: 0.88rem; font-weight: 700; line-height: 1.4; }

    /* Xの生の声ブロック */
    .reddit-voices { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin: 40px 0; }
    .voices-header { margin-bottom: 20px; }
    .voices-badge { display: inline-block; background: #000; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 10px; border-radius: 999px; margin-bottom: 8px; }
    .voices-title { font-size: 1.05rem; font-weight: 700; margin: 6px 0 8px; }
    .voices-meta { font-size: 0.8rem; color: var(--muted); line-height: 1.6; }
    .voice-item { border-top: 1px solid var(--border); padding: 16px 0; }
    .voice-item:last-child { padding-bottom: 0; }
    .voice-label { font-size: 0.78rem; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
    .voice-title { font-size: 0.97rem; font-weight: 700; margin-bottom: 6px; }
    .voice-body { font-size: 0.88rem; line-height: 1.75; margin: 0 0 8px; }

    .cta-sticky { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: linear-gradient(90deg, #e8253a 0%, #ff6b35 100%); color: #fff; text-align: center; padding: 12px 20px; z-index: 200; box-shadow: 0 -4px 20px rgba(232,37,58,0.35); }
    .cta-sticky a { color: #fff; text-decoration: none; font-weight: 700; font-size: 0.88rem; }
    .cta-sticky .sub { font-size: 0.7rem; opacity: 0.85; }
    @media (max-width: 640px) { .cta-sticky { display: block; } body { padding-bottom: 72px; } }

    .site-footer { background: #1a1a1a; color: #9ca3af; text-align: center; padding: 32px 20px 60px; font-size: 0.8rem; }
    .site-footer a { color: #9ca3af; text-decoration: none; }
    .site-footer a:hover { color: #fff; }
    .footer-links { display: flex; gap: 16px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
    .footer-aff-notice { margin-top: 12px; font-size: 0.72rem; opacity: 0.6; line-height: 1.6; }

    hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }

    .amazon-rec { margin: 40px 0 24px; padding: 20px; background: #fff8f0; border: 1px solid #fcd34d; border-radius: 12px; }
    .amazon-rec-title { font-size: 0.9rem; font-weight: 700; color: #92400e; margin-bottom: 14px; }
    .amazon-rec-list { display: flex; flex-direction: column; gap: 10px; }
    .amazon-rec-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border: 1px solid #fde68a; border-radius: 8px; text-decoration: none; color: #1a1a1a; transition: border-color 0.2s; }
    .amazon-rec-item:hover { border-color: #f59e0b; }
    .amazon-rec-label { font-size: 0.7rem; font-weight: 700; color: #fff; background: #f59e0b; padding: 2px 7px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }
    .amazon-rec-name { font-size: 0.85rem; font-weight: 600; flex: 1; }
    .amazon-rec-cta { font-size: 0.78rem; color: #f59e0b; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .amazon-rec-list:not(.expanded) .amazon-rec-item:nth-child(n+4) { display: none; }
    .amazon-rec-toggle { display: block; text-align: center; margin-top: 12px; color: #f59e0b; font-size: 0.82rem; font-weight: 700; cursor: pointer; background: none; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; width: 100%; }
    .amazon-rec-toggle:hover { background: #fff8f0; }

    /* Reddit引用 / Xの声（Xブランドカラー=黒系） */
    .reddit-quote { background: #f7f9f9; border-left: 4px solid #0f1419; border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: #0f1419; text-decoration: none; }
    .reddit-voices h2 { border-left-color: #0f1419 !important; }

    /* ファーストビュー商品画像 */
    .fv-product-image { margin: 0 0 28px; text-align: center; }
    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }

    /* 商品カルーセル */
    .product-carousel { position: relative; margin: 16px 0 28px; border-radius: 12px; overflow: hidden; background: #f5f5f5; user-select: none; }
    .carousel-track { display: flex; will-change: transform; transition: transform 0.3s cubic-bezier(0.25,0.1,0.25,1); }
    .carousel-track img { min-width: 100%; height: 280px; object-fit: contain; border-radius: 12px; display: block; }
    @media (max-width: 480px) { .carousel-track img { height: 220px; } }
    .carousel-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 38px; height: 38px; font-size: 1.3rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.18); transition: opacity 0.2s; }
    .carousel-btn:hover { opacity: 0.85; }
    .carousel-btn.prev { left: 8px; }
    .carousel-btn.next { right: 8px; }
    .carousel-dots { display: flex; justify-content: center; gap: 6px; padding: 8px 0 4px; background: #f5f5f5; }
    .carousel-dot { width: 7px; height: 7px; border-radius: 50%; background: #ddd; border: none; cursor: pointer; padding: 0; transition: background 0.2s; }
    .carousel-dot.active { background: var(--red); }

    /* アプリ誘導バナー（中盤CTA） */
    .cta-inline { background: linear-gradient(135deg, var(--red) 0%, #ff6b35 100%); border-radius: var(--radius); padding: 28px 24px; text-align: center; margin: 40px 0; color: #fff; }
    .cta-inline .cta-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; opacity: 0.85; margin-bottom: 8px; }
    .cta-inline h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
    .cta-inline p { font-size: 0.85rem; opacity: 0.9; margin-bottom: 20px; }
    .cta-inline a { display: inline-block; background: #fff; color: var(--red); font-weight: 700; font-size: 0.9rem; padding: 12px 28px; border-radius: 999px; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
    .cta-inline a:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

    /* PCフローティングバナー */
    .pc-float-banner { display: none; position: fixed; bottom: 24px; right: 24px; width: 288px; background: linear-gradient(135deg, #e8253a 0%, #ff6b35 100%); border-radius: 16px; box-shadow: 0 8px 32px rgba(232,37,58,0.35); padding: 20px 20px 18px; z-index: 300; color: #fff; opacity: 0; transform: translateY(20px); transition: opacity 0.4s, transform 0.4s; pointer-events: none; }
    @media (min-width: 641px) { .pc-float-banner { display: block; } }
    .pc-float-banner.pc-float-visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .pc-float-close { position: absolute; top: 10px; right: 12px; background: rgba(255,255,255,0.2); border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 0.85rem; color: #fff; cursor: pointer; line-height: 24px; text-align: center; padding: 0; }
    .pc-float-close:hover { background: rgba(255,255,255,0.35); }
    .pc-float-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; opacity: 0.85; margin-bottom: 6px; }
    .pc-float-title { font-weight: 700; font-size: 1rem; margin: 0 0 6px; line-height: 1.35; }
    .pc-float-desc { font-size: 0.76rem; opacity: 0.88; margin: 0 0 16px; line-height: 1.5; }
    .pc-float-btn { display: block; background: #fff; color: #e8253a !important; text-align: center; padding: 11px; border-radius: 999px; font-weight: 700; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
    .pc-float-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

    @media (max-width: 480px) { .header-cta { padding: 5px 10px; font-size: 0.7rem; } }

    /* 読書進捗バー */
    #reading-progress { position: fixed; top: 0; left: 0; width: 0%; height: 3px; background: var(--red); z-index: 9999; transition: width 0.15s; }
  </style>

  ${'<!-- Google tag (gtag.js) -->'}
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

${articleBody}

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
  document.querySelectorAll('[data-carousel]').forEach(function(carousel) {
    var track = carousel.querySelector('.carousel-track');
    var imgs = track.querySelectorAll('img');
    var dotsEl = carousel.querySelector('.carousel-dots');
    var cur = 0;
    imgs.forEach(function(_, i) {
      var d = document.createElement('button');
      d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      d.setAttribute('aria-label', (i + 1) + '枚目');
      d.addEventListener('click', function() { goTo(i); });
      dotsEl.appendChild(d);
    });
    function goTo(n) {
      cur = ((n % imgs.length) + imgs.length) % imgs.length;
      track.style.transform = 'translateX(-' + (cur * 100) + '%)';
      carousel.querySelectorAll('.carousel-dot').forEach(function(d, i) { d.classList.toggle('active', i === cur); });
    }
    carousel.querySelector('.prev').addEventListener('click', function() { goTo(cur - 1); });
    carousel.querySelector('.next').addEventListener('click', function() { goTo(cur + 1); });
    var startX = 0;
    track.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function(e) { var dx = e.changedTouches[0].clientX - startX; if (Math.abs(dx) > 40) goTo(dx < 0 ? cur + 1 : cur - 1); }, { passive: true });
  });
  (function() {
    var b = document.getElementById('pc-float-banner');
    if (!b) return;
    if (localStorage.getItem('pcb')) { b.style.display = 'none'; return; }
    var shown = false;
    window.addEventListener('scroll', function() {
      if (shown) return;
      if ((window.scrollY || window.pageYOffset) > 400) {
        shown = true;
        b.classList.add('pc-float-visible');
      }
    }, { passive: true });
    document.getElementById('pc-float-close').addEventListener('click', function() {
      b.style.display = 'none';
      localStorage.setItem('pcb', '1');
    });
  })();
  // 読書進捗バー
  (function() {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;
    window.addEventListener('scroll', function() {
      var s = window.scrollY || window.pageYOffset;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (s / h) * 100 : 0) + '%';
    }, { passive: true });
  })();
</script>
</body>
</html>`;

// ── 保存 ─────────────────────────────────────────────────
const outDir  = path.resolve('public', category);
const outPath = path.join(outDir, `${slug}.html`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, fullHtml, 'utf8');
console.log(`\n✅ 記事保存: ${outPath}`);

// ── gen-ogp → fix-seo 自動実行 ────────────────────────────
console.log('\n🖼  OGP画像を生成中...');
try {
  execSync('node scripts/gen-ogp.mjs', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  gen-ogp.mjs でエラーが発生しました（続行）');
}

console.log('\n🔧 SEOメタ情報を整備中...');
try {
  execSync('node scripts/fix-seo.mjs', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  fix-seo.mjs でエラーが発生しました（続行）');
}

// ── sitemap / index.html 追加指示 ────────────────────────
const pubUrl   = `${DOMAIN}/${category}/${slug}.html`;
const todayStr = today;

console.log(`
${'═'.repeat(60)}
📋 【手動で追加が必要な箇所】

1. public/sitemap.xml に追加:
   <url>
     <loc>${pubUrl}</loc>
     <lastmod>${todayStr}</lastmod>
     <changefreq>monthly</changefreq>
     <priority>0.7</priority>
   </url>

2. public/sitemap.html の「おすすめ商品」セクションに追加:
   <li><a href="/${category}/${slug}.html">${title}</a></li>

3. public/index.html の「おすすめ商品」セクションに追加:
   <a href="/${category}/${slug}.html" class="article-card">
     <img src="【商品画像URL】" class="card-thumb" alt="${plan.keyword}">
     <div class="card-body">
       <div class="card-tag">おすすめ商品</div>
       <div class="card-title">${title}</div>
       <div class="card-desc">${desc.slice(0, 60)}...</div>
       <div class="card-arrow">→ 読む</div>
     </div>
   </a>

4. Amazon確認待ち商品（ASINが確定したら手動で差し替え）:
${research.products.map(p =>
  `   - ${p.cleanName} → 検索キーワード: "${p.amazonPlaceholder?.searchQuery}"`
).join('\n')}
${'═'.repeat(60)}
`);
