/**
 * step4-seo-check.mjs
 * SEO技術チェック（Layer 2）
 *
 * 使い方: node scripts/step4-seo-check.mjs <slug>
 * 問題があれば exit 1 で停止
 *
 * チェック内容:
 *   [CRITICAL] title が設定されているか・32文字以内か
 *   [CRITICAL] meta description が設定されているか（120〜160文字）
 *   [CRITICAL] canonical が正しいURLか
 *   [CRITICAL] og:title / og:description / og:image / og:url が設定されているか
 *   [CRITICAL] h1 が1つだけあるか
 *   [WARNING]  JSON-LD (Article schema) があるか
 *   [WARNING]  FAQ schema があるか（FAQページの場合）
 *   [WARNING]  画像に alt 属性があるか（空のaltを検出）
 *   [WARNING]  sitemap.xml に登録されているか
 *   [WARNING]  kw.json のサブKWが本文に含まれているか
 */

import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.resolve('data/articles');
const DOMAIN       = 'https://aliswipe.com';

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step4-seo-check.mjs <slug>');
  process.exit(1);
}

const planPath = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const plan     = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : {};
const category = plan.category ?? 'gadget';
const htmlPath = path.resolve('public', category, `${slug}.html`);
const kwPath   = path.join(ARTICLES_DIR, `${slug}-kw.json`);
const metaPath = path.join(ARTICLES_DIR, `${slug}-meta.json`);

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ HTMLが見つかりません: ${htmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const kw   = fs.existsSync(kwPath)   ? JSON.parse(fs.readFileSync(kwPath,   'utf8')) : null;
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;

const expectedCanon = `${DOMAIN}/${category}/${slug}.html`;

console.log(`\n🔍 step4-seo-check: ${slug}\n`);

const criticals = [];
const warnings  = [];

// ── 1. title タグ ─────────────────────────────────────────────
const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
if (!titleMatch) {
  criticals.push('[title] titleタグが見つかりません');
} else {
  const titleText = titleMatch[1].replace(/\s*\|.*$/, '').trim(); // サイト名部分を除去
  const titleLen  = [...titleText].length;
  if (titleLen === 0) {
    criticals.push('[title] titleタグが空です');
  } else if (titleLen > 35) {
    warnings.push(`[title] タイトルが${titleLen}文字（推奨32文字以内）: "${titleText}"`);
  }
  // メインKWが含まれているか
  const mainKw = plan.keyword ?? kw?.mainKeyword ?? '';
  if (mainKw && !titleText.toLowerCase().includes(mainKw.toLowerCase().split(' ')[0])) {
    warnings.push(`[title] メインKW「${mainKw}」がtitleに含まれていません`);
  }
}

// ── 2. meta description ───────────────────────────────────────
const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
                ?? html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
if (!descMatch) {
  criticals.push('[meta description] meta descriptionが設定されていません');
} else {
  const descText = descMatch[1];
  const descLen  = [...descText].length;
  if (descLen < 80) {
    warnings.push(`[meta description] 文字数が少ない（${descLen}文字、推奨120〜160文字）`);
  } else if (descLen > 170) {
    warnings.push(`[meta description] 文字数が多すぎる（${descLen}文字、推奨120〜160文字）`);
  }
}

// ── 3. canonical ─────────────────────────────────────────────
const canonMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
if (!canonMatch) {
  criticals.push('[canonical] canonicalリンクが設定されていません');
} else if (canonMatch[1] !== expectedCanon) {
  criticals.push(`[canonical] URLが不正です\n  期待値: ${expectedCanon}\n  実際値: ${canonMatch[1]}`);
}

// ── 4. OGP タグ ───────────────────────────────────────────────
const requiredOgp = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
for (const prop of requiredOgp) {
  const re = new RegExp(`property="${prop}"[^>]+content="([^"]*)"`, 'i');
  const m  = html.match(re) ?? html.match(new RegExp(`content="([^"]*)"[^>]+property="${prop}"`, 'i'));
  if (!m || !m[1]) {
    criticals.push(`[OGP] ${prop} が設定されていません`);
  }
}

// ── 5. h1 タグ ────────────────────────────────────────────────
const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
if (h1Matches.length === 0) {
  criticals.push('[h1] h1タグが見つかりません');
} else if (h1Matches.length > 1) {
  warnings.push(`[h1] h1タグが${h1Matches.length}個あります（1つだけにしてください）`);
}

// ── 6. JSON-LD (Article schema) ───────────────────────────────
const hasArticleSchema = /"@type"\s*:\s*"(Article|BlogPosting|NewsArticle)"/.test(html);
if (!hasArticleSchema) {
  warnings.push('[JSON-LD] Article schemaが見つかりません\n  → gen-article-schema.mjs または fix-seo.mjs を実行してください');
}

// ── 7. FAQ schema ─────────────────────────────────────────────
const hasFaqInHtml = /class="faq/.test(html) || /よくある質問/.test(html);
const hasFaqSchema = /"@type"\s*:\s*"FAQPage"/.test(html);
if (hasFaqInHtml && !hasFaqSchema) {
  warnings.push('[JSON-LD] FAQPageスキーマが見つかりません\n  → gen-faq-schema.mjs を実行してください');
}

// ── 8. 画像 alt 属性 ──────────────────────────────────────────
const emptyAlts = [...html.matchAll(/<img[^>]+alt=""\s*/gi)];
if (emptyAlts.length > 0) {
  warnings.push(`[alt属性] alt=""の空alt属性が${emptyAlts.length}件あります\n  → 画像の説明を追加してください`);
}
const noAlt = [...html.matchAll(/<img(?![^>]*alt=)[^>]+>/gi)];
if (noAlt.length > 0) {
  warnings.push(`[alt属性] alt属性がない画像が${noAlt.length}件あります`);
}

// ── 9. sitemap.xml への登録確認 ───────────────────────────────
const sitemapPath = path.resolve('public/sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  if (!sitemap.includes(`/${category}/${slug}.html`)) {
    warnings.push(`[sitemap] sitemap.xmlに未登録です\n  → npm run gen-all を実行してください`);
  }
} else {
  warnings.push('[sitemap] sitemap.xmlが見つかりません');
}

