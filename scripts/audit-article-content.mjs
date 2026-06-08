/**
 * 全記事の機械的チェック:
 * - アンカーリンクの妥当性（#product-XXX が対応idを持つか）
 * - 比較表の構造（thead列数 vs tbody各行の列数）
 * - PENDING残骸・href="#"の死にリンク
 * - 価格表記の不整合（記事本文の¥表記 vs research JSONのprice_jpy）
 * - dead商品の参照（_audit-aliexpress-products.jsonと照合）
 */
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const ARTICLES_DIR = 'data/articles';

const auditData = fs.existsSync('data/articles/_audit-aliexpress-products.json')
  ? JSON.parse(fs.readFileSync('data/articles/_audit-aliexpress-products.json', 'utf8'))
  : [];
const deadPids = new Set(auditData.filter((i) => i.type === 'DEAD').map((i) => i.productId));

function walkHtml(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(full, files);
    else if (e.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function getSlug(filepath) {
  return path.basename(filepath, '.html');
}

function checkAnchorLinks(html, file) {
  const issues = [];
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    const anchor = m[1];
    if (!ids.has(anchor)) issues.push({ type: 'BROKEN_ANCHOR', anchor });
  }
  return issues;
}

function checkTableStructure(html) {
  const issues = [];
  const tableRe = /<table[\s\S]*?<\/table>/g;
  let idx = 0;
  for (const m of html.matchAll(tableRe)) {
    idx++;
    const table = m[0];
    const headMatch = table.match(/<thead[\s\S]*?<\/thead>/);
    if (!headMatch) continue;
    const headRow = headMatch[0].match(/<tr[\s\S]*?<\/tr>/);
    if (!headRow) continue;
    const headColCount = (headRow[0].match(/<th[\s>]/g) || []).length;

    const bodyMatch = table.match(/<tbody[\s\S]*?<\/tbody>/);
    if (!bodyMatch) continue;
    const bodyRows = bodyMatch[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
    bodyRows.forEach((row, i) => {
      const cells = (row.match(/<td[\s>]/g) || []).length;
      if (cells !== headColCount) {
        issues.push({ type: 'TABLE_CELL_MISMATCH', tableIdx: idx, rowIdx: i + 1, expected: headColCount, actual: cells });
      }
    });
  }
  return issues;
}

function checkDeadLinks(html) {
  const issues = [];
  // <a href="#" target="_blank"... > like dead CTA buttons
  for (const m of html.matchAll(/<a\s[^>]*href="#"[^>]*>(.*?)<\/a>/g)) {
    const text = m[1];
    if (/AliExpress|Amazon/i.test(text)) {
      issues.push({ type: 'DEAD_CTA', text: text.slice(0, 40) });
    }
  }
  // (確認中) markers
  if (/（確認中）/.test(html)) {
    const count = (html.match(/（確認中）/g) || []).length;
    issues.push({ type: 'PENDING_MARKER', count });
  }
  // AMAZON_PENDING / ALIEXPRESS_PENDING comments
  const pendingComments = (html.match(/<!-- (?:AMAZON|ALIEXPRESS)_PENDING:/g) || []).length;
  if (pendingComments) issues.push({ type: 'PENDING_COMMENT', count: pendingComments });
  return issues;
}

function checkDeadProducts(html, slug) {
  const issues = [];
  for (const pid of deadPids) {
    if (html.includes(pid)) {
      // 該当記事に dead PID が含まれている場合
      issues.push({ type: 'DEAD_PRODUCT_REF', pid });
    }
  }
  return issues;
}

function checkPriceConsistency(html, slug) {
  const issues = [];
  const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
  if (!fs.existsSync(researchPath)) return issues;
  let research;
  try { research = JSON.parse(fs.readFileSync(researchPath, 'utf8')); } catch { return issues; }
  const products = research.products || [];
  if (products.length === 0) return issues;

  // 各商品の price_jpy と本文の¥表記の合致を確認
  // 商品ごとに ¥価格表記を抽出して research のものと10%以上差があれば警告
  for (const p of products) {
    const expected = parseInt(p.price_jpy || 0);
    const orig = parseInt(p.original_price || 0);
    if (!expected || expected < 100) continue;
    const name = p.cleanName?.slice(0, 30) || p.product_id;
    // 商品セクション内（product-startマーカー間）の本文を取り出す
    const startMarker = `<!-- @product-start id="${p.product_id}"`;
    const startIdx = html.indexOf(startMarker);
    if (startIdx < 0) continue;
    const endIdx = html.indexOf('<!-- @product-end -->', startIdx);
    if (endIdx < 0) continue;
    const section = html.slice(startIdx, endIdx);
    // ¥XXX 表記抽出
    const prices = [...section.matchAll(/¥([\d,]+)/g)].map((m) => parseInt(m[1].replace(/,/g, ''))).filter((v) => v > 100 && v < 1000000);
    for (const written of prices) {
      // sale price と original price のどちらかと10%以内に合致するならOK
      const diffSale = Math.abs(written - expected) / expected;
      const diffOrig = orig > 0 ? Math.abs(written - orig) / orig : 1;
      if (diffSale > 0.1 && diffOrig > 0.1) {
        issues.push({ type: 'PRICE_MISMATCH', product: name, written, expected, original: orig || null, diffPctSale: Math.round(diffSale * 100) });
      }
    }
  }
  return issues;
}

// ===== Run audit =====
const allFiles = walkHtml(PUBLIC_DIR);
const articleFiles = allFiles.filter((f) => /\/(gadget|guide|game|outdoor|payment|safety|shipping)\//.test(f.replace(/\\/g, '/'))).filter((f) => !/(index|sitemap)\.html$/i.test(f));

console.log(`Auditing ${articleFiles.length} articles...\n`);

const report = {};
for (const file of articleFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const slug = getSlug(file);
  const issues = [
    ...checkAnchorLinks(html, file),
    ...checkTableStructure(html),
    ...checkDeadLinks(html),
    ...checkDeadProducts(html, slug),
    ...checkPriceConsistency(html, slug),
  ];
  if (issues.length > 0) report[slug] = { file: file.replace(/\\/g, '/'), issues };
}

const total = Object.values(report).reduce((s, r) => s + r.issues.length, 0);
console.log(`==== AUDIT RESULTS ====`);
console.log(`Articles with issues: ${Object.keys(report).length} / ${articleFiles.length}`);
console.log(`Total issues: ${total}\n`);

// 重要度別集計
const byType = {};
Object.values(report).forEach((r) => {
  r.issues.forEach((i) => { byType[i.type] = (byType[i.type] || 0) + 1; });
});
console.log('Issues by type:');
Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${c.toString().padStart(4)}  ${t}`));
console.log('');

// 記事ごとの詳細（issue数順）
console.log('=== Per-article details (sorted by issue count) ===');
const sorted = Object.entries(report).sort((a, b) => b[1].issues.length - a[1].issues.length);
for (const [slug, data] of sorted) {
  console.log(`\n[${data.issues.length}] ${slug}`);
  const summary = {};
  data.issues.forEach((i) => {
    const k = i.type;
    if (!summary[k]) summary[k] = [];
    summary[k].push(i);
  });
  for (const [type, items] of Object.entries(summary)) {
    console.log(`  ${type} (${items.length}):`);
    items.slice(0, 3).forEach((i) => {
      const rest = { ...i };
      delete rest.type;
      console.log(`    - ${JSON.stringify(rest)}`);
    });
    if (items.length > 3) console.log(`    ...and ${items.length - 3} more`);
  }
}

fs.writeFileSync('data/articles/_audit-content.json', JSON.stringify(report, null, 2));
console.log('\n💾 Saved: data/articles/_audit-content.json');
