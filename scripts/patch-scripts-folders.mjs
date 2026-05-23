/**
 * patch-scripts-folders.mjs
 * gen-voices.mjs / gen-ogp.mjs / step1-plan.mjs / step3-write.mjs /
 * gen-sitemap.mjs / process-x-screenshots.mjs のフォルダ参照を一括更新
 */
import fs from 'fs';

// slug → 新フォルダ マッピング
const SLUG_FOLDER = {
  'gamesir-controller-osusume':        'game',
  'aliexpress-gamepad-osusume':        'game',
  'ugreen-mouse-osusume':              'gadget',
  'ugreen-cable-osusume':              'gadget',
  'ugreen-earphone-osusume':           'gadget',
  'ugreen-stand-osusume':              'gadget',
  'ugreen-smart-tracker-osusume':      'gadget',
  'ugreen-gan-charger-osusume':        'gadget',
  'ugreen-usb-hub-osusume':            'gadget',
  'ugreen-docking-station-osusume':    'gadget',
  'baseus-mobile-battery-osusume':     'gadget',
  'xiaomi-band10-strap-osusume':       'gadget',
  'naturehike-tent-osusume':           'outdoor',
  'naturehike-airmat-osusume':         'outdoor',
  'naturehike-sleeping-bag-osusume':   'outdoor',
  'naturehike-cot-osusume':            'outdoor',
  'naturehike-osusume':                'outdoor',
  'naturehike-brand':                  'guide',
  'aliexpress-vs-temu':                'guide',
  'aliexpress-what-is':                'guide',
  'aliexpress-account':                'guide',
  'aliexpress-choice':                 'guide',
  'aliexpress-osusume':                'guide',
  'aliexpress-sticker-osusume':        'guide',
  'aliexpress-1000yen-kawatte-yokatta':'guide',
  'aliexpress-size':                   'safety',
  'aliexpress-projector-under-10000':  'gadget',
};

// ── gen-voices.mjs: slug別にfolderを修正 ──
{
  const file = 'scripts/gen-voices.mjs';
  let c = fs.readFileSync(file, 'utf8');
  const original = c;
  // 各エントリの slug + folder を置換
  for (const [slug, folder] of Object.entries(SLUG_FOLDER)) {
    // slug: 'xxx',\n    folder:    'basics' のパターン
    c = c.replace(
      new RegExp(`(slug:\\s*'${slug}',[\\s\\S]*?folder:\\s*)'basics'`, 'g'),
      `$1'${folder}'`
    );
  }
  if (c !== original) {
    fs.writeFileSync(file, c, 'utf8');
    console.log(`✅ gen-voices.mjs updated`);
  }
}

