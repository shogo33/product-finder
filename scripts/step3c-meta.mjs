/**
 * step3c-meta.mjs
 * 結論・こんな人向け・FAQ（1問ずつ）・まとめ・スペック列を生成する
 *
 * 使い方: node scripts/step3c-meta.mjs <slug>
 * 例:    node scripts/step3c-meta.mjs gamesir-t4-pro-osusume
 *
 * 入力:  data/articles/{slug}-plan.json
 *        data/articles/{slug}-research.json
 *        data/articles/{slug}-meta.json（あれば）
 *        data/articles/{slug}-kw.json（あれば）
 *        data/articles/{slug}-scaffold.html（スペックplaceholder確認用）
 * 出力:  data/articles/{slug}-metablock.html
 *        scaffold.html のスペックプレースホルダーも直接書き換え
 *
 * 【原則】
 *   - 全商品のサマリー（名前・価格・用途）だけ渡す。詳細スペックは渡さない
 *   - FAQは1問ずつ独立したClaudeコールで生成（Q&Aずれ防止）
 *   - スペック列は各商品のspecResultから機械抽出を試みる（失敗時はClaudeで補完）
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ARTICLES_DIR = path.resolve('data/articles');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const slug = process.argv[2];
if (!slug) {
  console.error('使い方: node scripts/step3c-meta.mjs <slug>');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

// ── ファイル読み込み ──────────────────────────────────────────
const planPath     = path.join(ARTICLES_DIR, `${slug}-plan.json`);
const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);
const metaPath     = path.join(ARTICLES_DIR, `${slug}-meta.json`);
const kwPath       = path.join(ARTICLES_DIR, `${slug}-kw.json`);
const scaffoldPath = path.join(ARTICLES_DIR, `${slug}-scaffold.html`);

for (const p of [planPath, researchPath]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ ファイルが見つかりません: ${p}`);
    process.exit(1);
  }
}

const plan     = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const meta     = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
const kw       = fs.existsSync(kwPath)   ? JSON.parse(fs.readFileSync(kwPath,   'utf8')) : null;

const products       = research.products ?? [];
const faqQuestions   = plan.faqQuestions ?? [];
const selectedTitle  = meta?.selectedTitle ?? plan.selectedTitle ?? plan.keyword;
const subKws         = kw?.subKws?.map(k => k.keyword) ?? [];

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000 });

console.log(`\n📝 step3c-meta: ${slug} (商品${products.length}件 / FAQ${faqQuestions.length}問)\n`);

// ── 商品サマリー（詳細スペックなし・名前と用途だけ） ─────────
const productSummary = products.map((p, i) =>
  `${i + 1}. ${p.cleanName}（¥${Number(p.price_jpy ?? 0).toLocaleString('ja-JP')}）`
).join('\n');

const HAIKU_SYSTEM = `日本語のHTML断片を出力する。コードブロック記法不要。HTMLタグのみ。`;

// ── 結論ブロック生成 ──────────────────────────────────────────
async function genConclusion() {
  process.stdout.write('  → 結論ブロック生成...');
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: `以下の商品群の結論ブロックHTMLを生成してください。

記事タイトル: ${selectedTitle}
商品一覧:
${productSummary}

以下の形式で出力（HTMLのみ）:
<div class="article-conclusion">
  <p><strong>結論：</strong>〇〇用途なら【商品名A】、〇〇重視なら【商品名B】がおすすめ。</p>
  <ul>
    <li>【用途A向け】 → 【商品名A】</li>
    <li>【用途B向け】 → 【商品名B】</li>
  </ul>
</div>

ルール:
- 商品数が1件でも適切にまとめる
- 「コスパ最強」「圧倒的」「誰にでもおすすめ」は禁止
- 用途・向き不向きを明確に`,
    }],
  });
  const html = res.content[0].text.trim().replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();
  console.log(' ✅');
  await sleep(800);
  return html;
}

// ── こんな人向けブロック生成 ──────────────────────────────────
async function genForWho() {
  process.stdout.write('  → こんな人向けブロック生成...');
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: `以下の記事の「こんな人向け」ブロックHTMLを生成してください。

記事タイトル: ${selectedTitle}
キーワード: ${plan.keyword}
商品一覧: ${productSummary}

以下の形式で出力（HTMLのみ）:
<div class="for-who">
  <p><strong>こんな人向け：</strong></p>
  <ul>
    <li>✅ 〇〇したい人</li>
    <li>✅ △△が気になる人</li>
    <li>❌ ××を求める人には向かない</li>
  </ul>
</div>

ルール: ✅ 2〜3件・❌ 1〜2件。具体的な用途で書く。`,
    }],
  });
  const html = res.content[0].text.trim().replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();
  console.log(' ✅');
  await sleep(800);
  return html;
}

// ── FAQ（1問ずつ生成） ────────────────────────────────────────
async function genFaqItem(question, idx, total) {
  process.stdout.write(`  → FAQ [${idx + 1}/${total}] "${question.slice(0, 30)}..."...`);

  // この質問に関係する商品情報だけ渡す（詳細スペックは渡さない）
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: `以下のFAQ質問に対する回答HTMLを生成してください。

質問: ${question}
記事キーワード: ${plan.keyword}
対象商品: ${productSummary}

以下の形式で出力（HTMLのみ）:
<div class="faq-item">
  <h3 class="faq-q">${question}</h3>
  <div class="faq-a">
    <p>【回答文。2〜4文。「〜という声が多い」形式を使う。断定NG。「使いました」NG】</p>
  </div>
</div>

ルール:
- 質問に正確に答える（話題をずらさない）
- 「コスパ最強」「圧倒的」等の禁止表現を使わない
- 不明なことは「〜という報告が多い」「確認を推奨します」と書く`,
    }],
  });
  const html = res.content[0].text.trim().replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();
  console.log(' ✅');
  await sleep(800);
  return html;
}

// ── まとめセクション生成 ──────────────────────────────────────
async function genSummary() {
  process.stdout.write('  → まとめセクション生成...');
  const subKwText = subKws.length > 0
    ? `\nサブKW（自然に含める）: ${subKws.slice(0, 5).join(' / ')}`
    : '';
  const internalLinks = (plan.internalLinks ?? []).map(l =>
    `<a href="${l.url}">${l.anchorText}</a>`
  ).join('、');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: HAIKU_SYSTEM,
    messages: [{
      role: 'user',
      content: `以下の記事の「まとめ」セクションHTMLを生成してください。

記事タイトル: ${selectedTitle}
商品一覧: ${productSummary}${subKwText}
内部リンク候補: ${internalLinks || 'なし'}

以下の形式で出力（HTMLのみ）:
<h2 id="summary">まとめ：${plan.keyword}はこう選ぶ</h2>
<p>【記事の結論を1〜2文で。サブKWを自然に含める。「誰にでもおすすめ」禁止】</p>
<ul>
  <li>【商品名A】: 〇〇な人向け</li>
  <li>【商品名B】: △△な人向け</li>
</ul>
<p>【内部リンクを自然に含めた締めの一文（提供されたリンクがあれば使う）】</p>`,
    }],
  });
  const html = res.content[0].text.trim().replace(/^```html?\s*/m, '').replace(/\s*```$/m, '').trim();
  console.log(' ✅');
  await sleep(800);
  return html;
}

// ── スペック列の抽出・補完 ────────────────────────────────────
async function fillSpecColumns(scaffoldHtml) {
  // scaffold内のSPECプレースホルダーを検出
  const specPattern = /<!-- SPEC-([^-]+)-([^-]+(?:-[^-]+)*) -->/g;
  const specMatches = [...scaffoldHtml.matchAll(specPattern)];
  if (specMatches.length === 0) return scaffoldHtml;

  console.log(`\n  📊 スペック列プレースホルダー: ${specMatches.length}件`);
  let updated = scaffoldHtml;

  // product_id × column のマトリクス
  const specMap = {};
  for (const m of specMatches) {
    const [, pid, col] = m;
    if (!specMap[pid]) specMap[pid] = {};
    specMap[pid][col] = null;
  }

  // 各商品のspecResultからClaudeで抽出
  for (const [pid, cols] of Object.entries(specMap)) {
    const product = products.find(p => String(p.product_id) === pid);
    if (!product) continue;

    const colNames = Object.keys(cols).map(c => c.replace(/_/g, ' '));
    const specContent = product.specResult?.content?.slice(0, 600) ?? '';

    if (!specContent) {
      // specResultなし → セクションメモ・商品名から推測できる列はClaudeで補完、それ以外は「-」
      const sectionNote = plan.sections?.find(s =>
        s.type === 'product' && (
          s.h2?.includes(product.cleanName?.split(' ')[0]) ||
          s.notes?.some(n => n.includes(product.cleanName?.split(' ')[0]))
        )
      );
      const colNames = Object.keys(cols).map(c => c.replace(/_/g, ' '));
      // 価格・リンク系はすでにscaffoldで埋まっているはずなので、それ以外のみ補完
      const inferCols = colNames.filter(c =>
        !['モデル名','価格','価格目安','価格（円）','価格目安（円）','AliExpress','Amazon','評価','販売数'].includes(c)
      );
      if (inferCols.length > 0 && sectionNote) {
        process.stdout.write(`  → ${product.cleanName} 推奨シーン推測...`);
        const inferRes = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: `商品情報から指定列の短い値を推測してJSONで返す。各値は10文字以内で。JSONのみ返す。`,
          messages: [{
            role: 'user',
            content: `商品: ${product.cleanName}\nセクションメモ: ${(sectionNote.notes ?? []).join(' / ')}\n\n列名: ${inferCols.join(', ')}\n\nJSON形式: {"列名": "値"}`,
          }],
        });
        await sleep(600);
        try {
          const raw = inferRes.content[0].text.trim().replace(/^```json?\s*/m,'').replace(/\s*```$/m,'').trim();
          const extracted = JSON.parse(raw);
          for (const [colRaw, colNorm] of Object.keys(cols).map(c => [c, c.replace(/_/g,' ')])) {
            const val = extracted[colNorm] ?? extracted[colRaw] ?? '-';
            updated = updated.replace(`<!-- SPEC-${pid}-${colRaw} -->`, String(val));
          }
          console.log(' ✅');
        } catch {
          console.log(' ⚠️ → "-"');
          for (const col of Object.keys(cols)) updated = updated.replace(`<!-- SPEC-${pid}-${col} -->`, '-');
        }
      } else {
        for (const col of Object.keys(cols)) {
          updated = updated.replace(`<!-- SPEC-${pid}-${col} -->`, '-');
        }
      }
      continue;
    }

    process.stdout.write(`  → ${product.cleanName} スペック抽出...`);
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `商品スペックから指定列の値を抽出してJSONで返す。不明な項目は"-"とする。JSONのみ返す。`,
      messages: [{
        role: 'user',
        content: `商品: ${product.cleanName}
スペック情報: ${specContent}
抽出する列: ${colNames.join(', ')}

JSON形式で返してください（キーは列名そのまま）:
{"列名1": "値", "列名2": "値", ...}`,
      }],
    });
    await sleep(600);

    try {
      const raw = res.content[0].text.trim()
        .replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
      const extracted = JSON.parse(raw);

      for (const [colRaw, colNorm] of Object.keys(cols).map(c => [c, c.replace(/_/g, ' ')])) {
        const val = extracted[colNorm] ?? extracted[colRaw] ?? '-';
        const placeholder = `<!-- SPEC-${pid}-${colRaw} -->`;
        updated = updated.replace(placeholder, String(val));
      }
      console.log(' ✅');
    } catch {
      console.log(' ⚠️ パース失敗 → "-"で埋めます');
      for (const col of Object.keys(cols)) {
        updated = updated.replace(`<!-- SPEC-${pid}-${col} -->`, '-');
      }
    }
    await sleep(600);
  }

  return updated;
}

// ── メイン処理 ────────────────────────────────────────────────
const [conclusion, forWho, summary] = await Promise.all([
  genConclusion(),
  genForWho(),
  genSummary(),
]);

// FAQは1問ずつ順番に生成（並列だとレートリミット）
const faqItems = [];
for (let i = 0; i < faqQuestions.length; i++) {
  const html = await genFaqItem(faqQuestions[i], i, faqQuestions.length);
  faqItems.push(html);
}

// FAQセクション組み立て
const faqSection = faqItems.length > 0
  ? `<h2 id="faq">よくある質問</h2>\n<div class="faq-list">\n${faqItems.join('\n')}\n</div>`
  : '';

// metablock を組み立て（step3d が METABLOCK_PLACEHOLDER と置換する）
const metablock = `${faqSection}\n\n${summary}`;

// ── metablock.html に保存 ────────────────────────────────────
const metablockPath = path.join(ARTICLES_DIR, `${slug}-metablock.html`);
fs.writeFileSync(
  metablockPath,
  `<!-- metablock: ${slug} / generated: ${new Date().toISOString().slice(0, 10)} -->\n${metablock}\n`,
  'utf8'
);
console.log(`\n  ✅ metablock保存: ${metablockPath}`);

// ── scaffold のプレースホルダーを更新 ───────────────────────
if (fs.existsSync(scaffoldPath)) {
  let scaffoldHtml = fs.readFileSync(scaffoldPath, 'utf8');

  // 結論・for-who を注入
  scaffoldHtml = scaffoldHtml
    .replace('<!-- CONCLUSION_PLACEHOLDER -->', conclusion)
    .replace('<!-- FORWHO_PLACEHOLDER -->',    forWho);

  // スペック列を埋める
  scaffoldHtml = await fillSpecColumns(scaffoldHtml);

  fs.writeFileSync(scaffoldPath, scaffoldHtml, 'utf8');
  console.log(`  ✅ scaffold更新: 結論・こんな人向け・スペック列を注入`);
}

// ── サマリー ─────────────────────────────────────────────────
console.log('\n' + '━'.repeat(60));
console.log(`✅ step3c-meta 完了\n`);
console.log(`   結論ブロック:      ✅`);
console.log(`   こんな人向け:      ✅`);
console.log(`   FAQ:              ✅ ${faqItems.length}問`);
console.log(`   まとめ:            ✅`);
console.log(`   scaffold スペック: ✅ 更新`);
console.log('\n' + '━'.repeat(60));
console.log(`\n▶ 次: node scripts/step3d-assemble.mjs ${slug}`);
