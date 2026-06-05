/**
 * HTML の <head> 内に noindex メタタグを追加（既にあればスキップ）
 * Usage: node scripts/add-noindex.mjs <file1> [<file2> ...]
 */
import fs from 'node:fs';

const TAG = '<meta name="robots" content="noindex,nofollow" />';

let total = 0;
for (const file of process.argv.slice(2)) {
  if (!fs.existsSync(file)) { console.error('skip (not found):', file); continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('name="robots"')) {
    console.log(`already has robots: ${file}`);
    continue;
  }
  html = html.replace(/<meta charset="UTF-8" \/>/, (m) => `${m}\n  ${TAG}`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ added noindex: ${file}`);
  total++;
}
console.log(`\nDone. ${total} files updated.`);
