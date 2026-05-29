/**
 * step4-related.mjs
 * 完成HTML に関連記事ブロックを挿入・強化する（単体記事向け）
 *
 * 使い方: node scripts/step4-related.mjs <slug>
 * 例:    node scripts/step4-related.mjs gamesir-t4-pro-osusume
 *
 * 入力:  public/{category}/{slug}.html
 *        data/articles/{slug}-plan.json（内部リンク候補）
 *        data/articles/{slug}-kw.json（あれば、キーワード関連性で選定強化）
 * 出力:  public/{category}/{slug}.html（上書き）
 *
 * 処理内容:
 *   1. 既存の関連記事ブロックを確認
 *   2. 件数が5件未満なら既存の公開記事から関連性の高い記事を追加
 *   3. 本文中の内部リンクが3件未満なら自然な位置にリンクを追加
 *      （Claudeを使わず、キーワードマッチングで判断）
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');
const PUBLIC_DIR   = path.resolve('public');
const CATEGORIES   = ['gadget', 'game', 'outdoor', 'guide', 'safety', 'payment', 'shipping', 'basics'];

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step4-related.mjs <slug>');
  process.exit(1);
}

const planPath = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const kwPath   = path.join(ARTICLES_DIR, `${slug}-kw.json`);
const plan     = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : {};
const kw       = fs.existsSync(kwPath)   ? JSON.parse(fs.readFileSync(kwPath,   'utf8')) : null;

const category = plan.category ?? 'gadget';
const htmlPath = path.resolve('public', category, `${slug}.html`);

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ HTMLが見つかりません: ${htmlPath}`);
  process.exit(1);
}

console.log(`\n🔗 step4-related: ${slug}\n`);

let html = fs.readFileSync(htmlPath, 'utf8');

// ── 既存の公開記事一覧を収集 ─────────────────────────────────
function collectArticles() {
  const articles = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(PUBLIC_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.html') || file === `${slug}.html` || file === 'index.html') continue;
      const filePath = path.join(dir, file);
      const content  = fs.readFileSync(filePath, 'utf8');
      const titleM   = content.match(/<title>([\s\S]*?)<\/title>/);
      const h1M      = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const kwM      = content.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
      if (!titleM) continue;
      const title = (h1M?.[1] ?? titleM[1])
        .replace(/<[^>]+>/g, '').replace(/\s*\|.*$/, '').trim();
      articles.push({
        url:      `/${cat}/${file}`,
        title,
        category: cat,
        keywords: kwM?.[1] ?? '',
      });
    }
  }
  return articles;
}

// ── キーワード関連スコア計算 ─────────────────────────────────
function calcRelevanceScore(article, targetKeywords) {
  const combined = `${article.title} ${article.keywords} ${article.url}`.toLowerCase();
  let score = 0;
  for (const kw of targetKeywords) {
    if (combined.includes(kw.toLowerCase())) score += 1;
  }
  // 同カテゴリはボーナス
  if (article.category === category) score += 0.5;
  return score;
}

// ── 関連記事選定 ─────────────────────────────────────────────
const allArticles = collectArticles();
console.log(`  公開記事: ${allArticles.length}件 を検索`);

// ターゲットキーワード（メインKW + plan.keyword + subKW）
const targetKeywords = [
  ...(plan.keyword?.split(/[\s　]+/) ?? []),
  ...(kw?.mainKws?.map(k => k.keyword) ?? []),
  ...(kw?.subKws?.slice(0, 5).map(k => k.keyword) ?? []),
];

// 既存のplan.internalLinksを優先
const existingLinks = (plan.internalLinks ?? []).map(l => l.url);

// スコアでソートして上位6件を選定
const scored = allArticles
  .filter(a => !existingLinks.includes(a.url))
  .map(a => ({ ...a, score: calcRelevanceScore(a, targetKeywords) }))
  .filter(a => a.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 6);

// planのinternalLinksと結合（最大6件）
const allLinks = [
  ...(plan.internalLinks ?? []).map(l => ({
    url: l.url, title: l.anchorText,
    category: l.url?.split('/')[1] ?? 'gadget', score: 99
  })),
  ...scored,
].slice(0, 6);

console.log(`  関連記事候補: ${allLinks.length}件`);
allLinks.forEach((l, i) => console.log(`    ${i+1}. ${l.title} (${l.url})`));

// ── 関連記事ブロックのHTML生成 ────────────────────────────────
function buildRelatedGrid(links) {
  if (links.length === 0) return '';
  const CAT_TAG = {
    gadget: 'ガジェット', game: 'ゲーム', outdoor: 'アウトドア',
    guide: 'ガイド', safety: '安全性', payment: '支払い方法',
    shipping: '配送・追跡', basics: 'おすすめ商品',
  };
  const cards = links.map(l => {
    const cat = l.url?.split('/')?.[1] ?? 'gadget';
    const tag = CAT_TAG[cat] ?? 'おすすめ';
    return `      <a href="${l.url}" class="related-card">
        <div class="rc-tag">${tag}</div>
        <div class="rc-title">${l.title}</div>
      </a>`;
  }).join('\n');
  return `<div class="container">
  <div class="related">
    <div class="related-title">関連記事</div>
    <div class="related-grid">
${cards}
    </div>
  </div>
</div>`;
}

// ── HTML内の関連記事ブロックを確認・更新 ─────────────────────
const existingRelated = html.match(/<div[^>]*class="related"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
const currentCardCount = existingRelated
  ? (existingRelated[0].match(/class="related-card"/g) ?? []).length
  : 0;

console.log(`\n  現在の関連記事カード数: ${currentCardCount}件`);

if (allLinks.length > currentCardCount) {
  const newRelatedBlock = buildRelatedGrid(allLinks);

  if (existingRelated) {
    // 既存ブロックを置換
    html = html.replace(existingRelated[0], newRelatedBlock);
    console.log(`  ✅ 関連記事ブロックを更新: ${currentCardCount}件 → ${allLinks.length}件`);
  } else if (html.includes('<!-- RELATED_PLACEHOLDER -->')) {
    html = html.replace('<!-- RELATED_PLACEHOLDER -->', newRelatedBlock);
    console.log(`  ✅ 関連記事ブロックを注入: ${allLinks.length}件`);
  } else {
    // VOICEブロックの後ろ / site-footerの前に挿入
    const insertBefore = html.includes('<footer class="site-footer"')
      ? '<footer class="site-footer"'
      : '</body>';
    html = html.replace(insertBefore, `${newRelatedBlock}\n\n${insertBefore}`);
    console.log(`  ✅ 関連記事ブロックを末尾に追加: ${allLinks.length}件`);
  }
} else {
  console.log(`  ✅ 関連記事は既に${currentCardCount}件あります（更新不要）`);
}

// ── 保存 ─────────────────────────────────────────────────────
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n' + '━'.repeat(60));
console.log(`✅ step4-related 完了: ${htmlPath}\n`);
console.log(`▶ 次のステップ:`);
console.log(`  node scripts/step3-factcheck.mjs ${slug}`);
console.log(`  node scripts/gen-voices.mjs ${slug}`);
console.log(`  npm run gen-all\n`);
