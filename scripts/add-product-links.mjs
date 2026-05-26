/**
 * 全商品記事に product-link アンカーリンクを一括追加
 * - scroll-behavior: smooth + a.product-link CSS を注入
 * - 比較表のモデル名列 → 各製品セクションへのアンカーリンク
 * - li 要素内のモデル名 → 各製品セクションへのアンカーリンク
 */

import fs from 'fs';
import path from 'path';

const DIRS = ['public/gadget', 'public/game', 'public/outdoor'];

const NON_PRODUCT_KEYWORDS = [
  '比較', '選び方', 'よくある', 'まとめ', 'アリエクで', '選ぶポイント',
  '注意', 'セール', '安全', 'チェック', '購入方法', 'ガイド', 'の使い方',
  'レビューまとめ', '仕組み', 'について解説', 'ランキング外'
];

const CSS = `    html { scroll-behavior: smooth; }
    a.product-link { color: #2563eb; font-weight: 600; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
    a.product-link::after { font-size: 0.75em; opacity: 0.6; }
    a.product-link[data-dir="up"]::after { content: ' ↑'; }
    a.product-link[data-dir="down"]::after { content: ' ↓'; }
    .toc a.product-link::after { content: none; }
    a.product-link:hover { color: #1d4ed8; text-decoration-style: solid; }`;

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function getProductSections(content) {
  const result = [];
  const pattern = /<h2 id="(sec-(\d+))">([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const id = m[1];
    const num = parseInt(m[2]);
    const heading = stripHtml(m[3]);
    if (num === 1) continue;
    if (NON_PRODUCT_KEYWORDS.some(k => heading.includes(k))) continue;
    result.push({ id, num, heading });
  }
  return result.sort((a, b) => a.num - b.num);
}

function extractModelName(heading) {
  let name = heading.replace(/^【[^】]+】\s*/, '');
  if (name.includes('｜')) name = name.split('｜')[0];
  if (name.includes('|')) name = name.split('|')[0];
  return name.trim();
}

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  if (content.includes('scroll-behavior: smooth')) return 'skipped';

  // CSS 追加
  if (!content.includes('body { font-family')) return 'no-css-anchor';
  content = content.replace(/(    body \{ font-family)/, `${CSS}\n    body { font-family`);

  const productSections = getProductSections(content);
  if (productSections.length === 0) return 'no-sections';

  // 比較表: thead の1列目が「モデル名」系の表だけリンクを付ける
  const PRODUCT_TABLE_HEADERS = ['モデル', '製品', '商品', 'モデル名', '製品名'];
  let rowIndex = 0;
  content = content.replace(
    /(<thead>([\s\S]*?)<\/thead>\s*<tbody>)([\s\S]*?)(<\/tbody>)/g,
    (full, openWithHead, headContent, tbody, close) => {
      const firstTh = (headContent.match(/<th[^>]*>([\s\S]*?)<\/th>/) || [])[1] || '';
      const firstThText = firstTh.replace(/<[^>]+>/g, '').trim();
      if (!PRODUCT_TABLE_HEADERS.some(h => firstThText.includes(h))) return full;
      rowIndex = 0;
      const newTbody = tbody.replace(
        /(<tr[^>]*>)([\s\S]*?)(<\/tr>)/g,
        (trFull, trOpen, trContent, trClose) => {
          const sec = productSections[rowIndex++];
          if (!sec) return trFull;
          let done = false;
          const newTr = trContent.replace(
            /(<td[^>]*>)([\s\S]*?)(<\/td>)/,
            (tdFull, tdOpen, tdContent, tdClose) => {
              if (done || tdContent.includes('product-link')) return tdFull;
              done = true;
              const secPos = content.indexOf(`id="${sec.id}"`);
              const linkPos = full.length; // 比較表は記事上部にあるので基本 down
              const dir = (secPos === -1 || linkPos < secPos) ? 'down' : 'up';
              return `${tdOpen}<a href="#${sec.id}" class="product-link" data-dir="${dir}">${tdContent}</a>${tdClose}`;
            }
          );
          return `${trOpen}${newTr}${trClose}`;
        }
      );
      return `${openWithHead}${newTbody}${close}`;
    }
  );

  // li 内のモデル名にアンカーリンクを追加
  const modelMap = productSections
    .map(s => ({ id: s.id, name: extractModelName(s.heading) }))
    .filter(x => x.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length); // 長い名前から優先マッチ

  content = content.replace(
    /(<li[^>]*>)([\s\S]*?)(<\/li>)/g,
    (liFull, liOpen, liContent, liClose) => {
      if (liContent.includes('product-link')) return liFull;
      // TOCのli（既にアンカーリンクがある）はスキップ（ネストしたaタグ防止）
      if (liContent.includes('<a href="#')) return liFull;
      for (const { id, name } of modelMap) {
        if (liContent.includes(name)) {
          const secPos = content.indexOf(`id="${id}"`);
          const liPos = content.indexOf(liFull);
          const dir = (secPos === -1 || liPos < secPos) ? 'down' : 'up';
          const linked = liContent.replace(name, `<a href="#${id}" class="product-link" data-dir="${dir}">${name}</a>`);
          return `${liOpen}${linked}${liClose}`;
        }
      }
      return liFull;
    }
  );

  fs.writeFileSync(filepath, content, 'utf8');
  return 'updated';
}

// 実行
let updated = 0, skipped = 0;
const errors = [];

for (const dir of DIRS) {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();
  for (const file of files) {
    const result = processFile(path.join(dir, file));
    if (result === 'updated') {
      console.log(`✅ ${file}`);
      updated++;
    } else if (result === 'skipped') {
      console.log(`⏭  ${file}`);
      skipped++;
    } else {
      console.log(`⚠️  ${file} (${result})`);
      errors.push(`${file}: ${result}`);
    }
  }
}

console.log(`\n完了: ${updated} 更新, ${skipped} スキップ, ${errors.length} エラー`);
if (errors.length) console.log('エラー:', errors);
