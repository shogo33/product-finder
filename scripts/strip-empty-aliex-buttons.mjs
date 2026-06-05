/**
 * href="#" のAliExpressボタンを削除し、CTAボックスをAmazon専用に変換
 * Usage: node scripts/strip-empty-aliex-buttons.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: ...'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');
let removed = 0;
let leadChanged = 0;

// Step 1: href="#" の AliExpress ボタンを行ごと削除
html = html.replace(/^[ \t]*<a class="cta-btn-aliex"[^>]*href="#"[^>]*>[^<]*<\/a>[ \t]*\r?\n?/gm, () => {
  removed++;
  return '';
});

// Step 2: CTA-leadとsubを Amazon only に書き換え
html = html.replace(/<div class="cta-box">([\s\S]*?)<\/div>\s*<\/div>/g, (full, inner) => {
  const hasAliex = /class="cta-btn-aliex"/.test(inner);
  const hasAmazon = /class="cta-btn-amazon"/.test(inner);
  if (hasAliex || !hasAmazon) return full;

  let newInner = inner;
  if (/<p class="cta-lead">([^<]+)をどちらで買う？価格・配送を比較<\/p>/.test(newInner)) {
    newInner = newInner.replace(
      /<p class="cta-lead">([^<]+)をどちらで買う？価格・配送を比較<\/p>/,
      '<p class="cta-lead">$1をAmazonでチェック</p>'
    );
    leadChanged++;
  }
  newInner = newInner.replace(
    /<p class="cta-sub">[^<]*<\/p>/,
    '<p class="cta-sub">Amazon：翌日〜2日で到着・PSE取得済み・返品しやすい</p>'
  );
  return `<div class="cta-box">${newInner}</div>\n  </div>`;
});

fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${file}`);
console.log(`  Removed empty AliEx buttons: ${removed}`);
console.log(`  Rewrote CTA leads to Amazon-only: ${leadChanged}`);
