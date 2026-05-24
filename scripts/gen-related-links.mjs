/**
 * gen-related-links.mjs
 * 各記事の <div class="related"> を同カテゴリ＋隣接カテゴリの記事リンクで自動更新
 * 内部リンクを最低5件に引き上げてSEOのクロール効率を改善する
 */
import fs from 'fs';
import path from 'path';

const PUBLIC = 'public';
const ARTICLE_DIRS = ['gadget', 'game', 'outdoor', 'guide', 'safety', 'payment', 'shipping'];
const SKIP = new Set(['admin', 'preview', 'template', 'nav', 'home', 'sitemap']);

// カテゴリ別の表示ラベル
const CATEGORY_LABEL = {
  gadget:   'ガジェット',
  game:     'ゲーム',
  outdoor:  'アウトドア',
  guide:    'ガイド',
  safety:   '安全性',
  payment:  '支払い',
  shipping: '配送・追跡',
};

// カテゴリ間の隣接定義（補完リンク先）
const ADJACENT = {
  gadget:   ['guide', 'payment'],
  game:     ['guide', 'payment'],
  outdoor:  ['guide', 'payment'],
  guide:    ['gadget', 'shipping', 'safety'],
  safety:   ['guide', 'shipping'],
  payment:  ['guide', 'shipping'],
  shipping: ['guide', 'safety'],
};

function extractTitle(html) {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (og) return og[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim();
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  return t ? t[1].trim().replace(/\s*\|\s*アリエクswipe.*$/, '').trim() : '';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// カテゴリ内の全記事を収集（新着順）
function collectArticles(folder) {
  const dir = path.join(PUBLIC, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && !SKIP.has(path.basename(f, '.html')))
    .map(f => {
      const slug = path.basename(f, '.html');
      const html = fs.readFileSync(path.join(dir, f), 'utf8');
      const mtime = fs.statSync(path.join(dir, f)).mtime;
      return { slug, folder, title: extractTitle(html), href: `/${folder}/${slug}.html`, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// 全記事インデックスを構築
const allArticles = {};
for (const folder of ARTICLE_DIRS) {
  allArticles[folder] = collectArticles(folder);
}

// 記事ごとの関連リンクを選定（自分自身を除く）
function pickRelated(selfSlug, selfFolder, count = 6) {
  const related = [];

  // 1. 同カテゴリから最大3件
  const sameCategory = allArticles[selfFolder].filter(a => a.slug !== selfSlug);
  related.push(...sameCategory.slice(0, 3));

  // 2. 隣接カテゴリから補完
  for (const adjFolder of (ADJACENT[selfFolder] || [])) {
    if (related.length >= count) break;
    const picks = allArticles[adjFolder] || [];
    related.push(...picks.slice(0, 2));
  }

  return related.slice(0, count);
}

// related-card HTML を生成
function makeRelatedCard({ folder, title, href }) {
  const tag = escHtml(CATEGORY_LABEL[folder] || folder);
  const t = escHtml(title);
  return `      <a href="${href}" class="related-card">
        <div class="rc-tag">${tag}</div>
        <div class="rc-title">${t}</div>
      </a>`;
}

// <div class="related">...</div> ブロックを見つけて終端インデックスを返す
function findRelatedBlock(html) {
  const start = html.indexOf('<div class="related">');
  if (start === -1) return null;
  // ネストに対応してdivを数える
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const nextOpen  = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

// related ブロックを生成
function buildRelatedBlock(cards) {
  return `<div class="related">
    <div class="related-title">関連記事</div>
    <div class="related-grid">
${cards.map(makeRelatedCard).join('\n')}
    </div>
  </div>`;
}

// ── メイン ──────────────────────────────────────────────────────
let updated = 0, skipped = 0;

for (const folder of ARTICLE_DIRS) {
  const dir = path.join(PUBLIC, folder);
  if (!fs.existsSync(dir)) continue;

  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html') || SKIP.has(path.basename(f, '.html'))) continue;
    const slug = path.basename(f, '.html');
    const fullPath = path.join(dir, f);
    let html = fs.readFileSync(fullPath, 'utf8');

    const related = pickRelated(slug, folder);
    if (related.length === 0) { skipped++; continue; }

    const block = findRelatedBlock(html);

    if (block) {
      // 既存ブロックを置き換え
      html = html.slice(0, block.start) + buildRelatedBlock(related) + html.slice(block.end);
    } else {
      // 関連セクションがない記事にはスーパーバイザーボックス直前に追加
      const supIdx = html.indexOf('<div class="supervisor-box">');
      if (supIdx !== -1) {
        html = html.slice(0, supIdx) + buildRelatedBlock(related) + '\n  ' + html.slice(supIdx);
      } else {
        // それもなければ </main> 直前
        const mainEnd = html.lastIndexOf('</main>');
        if (mainEnd !== -1) {
          html = html.slice(0, mainEnd) + '  ' + buildRelatedBlock(related) + '\n' + html.slice(mainEnd);
        } else {
          skipped++;
          continue;
        }
      }
    }

    fs.writeFileSync(fullPath, html, 'utf8');
    updated++;
    const linkCount = related.length;
    process.stdout.write(`✅ ${folder}/${f} (${linkCount}件)\n`);
  }
}

console.log(`\n完了: ${updated}件更新 / ${skipped}件スキップ`);
