/**
 * 記事別OGP画像 (1200×630 JPEG) を生成するスクリプト
 * 出力先: public/images/ogp/{slug}.jpg
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DOMAIN  = 'https://product-finder-lilac.vercel.app';
const OUT_DIR = path.resolve('public/images/ogp');
fs.mkdirSync(OUT_DIR, { recursive: true });

// カテゴリ別アクセントカラー
const CAT_COLOR = {
  basics:   '#3b82f6',
  safety:   '#22c55e',
  payment:  '#a855f7',
  shipping: '#f97316',
  home:     '#e8253a',
  default:  '#e8253a',
};

// 20文字前後で日本語テキストを折り返す（句読点優先）
function wrapText(text, maxLen = 22) {
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
  return lines.slice(0, 3); // 最大3行
}

function buildSvg({ title, category, slug }) {
  const color     = CAT_COLOR[category] || CAT_COLOR.default;
  const lines     = wrapText(title);
  const lineH     = 68;
  const totalH    = lines.length * lineH;
  const startY    = 315 - totalH / 2 + 20; // 縦中央（赤バー分+20px）

  const textEls = lines.map((line, i) =>
    `<text x="600" y="${startY + i * lineH}" font-family="'Meiryo','Yu Gothic','MS Gothic',sans-serif"
      font-size="46" font-weight="700" fill="#1a1a1a" text-anchor="middle">${escXml(line)}</text>`
  ).join('\n    ');

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- 背景 -->
  <rect width="1200" height="630" fill="#ffffff"/>

  <!-- 左デコレーション -->
  <rect x="0" y="0" width="12" height="630" fill="${color}"/>
  <circle cx="60" cy="315" r="180" fill="${color}" opacity="0.06"/>

  <!-- 上部ブランドバー -->
  <rect x="0" y="0" width="1200" height="80" fill="${color}"/>
  <text x="56" y="52" font-family="'Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="28" font-weight="700" fill="white">アリエクswipe｜AliExpressお得情報</text>

  <!-- タイトル -->
  ${textEls}

  <!-- ドメイン -->
  <text x="600" y="598" font-family="'Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="22" fill="#9ca3af" text-anchor="middle">${DOMAIN}</text>
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

  // タイトル抽出
  const html     = fs.readFileSync(file, 'utf8');
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!titleMatch) continue;
  const title    = titleMatch[1].trim().replace(/ \| アリエクswipe.*$/, '').trim();

  // カテゴリ・スラッグ
  const parts    = rel.split('/');
  const category = parts.length > 1 ? parts[0] : 'home';
  const slug     = basename.replace('.html', '');

  const svg = buildSvg({ title, category, slug });
  const outPath = path.join(OUT_DIR, `${slug}.jpg`);

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);

  console.log(`✅ ${slug}.jpg`);
  generated++;
}

console.log(`\n💾 ${generated}件生成 → public/images/ogp/`);
