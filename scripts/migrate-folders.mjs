/**
 * migrate-folders.mjs
 * basics/ の記事を gadget/ game/ outdoor/ guide/ safety/ に移動
 * 全HTMLの /basics/xxx.html リンクを新パスに一括書き換え
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

// ── 移動マッピング（slug → 新フォルダ）──
const MOVES = {
  // gadget
  'ugreen-cable-osusume':              'gadget',
  'ugreen-docking-station-osusume':    'gadget',
  'ugreen-earphone-osusume':           'gadget',
  'ugreen-gan-charger-osusume':        'gadget',
  'ugreen-mouse-osusume':              'gadget',
  'ugreen-smart-tracker-osusume':      'gadget',
  'ugreen-stand-osusume':              'gadget',
  'ugreen-usb-hub-osusume':            'gadget',
  'baseus-mobile-battery-osusume':     'gadget',
  'xiaomi-band10-strap-osusume':       'gadget',
  'aliexpress-projector-under-10000':  'gadget',
  // game
  'gamesir-controller-osusume':        'game',
  'aliexpress-gamepad-osusume':        'game',
  // outdoor
  'naturehike-airmat-osusume':         'outdoor',
  'naturehike-cot-osusume':            'outdoor',
  'naturehike-osusume':                'outdoor',
  'naturehike-sleeping-bag-osusume':   'outdoor',
  'naturehike-tent-osusume':           'outdoor',
  // guide
  'aliexpress-what-is':                'guide',
  'aliexpress-account':                'guide',
  'aliexpress-choice':                 'guide',
  'aliexpress-vs-temu':                'guide',
  'naturehike-brand':                  'guide',
  'aliexpress-1000yen-kawatte-yokatta':'guide',
  'aliexpress-osusume':                'guide',
  'aliexpress-sticker-osusume':        'guide',
  // safety（basics/ → safety/）
  'aliexpress-size':                   'safety',
};

// ── URL置換マップを構築 ──
const urlMap = {};
for (const [slug, toFolder] of Object.entries(MOVES)) {
  urlMap[`/basics/${slug}.html`] = `/${toFolder}/${slug}.html`;
}

// ── ディレクトリ作成 ──
for (const folder of ['gadget', 'game', 'outdoor', 'guide']) {
  fs.mkdirSync(path.join(PUBLIC, folder), { recursive: true });
  console.log(`📁 created public/${folder}/`);
}

// ── ファイル移動（内容書き換え → 新場所に保存） ──
let moved = 0;
for (const [slug, toFolder] of Object.entries(MOVES)) {
  const src = path.join(PUBLIC, 'basics', `${slug}.html`);
  const dst = path.join(PUBLIC, toFolder, `${slug}.html`);
  if (!fs.existsSync(src)) { console.log(`⚠ skip (not found): ${src}`); continue; }

  let content = fs.readFileSync(src, 'utf8');

  // canonical URL更新
  content = content.replace(
    new RegExp(`(https://aliswipe\\.com)/basics/(${slug}\\.html)`, 'g'),
    `$1/${toFolder}/$2`
  );
  // og:url更新（同上パターンカバー済みだが念のため全/basics/xxx置換もあとで）

  fs.writeFileSync(dst, content, 'utf8');
  fs.unlinkSync(src);
  console.log(`✅ basics/${slug}.html → ${toFolder}/${slug}.html`);
  moved++;
}

// ── 全HTMLファイルの内部リンクを一括置換 ──
function getAllHtml(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) {
      results.push(...getAllHtml(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const allHtml = getAllHtml(PUBLIC);
let linkUpdated = 0;

for (const file of allHtml) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [oldPath, newPath] of Object.entries(urlMap)) {
    content = content.replaceAll(oldPath, newPath);
    // https://aliswipe.com/basics/xxx.html パターンも置換
    content = content.replaceAll(
      `https://aliswipe.com${oldPath}`,
      `https://aliswipe.com${newPath}`
    );
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    linkUpdated++;
    console.log(`🔗 links updated: ${path.relative(PUBLIC, file)}`);
  }
}

console.log(`\n📦 移動完了: ${moved}件`);
console.log(`🔗 リンク更新: ${linkUpdated}ファイル`);
console.log('\nbasics/ に残っているファイル:');
const remaining = fs.readdirSync(path.join(PUBLIC, 'basics')).filter(f => f.endsWith('.html'));
remaining.forEach(f => console.log(`  - ${f}`));
