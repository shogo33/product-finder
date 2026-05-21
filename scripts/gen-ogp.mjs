/**
 * 記事別OGP画像 (1200×630 JPEG) を生成するスクリプト
 * 出力先: public/images/ogp/{slug}.jpg
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DOMAIN  = 'aliswipe.com';
const OUT_DIR = path.resolve('public/images/ogp');
fs.mkdirSync(OUT_DIR, { recursive: true });

// カテゴリ別アクセントカラー
const CAT_COLOR = {
  basics:   '#3b82f6',
  safety:   '#16a34a',
  payment:  '#9333ea',
  shipping: '#ea580c',
  home:     '#e8253a',
  default:  '#e8253a',
};

// スラッグ別サブテキスト（右エリア）
const SLUG_SUB = {
  'aliexpress-osusume':               '1,500件超のDBから\nカテゴリ別に厳選',
  'aliexpress-sticker-osusume':       'かわいい・おしゃれ\nシール＆ケース特集',
  'aliexpress-projector-under-10000': '1万円以下の\nプロジェクター厳選',
  'ugreen-cable-osusume':             'UGREEN ケーブル\n徹底比較レビュー',
  'ugreen-earphone-osusume':          'UGREEN イヤホン\n徹底比較レビュー',
  'ugreen-mouse-osusume':             'UGREEN マウス\n徹底比較レビュー',
  'baseus-mobile-battery-osusume':    'Baseus バッテリー\n徹底比較レビュー',
  'aliexpress-what-is':               'AliExpress完全ガイド\n初心者向け解説',
  'aliexpress-choice':                'AliExpress\n品質保証プログラム',
  'aliexpress-account':               'AliExpress\nアカウント作成ガイド',
};

const CAT_SUB = {
  basics:   'AliExpress\n完全ガイド',
  safety:   'AliExpress\n安全・安心ガイド',
  payment:  'AliExpress\n支払い方法ガイド',
  shipping: 'AliExpress\n配送・追跡ガイド',
  home:     'アリエクswipe\n格安商品情報',
  default:  'アリエクswipe\n格安商品情報',
};

// 手動改行（自動折り返しがうまくいかないスラッグ用）
const SLUG_TITLE_MANUAL = {
  'index': null, // index は別レイアウト（アイコン使用）
};

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 折り返し（スペース/句読点を優先。切れた場合は末尾に「…」）
function wrapText(text, maxLen = 14) {
  const breakChars = new Set(['、', '。', '？', '！', '】', '」', '・', ' ']);
  const lines = [];
  let current = text.trim();
  while (current.length > maxLen && lines.length < 3) {
    let idx = -1;
    for (let i = maxLen; i >= maxLen - 10; i--) {
      if (i >= 0 && breakChars.has(current[i])) { idx = i + 1; break; }
    }
    if (idx === -1) idx = maxLen;
    lines.push(current.slice(0, idx).trim());
    current = current.slice(idx).trim();
  }
  if (lines.length < 3) {
    if (current) lines.push(current);
  } else if (current) {
    // 3行で収まらない → 最終行を短縮して「…」
    let last = lines[2];
    while (last.length > maxLen - 1) last = last.slice(0, -1);
    lines[2] = last + '…';
  }
  return lines;
}

function buildArticleSvg({ title, category, slug }) {
  const color = CAT_COLOR[category] || CAT_COLOR.default;

  const titleLines = wrapText(title, 14);
  const lineH  = 64;
  const totalH = titleLines.length * lineH;
  const startY = 90 + (540 - totalH) / 2 + lineH * 0.8;

  const titleEls = titleLines.map((line, i) =>
    `<text x="68" y="${startY + i * lineH}"
      font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
      font-size="46" font-weight="900" fill="#111827"
      clip-path="url(#leftArea)">${escXml(line)}</text>`
  ).join('\n    ');

  const subRaw  = SLUG_SUB[slug] || CAT_SUB[category] || CAT_SUB.default;
  const subLines = subRaw.split('\n');
  const subEls  = subLines.map((line, i) =>
    `<text x="1010" y="${280 + i * 52}"
      font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
      font-size="34" font-weight="700" fill="${color}" text-anchor="middle"
      opacity="0.85">${escXml(line)}</text>`
  ).join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="leftArea"><rect x="0" y="0" width="770" height="630"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#fafbfc"/>
  <rect x="790" y="0" width="410" height="630" fill="${color}" opacity="0.05"/>
  <circle cx="1010" cy="330" r="240" fill="${color}" opacity="0.08"/>
  <circle cx="1010" cy="330" r="160" fill="${color}" opacity="0.08"/>
  <circle cx="1010" cy="330" r="80"  fill="${color}" opacity="0.10"/>
  <rect x="0" y="0" width="10" height="630" fill="${color}"/>
  <rect x="0" y="0" width="1200" height="90" fill="${color}"/>
  <text x="68" y="55"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="30" font-weight="700" fill="white">アリエクswipe</text>
  <text x="68" y="78"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="18" fill="rgba(255,255,255,0.75)">AliExpress格安商品スワイプアプリ</text>
  <line x1="790" y1="90" x2="790" y2="630" stroke="${color}" stroke-width="1.5" opacity="0.15"/>
  ${titleEls}
  ${subEls}
  <text x="1010" y="560"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="48" font-weight="900" fill="${color}" text-anchor="middle" opacity="0.18">SWIPE</text>
  <text x="68" y="608"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="22" fill="#9ca3af">${DOMAIN}</text>
</svg>`;
}

// index専用: ロゴ画像をコンポジット
async function buildIndexImage(outPath) {
  const color = CAT_COLOR.home;

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#fafbfc"/>
  <rect x="0" y="0" width="10" height="630" fill="${color}"/>
  <rect x="0" y="0" width="1200" height="90" fill="${color}"/>
  <text x="68" y="55"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="30" font-weight="700" fill="white">アリエクswipe</text>
  <text x="68" y="78"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="18" fill="rgba(255,255,255,0.75)">AliExpress格安商品スワイプアプリ</text>

  <!-- 右デコレーション（薄い円） -->
  <circle cx="960" cy="360" r="200" fill="${color}" opacity="0.05"/>
  <circle cx="960" cy="360" r="130" fill="${color}" opacity="0.05"/>

  <!-- タイトル（左、大きめ） -->
  <text x="68" y="250"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="60" font-weight="900" fill="#111827">アリエクswipe</text>
  <text x="68" y="330"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="38" font-weight="700" fill="#374151">お得情報・格安商品</text>

  <!-- サブコピー -->
  <text x="68" y="420"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="26" fill="${color}" font-weight="600">1,500件超のDBから、スワイプで見つける</text>

  <!-- ドメイン -->
  <text x="68" y="608"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="22" fill="#9ca3af">${DOMAIN}</text>
</svg>`;

  // app icon を右側にコンポジット
  const iconSize = 260;
  const iconLeft = 880;
  const iconTop  = Math.round((630 - iconSize) / 2);

  const iconBuffer = await sharp(path.resolve('public/icon-1024.png'))
    .resize(iconSize, iconSize)
    .toBuffer();

  const bgBuffer = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toBuffer();

  await sharp(bgBuffer)
    .composite([{ input: iconBuffer, left: iconLeft, top: iconTop }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);
}

// 対象HTMLを収集
function getAllHtmlFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllHtmlFiles(path.join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  });
  return files;
}

const SKIP = new Set(['admin.html','preview.html','template.html','nav.html','sitemap.html']);
const base = path.resolve('public');
let generated = 0;

for (const file of getAllHtmlFiles(base)) {
  const rel      = path.relative(base, file).replace(/\\/g, '/');
  const basename = path.basename(file);
  if (SKIP.has(basename)) continue;
  if (rel.startsWith('info/')) continue;

  const html     = fs.readFileSync(file, 'utf8');
  const parts    = rel.split('/');
  const category = parts.length > 1 ? parts[0] : 'home';
  const slug     = basename.replace('.html', '');
  const outPath  = path.join(OUT_DIR, `${slug}.jpg`);

  // index は専用レイアウト
  if (slug === 'index') {
    await buildIndexImage(outPath);
    console.log(`✅ ${slug}.jpg  [ロゴコンポジット]`);
    generated++;
    continue;
  }

  // og:title 優先、なければ title タグ
  const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
  const titleMatch   = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!ogTitleMatch && !titleMatch) continue;
  const title = ogTitleMatch
    ? ogTitleMatch[1].trim()
    : titleMatch[1].trim().replace(/ \| アリエクswipe.*$/, '').trim();

  const svg = buildArticleSvg({ title, category, slug });

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);

  console.log(`✅ ${slug}.jpg`);
  generated++;
}

console.log(`\n💾 ${generated}件生成 → public/images/ogp/`);