// ── gen-ogp.mjs: CAT_COLOR / CAT_SUB に新カテゴリ追加 ──
{
  const file = 'scripts/gen-ogp.mjs';
  let c = fs.readFileSync(file, 'utf8');

  // CAT_COLOR: basics → 削除し、新カテゴリ追加
  c = c.replace(
    `  basics:   '#3b82f6',`,
    `  gadget:   '#3b82f6',\n  game:     '#7c3aed',\n  outdoor:  '#16a34a',\n  guide:    '#0ea5e9',`
  );

  // CAT_SUB: basics → 削除し、新カテゴリ追加
  c = c.replace(
    `  basics:   'AliExpress\\n完全ガイド',`,
    `  gadget:   'アリエクswipe\\nガジェット特集',\n  game:     'アリエクswipe\\nゲーム周辺機器',\n  outdoor:  'アリエクswipe\\nアウトドア特集',\n  guide:    'アリエクswipe\\n完全ガイド',`
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log(`✅ gen-ogp.mjs updated`);
}

// ── gen-sitemap.mjs: sitemap.html のセクション分類を更新 ──
{
  const file = 'scripts/gen-sitemap.mjs';
  let c = fs.readFileSync(file, 'utf8');

  // KNOWLEDGE_SLUGS → basics/ 前提のコメント削除
  c = c.replace(
    `// basics/ の中で「AliExpressとは・基礎知識」セクションに入るスラッグ\n`,
    `// guide/ の中で「AliExpressとは・基礎知識」セクションに入るスラッグ\n`
  );

  // セクションbucketsに gadget/game/outdoor/guide を追加
  c = c.replace(
    `const buckets = { top: [], osusume: [], safety: [], payment: [], shipping: [], info: [] };`,
    `const buckets = { top: [], osusume: [], safety: [], payment: [], shipping: [], info: [] };
// フォルダ別おすすめ記事はすべてosusumeバケツへ`
  );

  // dir分類ロジックを更新
  c = c.replace(
    `  if (p.dir === 'info') { buckets.info.push(p); continue; }
  if (p.dir === 'safety') { buckets.safety.push(p); continue; }
  if (p.dir === 'payment') { buckets.payment.push(p); continue; }
  if (p.dir === 'shipping') { buckets.shipping.push(p); continue; }
  if (KNOWLEDGE_SLUGS.has(p.slug)) { buckets.top.push(p); continue; }
  buckets.osusume.push(p);`,
    `  if (p.dir === 'info') { buckets.info.push(p); continue; }
  if (p.dir === 'safety') { buckets.safety.push(p); continue; }
  if (p.dir === 'payment') { buckets.payment.push(p); continue; }
  if (p.dir === 'shipping') { buckets.shipping.push(p); continue; }
  if (KNOWLEDGE_SLUGS.has(p.slug)) { buckets.top.push(p); continue; }
  // gadget / game / outdoor / guide / basics → おすすめ or ガイドとして分類
  buckets.osusume.push(p);`
  );

  fs.writeFileSync(file, c, 'utf8');
  console.log(`✅ gen-sitemap.mjs updated`);
}

// ── step1-plan.mjs: カテゴリ説明を更新 ──
{
  const file = 'scripts/step1-plan.mjs';
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(
    `const category = args[2] ?? 'basics';`,
    `const category = args[2] ?? 'gadget';`
  );
  c = c.replace(
    ` * カテゴリ一覧: basics / safety / payment / shipping`,
    ` * カテゴリ一覧: gadget / game / outdoor / guide / safety / payment / shipping`
  );
  c = c.replace(
    /例:\s+node scripts\/step1-plan\.mjs[^\n]+basics[^\n]+/g,
    `例:    node scripts/step1-plan.mjs "UGREEN マウス おすすめ" ugreen-mouse-osusume2 gadget`
  );
  // 使い方の basics も更新
  c = c.replace(
    `使い方: node scripts/step1-plan.mjs "キーワード" <slug> [カテゴリ=basics]`,
    `使い方: node scripts/step1-plan.mjs "キーワード" <slug> [カテゴリ=gadget]`
  );
  fs.writeFileSync(file, c, 'utf8');
  console.log(`✅ step1-plan.mjs updated`);
}

// ── step3-write.mjs: CAT_TAG に新カテゴリ追加 ──
{
  const file = 'scripts/step3-write.mjs';
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(
    `const category = plan.category ?? 'basics';`,
    `const category = plan.category ?? 'gadget';`
  );
  c = c.replace(
    `const CAT_TAG = { basics: 'おすすめ商品', safety: '安全性', payment: '支払い方法', shipping: '配送・追跡' };`,
    `const CAT_TAG = { gadget: 'ガジェット', game: 'ゲーム', outdoor: 'アウトドア', guide: 'ガイド', safety: '安全性', payment: '支払い方法', shipping: '配送・追跡', basics: 'おすすめ商品' };`
  );
  fs.writeFileSync(file, c, 'utf8');
  console.log(`✅ step3-write.mjs updated`);
}

// ── process-x-screenshots.mjs: folder更新 ──
{
  const file = 'scripts/process-x-screenshots.mjs';
  let c = fs.readFileSync(file, 'utf8');
  for (const [slug, folder] of Object.entries(SLUG_FOLDER)) {
    c = c.replace(
      new RegExp(`(slug: '${slug}',\\s*folder: )'basics'`, 'g'),
      `$1'${folder}'`
    );
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log(`✅ process-x-screenshots.mjs updated`);
}

console.log('\n✅ 全スクリプト更新完了');