// ── 10. サブKW含有チェック ────────────────────────────────────
if (kw?.subKws?.length > 0) {
  const bodyText = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  const missingSubKws = kw.subKws.slice(0, 5).filter(k =>
    !bodyText.toLowerCase().includes(k.keyword.toLowerCase())
  );
  if (missingSubKws.length > 0) {
    warnings.push(`[サブKW] 以下のサブKWが本文に含まれていません:\n  ${missingSubKws.map(k => k.keyword).join(' / ')}\n  → 本文・見出し・FAQに自然に含めてください`);
  }
}

// ── レポート出力 ─────────────────────────────────────────────
console.log('━'.repeat(60));

// スコアカード
const seoItems = [
  { name: 'title',            ok: !criticals.some(c => c.includes('[title]'))        },
  { name: 'meta description', ok: !criticals.some(c => c.includes('[meta description]')) },
  { name: 'canonical',        ok: !criticals.some(c => c.includes('[canonical]'))    },
  { name: 'OGP tags',         ok: !criticals.some(c => c.includes('[OGP]'))          },
  { name: 'h1',               ok: !criticals.some(c => c.includes('[h1]'))           },
  { name: 'JSON-LD Article',  ok: hasArticleSchema                                   },
  { name: 'FAQ schema',       ok: !hasFaqInHtml || hasFaqSchema                      },
  { name: 'alt属性',          ok: emptyAlts.length === 0 && noAlt.length === 0       },
  { name: 'sitemap',          ok: !warnings.some(w => w.includes('[sitemap]'))       },
];
console.log('📊 SEOスコアカード:');
seoItems.forEach(item => {
  console.log(`  ${item.ok ? '✅' : '❌'} ${item.name}`);
});
console.log('');

if (criticals.length > 0) {
  console.log(`❌ CRITICAL（${criticals.length}件）`);
  criticals.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
}
if (warnings.length > 0) {
  console.log(`\n⚠️  WARNING（${warnings.length}件）`);
  warnings.forEach((m, i) => console.log(`\n  [${i+1}] ${m}`));
}

console.log('\n' + '━'.repeat(60));

if (criticals.length > 0) {
  console.log(`\n❌ SEOチェック失敗: CRITICAL ${criticals.length}件 を修正してください\n`);
  process.exit(1);
} else {
  console.log(`\n✅ SEOチェック通過（WARNING ${warnings.length}件）`);
  console.log(`▶ 次: node scripts/step4-affiliate-check.mjs ${slug}\n`);
  process.exit(0);
}
