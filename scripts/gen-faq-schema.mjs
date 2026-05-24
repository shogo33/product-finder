/**
 * gen-faq-schema.mjs
 * 各記事HTMLのFAQセクションからFAQPage JSON-LDを生成して<head>に注入する
 * 既存のFAQPage JSONLDがあれば上書き
 */
import fs from 'fs';
import path from 'path';

const ARTICLE_DIRS = ['gadget','game','outdoor','guide','safety','payment','shipping'].map(d => `public/${d}`);
const SKIP = new Set(['admin','preview','template','nav','home','sitemap']);
const MAX_FAQ = 5; // Googleは最大10件だが、5件が最適

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, max = 300) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/[、。！？,. ]+$/, '') + '…';
}

/** faq-q / faq-a クラス構造から抽出 */
function extractFaqDivs(html) {
  // faq-q と faq-a を直接抽出してインデックスで対応付け
  const qs = [...html.matchAll(/<div[^>]+class="faq-q"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(m => stripTags(m[1])).filter(Boolean);
  const as = [...html.matchAll(/<div[^>]+class="faq-a"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(m => truncate(stripTags(m[1]))).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < Math.min(qs.length, as.length); i++) {
    if (qs[i] && as[i]) pairs.push({ q: qs[i], a: as[i] });
  }
  return pairs;
}

/** FAQセクション内の h3 + <p> 構造から抽出 */
function extractFaqH3(html) {
  // よくある質問 or FAQ を含む h2 を探す
  const faqH2 = html.search(/<h2[^>]*>[^<]*(?:よくある質問|FAQ)[^<]*<\/h2>/i);
  if (faqH2 === -1) return [];

  // FAQセクションの終端（次のh2またはEOF）
  const nextH2 = html.indexOf('<h2', faqH2 + 5);
  const section = html.slice(faqH2, nextH2 === -1 ? undefined : nextH2);

  // h3 + 直後の <p> を対応付け
  const pairs = [];
  const h3matches = [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*([\s\S]*?)(?=<h3|$)/g)];
  for (const m of h3matches) {
    const q = stripTags(m[1]);
    // m[2]から最初の<p>...</p>を取得
    const pm = m[2].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (!pm) continue;
    const a = truncate(stripTags(pm[1]));
    if (q && a && q.length > 5) pairs.push({ q, a });
  }
  return pairs;
}

/** dt / dd タグ構造から抽出（<dl>ベース） */
function extractFaqDl(html) {
  const pairs = [];
  // dlブロックを探す
  const dls = [...html.matchAll(/<dl[^>]*>([\s\S]*?)<\/dl>/g)];
  for (const dl of dls) {
    const dts = [...dl[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)];
    const dds = [...dl[1].matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)];
    for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
      const q = stripTags(dts[i][1]).replace(/^[Qq]\d+\.\s*/, '').replace(/^【[^】]+】\s*/, '');
      const a = truncate(stripTags(dds[i][1]));
      if (q && a) pairs.push({ q, a });
    }
  }
  return pairs;
}

/** details/summary 構造から抽出 */
function extractFaqDetails(html) {
  const pairs = [];
  const items = [...html.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/g)];
  for (const item of items) {
    const sm = item[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    if (!sm) continue;
    const q = stripTags(sm[1]);
    // summary以降のテキストを答えとして使う
    const rest = item[1].slice(sm[0].length);
    const a = truncate(stripTags(rest));
    if (q && a && q.length > 5) pairs.push({ q, a });
  }
  return pairs;
}

/** フォールバック：「？」を含むH2見出し + 直後の<p>から抽出 */
function extractFaqH2Questions(html) {
  const pairs = [];
  const h2matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/g)];
  for (const m of h2matches) {
    const q = stripTags(m[1]);
    if (!q.includes('？') && !q.includes('?')) continue;
    // ラベル的な接尾辞を除去（「〜を解説」「〜の方法」等）
    const cleanQ = q.replace(/[｜|].*$/, '').replace(/【[^】]+】\s*/, '').trim();
    const pm = m[2].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    if (!pm) continue;
    const a = truncate(stripTags(pm[1]));
    if (cleanQ && a && cleanQ.length > 5) pairs.push({ q: cleanQ, a });
  }
  return pairs;
}

function extractFaqPairs(html) {
  let pairs = extractFaqDivs(html);
  if (pairs.length === 0) pairs = extractFaqDl(html);
  if (pairs.length === 0) pairs = extractFaqH3(html);
  if (pairs.length === 0) pairs = extractFaqDetails(html);
  if (pairs.length === 0) pairs = extractFaqH2Questions(html);
  return pairs.slice(0, MAX_FAQ);
}

function buildFaqJsonLd(pairs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}

function injectFaqSchema(html, jsonld) {
  const tag = `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>`;

  // 既存のFAQPage JSON-LDを削除
  html = html.replace(/<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>\s*/g, '');

  // </head>の直前に挿入
  return html.replace('</head>', `${tag}\n</head>`);
}

// ── メイン ──────────────────────────────────────────────────────
let updated = 0, skipped = 0;

for (const dir of ARTICLE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html') || SKIP.has(path.basename(f, '.html'))) continue;
    const fullPath = path.join(dir, f);
    const html = fs.readFileSync(fullPath, 'utf8');

    const pairs = extractFaqPairs(html);
    if (pairs.length === 0) {
      skipped++;
      process.stdout.write(`⚠️  FAQ未検出: ${dir}/${f}\n`);
      continue;
    }

    const jsonld = buildFaqJsonLd(pairs);
    const newHtml = injectFaqSchema(html, jsonld);
    fs.writeFileSync(fullPath, newHtml, 'utf8');
    updated++;
    process.stdout.write(`✅ ${f} (${pairs.length}件)\n`);
  }
}

console.log(`\n完了: ${updated}件更新 / ${skipped}件スキップ（FAQ未検出）`);
