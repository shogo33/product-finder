/**
 * 非商品テーブル（スペック表・ショートカット表・ゲーム互換表など）の
 * 誤った product-link アンカーを除去する一回限りのクリーンアップスクリプト
 */
import fs from 'fs';
import path from 'path';

const DIRS = ['public/gadget', 'public/game', 'public/outdoor'];

// 比較表と判断する thead 1列目のキーワード（これ以外はリンクを除去）
const PRODUCT_TABLE_HEADERS = ['モデル', '製品', '商品', 'モデル名', '製品名'];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;

  // thead + tbody のペアを探して、非商品表のリンクを除去
  content = content.replace(
    /(<thead>([\s\S]*?)<\/thead>)([\s\S]*?)(<tbody>)([\s\S]*?)(<\/tbody>)/g,
    (full, thead, headContent, between, tbodyOpen, tbody, tbodyClose) => {
      const firstTh = (headContent.match(/<th[^>]*>([\s\S]*?)<\/th>/) || [])[1] || '';
      const firstThText = stripHtml(firstTh);
      // 商品比較表ならそのまま
      if (PRODUCT_TABLE_HEADERS.some(h => firstThText.includes(h))) return full;

      // 非商品表: product-link アンカーを外してテキストだけ残す
      const cleanTbody = tbody.replace(
        /<a href="#[^"]*" class="product-link">([\s\S]*?)<\/a>/g,
        (_, inner) => { changed = true; return inner; }
      );
      return `${thead}${between}${tbodyOpen}${cleanTbody}${tbodyClose}`;
    }
  );

  if (changed) {
    fs.writeFileSync(filepath, content, 'utf8');
    return 'fixed';
  }
  return 'ok';
}

let fixed = 0;
for (const dir of DIRS) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const file of files) {
    const result = processFile(path.join(dir, file));
    if (result === 'fixed') {
      console.log(`✅ ${file}`);
      fixed++;
    }
  }
}
console.log(`\n完了: ${fixed}件修正`);
