/**
 * CTAボックス内の「（確認中）」ボタンとコメントを削除する。
 * Usage: node scripts/remove-pending-buttons.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: node ... <html-path>'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');
const before = html.length;

// 1) <!-- AMAZON_PENDING: ... --> コメントを除去（前後の空白行も）
html = html.replace(/^[ \t]*<!-- AMAZON_PENDING:[^>]*-->[ \t]*\r?\n?/gm, '');

// 2) <!-- ALIEXPRESS_PENDING: ... --> コメントを除去
html = html.replace(/^[ \t]*<!-- ALIEXPRESS_PENDING:[^>]*-->[ \t]*\r?\n?/gm, '');

// 3) 「（確認中）」が含まれる無効化された a タグを行ごと除去
html = html.replace(/^[ \t]*<a class="cta-btn-(?:aliex|amazon)"[^>]*>[^<]*（確認中）<\/a>[ \t]*\r?\n?/gm, '');

const after = html.length;
fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${file}: ${before - after} bytes removed`);
