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

// スラッグ別サブタイトル（右側の装飾テキスト）
const SLUG_SUB = {
  'index':                            '1,500件超のDBから\nスワイプで見つける',
  'aliexpress-osusume':               '1,500件超のDBから\nカテゴリ別に厳選',
  'aliexpress-sticker-osusume':       'かわいい・おしゃれ\nシール＆ケース特集',
  'aliexpress-projector-under-10000': '1万円以下の\nプロジェクター厳選',
  'ugreen-cable-osusume':             'UGREEN ケーブル\n徹底比較レビュー',
  'ugreen-earphone-osusume':          'UGREEN イヤホン\n徹底比較レビュー',
  'ugreen-mouse-osusume':             'UGREEN マウス\n徹底比較レビュー',
  'baseus-mobile-battery-osusume':    'Baseus モバイルバッテリー\n徹底比較レビュー',
  'aliexpress-what-is':               'AliExpress完全ガイド\n初心者向け解説',
  'aliexpress-choice':                'AliExpressの\n品質保証プログラム',
  'aliexpress-account':               'AliExpress\nアカウント作成ガイド',
};

// デフォルトサブテキスト（カテゴリ別）
const CAT_SUB = {
  basics:   'AliExpress\n完全ガイド',
  safety:   'AliExpress\n安全・安心ガイド',
  payment:  'AliExpress\n支払い方法ガイド',
  shipping: 'AliExpress\n配送・追跡ガイド',
  home:     'アリエクswipe\n格安商品情報',
  default:  'アリエクswipe\n格安商品情報',
};

// 14文字前後で日本語テキストを折り返す（左エリア702px / 46px font ≈ 15chars）
function wrapText(text, maxLen = 14) {
  if (text.length <= maxLen) return [text];
  const breakChars = ['・', '、', '。', '？', '！', '】', '｜', '「', '」', ' '];
  const lines = [];
  let current = text;
  while (current.length > maxLen) {
    let idx = -1;
    for (let i = maxLen; i >= maxLen - 8; i--) {
      if (breakChars.includes(current[i])) { idx = i + 1; break; }
    }
    if (idx === -1) idx = maxLen;
    lines.push(current.slice(0, idx));
    current = current.slice(idx);
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function buildSvg({ title, category, slug }) {
  const color = CAT_COLOR[category] || CAT_COLOR.default;

  // タイトル折り返し（左エリア702px / 46px font ≈ 15chars）
  const lines  = wrapText(title, 14);
  const lineH  = 64;
  const totalH = lines.length * lineH;
  // タイトルエリア縦中央 (上部バー90px考慮、全高630px)
  const startY = 90 + (540 - totalH) / 2 + lineH * 0.8;

  const titleEls = lines.map((line, i) =>
    `<text x="68" y="${startY + i * lineH}"
      font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
      font-size="46" font-weight="900" fill="#111827"
      clip-path="url(#leftArea)">${escXml(line)}</text>`
  ).join('\n    ');

  // 右エリアサブテキスト
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
    <clipPath id="leftArea">
      <rect x="0" y="0" width="770" height="630"/>
    </clipPath>
  </defs>

  <!-- 背景 -->
  <rect width="1200" height="630" fill="#fafbfc"/>

  <!-- 右側カラーエリア -->
  <rect x="790" y="0" width="410" height="630" fill="${color}" opacity="0.05"/>

  <!-- 右側デコレーション円 -->
  <circle cx="1010" cy="330" r="240" fill="${color}" opacity="0.08"/>
  <circle cx="1010" cy="330" r="160" fill="${color}" opacity="0.08"/>
  <circle cx="1010" cy="330" r="80"  fill="${color}" opacity="0.10"/>

  <!-- 左装飾バー -->
  <rect x="0" y="0" width="10" height="630" fill="${color}"/>

  <!-- 上部ブランドバー -->
  <rect x="0" y="0" width="1200" height="90" fill="${color}"/>
  <text x="68" y="55"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="30" font-weight="700" fill="white">アリエクswipe</text>
  <text x="68" y="78"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="18" fill="rgba(255,255,255,0.75)">AliExpress格安商品スワイプアプリ</text>

  <!-- 分割ライン -->
  <line x1="790" y1="90" x2="790" y2="630" stroke="${color}" stroke-width="1.5" opacity="0.15"/>

  <!-- タイトル（左エリア） -->
  ${titleEls}

  <!-- 右エリア: サブテキスト -->
  ${subEls}

  <!-- 右エリア: 下部ロゴマーク -->
  <text x="1010" y="560"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="48" font-weight="900" fill="${color}" text-anchor="middle"
    opacity="0.18">SWIPE</text>

  <!-- ドメイン（左下） -->
  <text x="68" y="608"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="22" fill="#9ca3af">${DOMAIN}</text>
</svg>`;
}

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 対象ファイルを収集
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

  // タイトル抽出: og:title 優先、なければ title タグ
  const html       = fs.readFileSync(file, 'utf8');
  const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
  const titleMatch   = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!ogTitleMatch && !titleMatch) continue;
  const title = ogTitleMatch
    ? ogTitleMatch[1].trim()
    : titleMatch[1].trim().replace(/ \| アリエクswipe.*$/, '').trim();

  // カテゴリ・スラッグ
  const parts    = rel.split('/');
  const category = parts.length > 1 ? parts[0] : 'home';
  const slug     = basename.replace('.html', '');

  const svg     = buildSvg({ title, category, slug });
  const outPath = path.join(OUT_DIR, `${slug}.jpg`);

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);

  console.log(`✅ ${slug}.jpg`);
  generated++;
}

console.log(`\n💾 ${generated}件生成 → public/images/ogp/`);
