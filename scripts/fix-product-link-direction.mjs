/**
 * product-link の矢印を方向別に修正
 * - リンク位置 < ターゲットセクション位置 → ↓（下にスクロール）
 * - リンク位置 > ターゲットセクション位置 → ↑（上にスクロール）
 */
import fs from 'fs';
import path from 'path';

const DIRS = ['public/gadget', 'public/game', 'public/outdoor'];

// 旧CSS → 新CSS（data-dir属性で方向別に出し分け）
const OLD_CSS = `    a.product-link::after { content: ' ↑'; font-size: 0.75em; opacity: 0.6; }
    .toc a.product-link::after { content: none; }`;
const NEW_CSS = `    a.product-link::after { font-size: 0.75em; opacity: 0.6; }
    a.product-link[data-dir="up"]::after { content: ' ↑'; }
    a.product-link[data-dir="down"]::after { content: ' ↓'; }
    .toc a.product-link::after { content: none; }`;

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('product-link')) return 'skip';

  // CSS更新
  if (!content.includes(OLD_CSS)) return 'skip';
  content = content.replace(OLD_CSS, NEW_CSS);

  // 各product-linkにdata-dir属性を付与
  content = content.replace(
    /<a href="#(sec-(\d+))" class="product-link">/g,
    (match, secId, secNum, offset) => {
      // ターゲットセクションの位置を探す
      const targetPattern = new RegExp(`<h2 id="${secId}"`);
      const targetMatch = targetPattern.exec(content);
      if (!targetMatch) return match;
      const dir = offset < targetMatch.index ? 'down' : 'up';
      return `<a href="#${secId}" class="product-link" data-dir="${dir}">`;
    }
  );

  fs.writeFileSync(filepath, content, 'utf8');
  return 'fixed';
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
console.log(`\n完了: ${fixed}件更新`);
