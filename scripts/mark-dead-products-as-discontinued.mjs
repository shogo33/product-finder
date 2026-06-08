/**
 * 監査JSONからdead商品リストを取得し、各記事の該当商品セクションのCTAを
 * 「販売終了」表示にして CTAボタンを無効化する。
 *
 * - @product-start id="DEAD_PID" で始まるブロック内の <div class="cta-box">...</div> を置換
 * - 既に販売終了表示済みの場合はスキップ
 */
import fs from 'node:fs';
import path from 'node:path';

const AUDIT = 'data/articles/_audit-aliexpress-products.json';
const PUBLIC_DIR = 'public';

const issues = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const deadByArticle = {};
for (const i of issues) {
  if (i.type !== 'DEAD') continue;
  if (!deadByArticle[i.slug]) deadByArticle[i.slug] = [];
  deadByArticle[i.slug].push({ pid: i.productId, name: i.name });
}

function findHtmlPath(slug) {
  for (const cat of ['gadget', 'guide', 'game', 'outdoor', 'payment', 'safety', 'shipping', 'basics']) {
    const p = path.join(PUBLIC_DIR, cat, `${slug}.html`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function patchProductCta(html, pid) {
  // @product-start id="PID" から @product-end まで
  const startRe = new RegExp(`<!-- @product-start id="${pid}"[^>]*-->`);
  const startMatch = html.match(startRe);
  if (!startMatch) return { html, replaced: false };
  const startIdx = startMatch.index;
  const endStr = '<!-- @product-end -->';
  const endIdx = html.indexOf(endStr, startIdx);
  if (endIdx < 0) return { html, replaced: false };
  let block = html.slice(startIdx, endIdx);

  // 既に販売終了化されているならスキップ
  if (/販売終了/.test(block)) return { html, replaced: false };

  // cta-box を置換
  const ctaRe = /<div class="cta-box"[^>]*>[\s\S]*?<\/div>\s*<\/div>/;
  const newCta = `<div class="cta-box" style="background:#f5f5f5;border:1px solid #ddd;">
  <p class="cta-lead" style="color:#666;">⚠️ この商品は2026年6月時点で公式販売が終了しています</p>
  <p class="cta-sub">AliExpressおよびAmazonでの取扱が確認できないため、購入リンクを無効化しています。</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="#" aria-disabled="true" style="opacity:0.35;pointer-events:none;cursor:not-allowed;">AliExpressで見る（販売終了）</a>
    <a class="cta-btn-amazon" href="#" aria-disabled="true" style="opacity:0.35;pointer-events:none;cursor:not-allowed;">Amazonで見る（販売終了）</a>
  </div>
</div>`;
  const newBlock = block.replace(ctaRe, newCta);
  if (newBlock === block) return { html, replaced: false };
  return { html: html.slice(0, startIdx) + newBlock + html.slice(endIdx), replaced: true };
}

let totalArticles = 0;
let totalPatches = 0;

for (const [slug, deads] of Object.entries(deadByArticle)) {
  const file = findHtmlPath(slug);
  if (!file) { console.log(`  skip (not found): ${slug}`); continue; }
  let html = fs.readFileSync(file, 'utf8');
  let articlePatches = 0;
  for (const dead of deads) {
    const { html: newHtml, replaced } = patchProductCta(html, dead.pid);
    if (replaced) { html = newHtml; articlePatches++; }
  }
  if (articlePatches > 0) {
    fs.writeFileSync(file, html, 'utf8');
    totalArticles++;
    totalPatches += articlePatches;
    console.log(`✅ ${slug}: ${articlePatches} dead products marked`);
  } else {
    console.log(`  skip (no changes): ${slug}`);
  }
}

console.log(`\n=== Done ===`);
console.log(`Articles updated: ${totalArticles}`);
console.log(`Total products marked as 販売終了: ${totalPatches}`);
