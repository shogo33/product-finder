/**
 * CTAボックスで片側のボタンしかない商品は、リード文・サブ文も片側用に直す。
 * Usage: node scripts/fix-cta-single-button.mjs <html-path>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Usage: node ... <html-path>'); process.exit(1); }

let html = fs.readFileSync(file, 'utf8');

const CTA_RE = /<div class="cta-box">([\s\S]*?)<\/div>\s*<\/div>/g;
let changed = 0;

html = html.replace(CTA_RE, (full, inner) => {
  const hasAliex = /class="cta-btn-aliex"/.test(inner);
  const hasAmazon = /class="cta-btn-amazon"/.test(inner);

  // 両方ある場合は変更なし
  if (hasAliex && hasAmazon) return full;
  // 両方無い場合（理論上は起きない）も変更なし
  if (!hasAliex && !hasAmazon) return full;

  let newInner = inner;

  if (hasAmazon && !hasAliex) {
    // Amazonのみ
    newInner = newInner.replace(
      /<p class="cta-lead">([^<]+)をどちらで買う？価格・配送を比較<\/p>/,
      '<p class="cta-lead">$1をAmazonでチェック</p>'
    );
    newInner = newInner.replace(
      /<p class="cta-sub">[^<]*<\/p>/,
      '<p class="cta-sub">Amazon：翌日〜2日で到着・返品しやすい</p>'
    );
    changed++;
  } else if (hasAliex && !hasAmazon) {
    // AliExpressのみ
    newInner = newInner.replace(
      /<p class="cta-lead">([^<]+)をどちらで買う？価格・配送を比較<\/p>/,
      '<p class="cta-lead">$1をAliExpressでチェック</p>'
    );
    newInner = newInner.replace(
      /<p class="cta-sub">[^<]*<\/p>/,
      '<p class="cta-sub">AliExpress：送料無料・公式ストア直販で格安・到着2〜4週間</p>'
    );
    changed++;
  }

  return `<div class="cta-box">${newInner}</div>\n      </div>`;
});

fs.writeFileSync(file, html, 'utf8');
console.log(`✅ ${changed} CTA boxes rewritten in ${file}`);
