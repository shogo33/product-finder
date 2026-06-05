/**
 * 連続する <blockquote class="amazon-review"> 群を
 * <div class="amazon-reviews-wrap"> で囲み、ヘッダーを付与する
 * Usage: node scripts/wrap-amazon-reviews.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: ...'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');

// 既に wrap が付いている場合は剥がす
html = html.replace(/<div class="amazon-reviews-wrap">\s*<div class="reviews-header">[^<]*<\/div>\s*([\s\S]*?)<\/div>\s*(?=<|$)/g, '$1');

// 連続する amazon-review blockquote を1つの wrap にまとめる
// パターン: \n\n  <blockquote class="amazon-review">...</blockquote>\n  <blockquote class="amazon-review">...</blockquote>...
const BLOCK_RE = /((?:[ \t]*<blockquote class="amazon-review">[\s\S]*?<\/blockquote>[ \t]*\r?\n[\s]*)+)/g;

let wrapped = 0;
html = html.replace(BLOCK_RE, (match) => {
  const indent = '  ';
  wrapped++;
  return `${indent}<div class="amazon-reviews-wrap">\n${indent}  <div class="reviews-header">Amazon購入者の声</div>\n${match.split('\n').map(l=>l?'  '+l:l).join('\n')}${indent}</div>\n\n`;
});

fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${file}`);
console.log(`  Wrapped review groups: ${wrapped}`);
