/**
 * JSON-LD ItemList から特定スラッグの ListItem ブロックを削除
 */
import fs from 'node:fs';

const SLUGS = ['ugreen-cable-osusume', 'ugreen-docking-station-osusume', 'ugreen-earphone-osusume', 'ugreen-gan-charger-osusume'];

function removeListItems(file) {
  let html = fs.readFileSync(file, 'utf8');
  let count = 0;
  SLUGS.forEach((slug) => {
    // { "@type": "ListItem", "position": N, "url": "...SLUG.html", "name": "..." }, パターン
    const re = new RegExp(',?\\s*\\{\\s*"@type":\\s*"ListItem"[\\s\\S]*?\\/' + slug + '\\.html"[\\s\\S]*?\\}', 'g');
    html = html.replace(re, () => { count++; return ''; });
  });
  // 配列末尾の余分なカンマ修正
  html = html.replace(/,(\s*\])/g, '$1');
  fs.writeFileSync(file, html);
  return count;
}

console.log('gadget/index.html ListItem removed:', removeListItems('public/gadget/index.html'));
console.log('top index.html ListItem removed:', removeListItems('public/index.html'));
