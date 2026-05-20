/**
 * カテゴリ別「もっと見る」アフィリエイトリンクをHTMLに挿入するスクリプト
 */
import fs from 'fs';
import path from 'path';

const FILE = path.resolve('public/basics/aliexpress-osusume.html');

const LINKS = {
  'ガジェット':         'https://s.click.aliexpress.com/e/_c3z5m8PJ',
  'PC周辺機器':         'https://s.click.aliexpress.com/e/_c4caEIhT',
  'スマホアクセサリー': 'https://s.click.aliexpress.com/e/_c3uCqdMz',
  'スマートホーム':     'https://s.click.aliexpress.com/e/_c3ychZZP',
  'フィットネス':       'https://ja.aliexpress.com/w/wholesale-fitness.html?SearchText=fitness+equipment&sortType=total_tranRanking_desc',
  'キッチン':           'https://s.click.aliexpress.com/e/_c2R2sqTr',
  'アウトドア':         'https://s.click.aliexpress.com/e/_c3MY5T5f',
  'トラベル':           'https://ja.aliexpress.com/w/wholesale-travel-accessories.html?SearchText=travel+accessories&sortType=total_tranRanking_desc',
  'ペット':             'https://s.click.aliexpress.com/e/_c3MKkWJR',
  'カー用品':           'https://s.click.aliexpress.com/e/_c3JgfUz7',
  'ボードゲーム':       'https://s.click.aliexpress.com/e/_c4m5aEad',
  'キッズ':             'https://s.click.aliexpress.com/e/_c3wKNNs9',
  'アート・クラフト':   'https://s.click.aliexpress.com/e/_c3Y7OpZJ',
  '文具':               'https://s.click.aliexpress.com/e/_c3BlhJNP',
  'インテリア':         'https://s.click.aliexpress.com/e/_c4BuS8oD',
  '健康':               'https://s.click.aliexpress.com/e/_c4r4cVCV',
};

const CATEGORIES = Object.keys(LINKS);
// 次カテゴリの区切りに使えるマーカーリスト（カテゴリ名コメント）
const NEXT_MARKERS = [
  ...CATEGORIES.map(c => `<!-- ===== ${c} ===== -->`),
  '<div class="cta-app">',
  '<hr>',
];

let html = fs.readFileSync(FILE, 'utf8');
let replaced = 0;

for (const cat of CATEGORIES) {
  const link = LINKS[cat];
  const catComment = `<!-- ===== ${cat} ===== -->`;
  const catIdx = html.indexOf(catComment);
  if (catIdx === -1) { console.log(`⚠️ コメント見つからず: ${cat}`); continue; }

  // 次のカテゴリ区切りの位置を探す
  let nextIdx = html.length;
  for (const marker of NEXT_MARKERS) {
    if (marker === catComment) continue;
    const mi = html.indexOf(marker, catIdx + catComment.length);
    if (mi > catIdx && mi < nextIdx) nextIdx = mi;
  }

  const block = html.slice(catIdx, nextIdx);

  // このブロック内の最後の <!-- @product-end --> を探す
  const lastPE = block.lastIndexOf('<!-- @product-end -->');
  if (lastPE === -1) { console.log(`⚠️ @product-end見つからず: ${cat}`); continue; }

  // @product-end の後の "\n    </div>" (product-gridのclose) を探す
  const afterPE = block.slice(lastPE + '<!-- @product-end -->'.length);
  const gridCloseMatch = afterPE.match(/^(\n    <\/div>)/);
  if (!gridCloseMatch) {
    console.log(`⚠️ グリッドclose見つからず: ${cat} — after: ${JSON.stringify(afterPE.slice(0,50))}`);
    continue;
  }

  // 挿入位置: catIdx + lastPE + "<!-- @product-end -->" + gridClose の直後
  const insertPos = catIdx + lastPE + '<!-- @product-end -->'.length + gridCloseMatch[0].length;

  const moreBtn = `\n    <div class="cat-more">\n      <a href="${link}" target="_blank" rel="noopener sponsored" class="cat-more-btn">${cat}の商品をもっと見る →</a>\n    </div>`;

  html = html.slice(0, insertPos) + moreBtn + html.slice(insertPos);
  replaced++;
  console.log(`✅ [${cat}]`);
}

fs.writeFileSync(FILE, html, 'utf8');
console.log(`\n💾 保存完了: ${replaced}件挿入`);
