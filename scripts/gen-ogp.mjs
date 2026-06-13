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
  gadget:   '#3b82f6',
  game:     '#7c3aed',
  outdoor:  '#16a34a',
  guide:    '#0ea5e9',
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
  'naturehike-osusume':               'Naturehike 小物7選\nアリエクで格安購入',
  'naturehike-tent-osusume':          'Naturehike テント5選\nアリエクで格安購入',
  'naturehike-airmat-osusume':        'Naturehike エアーマット5選\nアリエクで格安購入',
  'naturehike-brand':                 'Naturehike\nどこの国？評判を解説',
  'aliexpress-what-is':               'AliExpress完全ガイド\n初心者向け解説',
  'aliexpress-choice':                'AliExpress\n品質保証プログラム',
  'aliexpress-account':               'AliExpress\nアカウント作成ガイド',
};

const CAT_SUB = {
  gadget:   'アリエクswipe\nガジェット特集',
  game:     'アリエクswipe\nゲーム周辺機器',
  outdoor:  'アリエクswipe\nアウトドア特集',
  guide:    'アリエクswipe\n完全ガイド',
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

// 記事HTMLから商品画像URLを複数抽出（フォールバック用）
function extractProductImageUrls(html, slug) {
  const urls = [];
  // ローカル保存済み画像（/images/products/{slug}/...）を優先
  const localAll = [...html.matchAll(/src="(\/images\/products\/[^"]+\.(jpg|jpeg|png|webp))"/gi)];
  for (const m of localAll) {
    const localPath = m[1];
    const absPath = path.join(path.resolve('public'), localPath);
    if (!urls.includes(absPath) && fs.existsSync(absPath)) urls.push(absPath);
  }
  // 外部CDN画像（ローカル保存前のフォールバック）
  const aeAll = [...html.matchAll(/https?:\/\/ae-pic-a1\.aliexpress-media\.com\/kf\/[^\s"']+/gi)];
  for (const m of aeAll) {
    const url = m[0].split('"')[0].split("'")[0];
    if (!urls.includes(url)) urls.push(url);
  }
  const ugMatch = html.match(/https?:\/\/www\.ugreen\.com\/cdn\/shop\/files\/[^\s"'?]+/i);
  if (ugMatch) urls.push(ugMatch[0]);
  const baMatch = html.match(/https?:\/\/www\.baseus\.com\/cdn\/shop\/files\/[^\s"'?]+/i);
  if (baMatch) urls.push(baMatch[0]);
  return urls;
}

// 画像をフェッチ（ローカルファイルパスもサポート）
async function fetchImageBuffer(url) {
  try {
    // 絶対パスはローカルファイルとして読み込み
    if (path.isAbsolute(url)) {
      return fs.existsSync(url) ? fs.readFileSync(url) : null;
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGP/1.0)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ペルソナ画像の白背景を透明化
async function removeWhiteBg(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 10 || (r > 230 && g > 230 && b > 230)) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
    }
  }
  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// タイトルを短縮（「X選」で切る・【】除去）
function shortTitle(t) {
  let s = t.replace(/【[^】]*】/g, '').replace(/[｜|].*$/, '').trim();
  // 「X選」があればそこで切る
  const senMatch = s.match(/^(.+?[0-9０-９十]+選)/);
  if (senMatch) return senMatch[1];
  // なければ不要な後半を除去して24文字上限
  return s.replace(/[ 　]?(徹底比較|完全ガイド|完全解説|で選ぶ|について|を解説).*$/, '').trim().slice(0, 24);
}

// カテゴリ・スラッグからペルソナ画像パスを決定
function selectPersona(category, slug) {
  const isOutdoor = slug.includes('naturehike') || slug.includes('outdoor') || slug.includes('camp');
  const variant = isOutdoor ? 'outdoor' : 'gadget';
  const personaPath = path.resolve(`public/images/personas/persona-${variant}-surprised.png`);
  if (fs.existsSync(personaPath)) return personaPath;
  // フォールバック: 利用可能な任意のペルソナ
  const fallback = path.resolve('public/images/personas/persona-gadget-surprised.png');
  return fs.existsSync(fallback) ? fallback : null;
}

// YouTubeサムネ風OGP（商品画像＋ペルソナ＋白基調）
async function buildThumbnailOgp({ title, desc, category, slug, imageBuf, outPath }) {
  const color = CAT_COLOR[category] || CAT_COLOR.default;

  // 商品画像を左側背景に
  const bgBuf = await sharp(imageBuf)
    .resize(750, 630, { fit: 'cover', position: 'centre' })
    .toBuffer();

  // ペルソナ画像
  const personaPath = selectPersona(category, slug);
  let personaResized = null;
  let personaW = 0;
  if (personaPath) {
    const personaBuf = await removeWhiteBg(personaPath);
    personaResized = await sharp(personaBuf).resize({ height: 590, fit: 'inside' }).png().toBuffer();
    personaW = (await sharp(personaResized).metadata()).width;
  }

  // タイトルを2行に分割
  const st = shortTitle(title);
  const lines = wrapText(st, 12);
  const lineH = 72;
  const textStartY = lines.length === 1 ? 430 : lines.length === 2 ? 380 : 330;
  const titleEls = lines.map((line, i) =>
    `<text x="52" y="${textStartY + i * lineH}"
      font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
      font-size="68" font-weight="900" fill="#111827"
      paint-order="stroke" stroke="rgba(255,255,255,0.6)" stroke-width="6">${escXml(line)}</text>`
  ).join('\n  ');

  const descShort = (desc || '').replace(/。.*$/, '').slice(0, 32);

  const overlaySvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.97)"/>
      <stop offset="52%"  stop-color="rgba(255,255,255,0.62)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.0)"/>
    </linearGradient>
    <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="50%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.55)"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#gl)"/>
  <rect width="1200" height="630" fill="url(#gb)"/>
  <rect x="0" y="0" width="1200" height="7" fill="${color}"/>
  <text x="52" y="50"
    font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
    font-size="24" font-weight="700" fill="${color}">アリエクswipe</text>
  ${titleEls}
  <text x="52" y="${textStartY + lines.length * lineH + 10}"
    font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
    font-size="24" fill="#4b5563">${escXml(descShort)}</text>
</svg>`;

  const overlayBuf = await sharp(Buffer.from(overlaySvg)).resize(1200, 630).png().toBuffer();

  const composites = [
    { input: bgBuf, left: 0, top: 0 },
    ...(personaResized ? [{ input: personaResized, left: 1200 - personaW - 8, top: 630 - 590 + 8 }] : []),
    { input: overlayBuf, blend: 'over' },
  ];

  await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .png().toBuffer()
    .then(base => sharp(base).composite(composites).jpeg({ quality: 92, mozjpeg: true }).toFile(outPath));
}

// テキスト＋ペルソナフォーマット（商品画像なし記事用）
async function buildTextPersonaOgp({ title, category, slug, outPath }) {
  const color = CAT_COLOR[category] || CAT_COLOR.default;

  // カテゴリ別の背景テキスト（記事の内容を端的に）
  const ARTICLE_COPY = {
    'aliexpress-what-is':          ['アリエクって\nなに？', 'はじめての方向け\n完全ガイド'],
    'aliexpress-account':          ['アカウント\n作成方法', 'かんたん\n5ステップ'],
    'aliexpress-choice':           ['Choice\nとは？', '品質保証\nプログラム解説'],
    'aliexpress-coupon':           ['クーポン\n使い方', '最大XX%OFF\nお得な活用術'],
    'aliexpress-payment':          ['支払い方法\n完全ガイド', 'カード・PayPay\nコンビニ払い対応'],
    'aliexpress-paypal':           ['PayPal\n使えるの？', '支払い設定\nを解説'],
    'aliexpress-paypay':           ['PayPay\n使えるの？', '対応状況\nを解説'],
    'aliexpress-shiharai':         ['支払い方法\n完全ガイド', '安全に\n買い物する方法'],
    'aliexpress-safety':           ['アリエクは\n安全？', '詐欺・偽物\n対策10選'],
    'aliexpress-ayashii':          ['怪しい？\n大丈夫？', '安全に使う\nポイント解説'],
    'aliexpress-hyoban':           ['評判は\nどうなの？', 'リアルな\n口コミを解説'],
    'aliexpress-nannichi':         ['何日で\n届く？', '配送日数\nを徹底解説'],
    'aliexpress-standard-shipping':['Standard\nShipping', '配送方法\n完全ガイド'],
    'aliexpress-tracking-guide':   ['荷物追跡\nガイド', 'どこで\n確認できる？'],
    'aliexpress-tracking-number':  ['追跡番号\nの見方', '荷物の場所\nをチェック'],
    'aliexpress-tsuiseki':         ['荷物を\n追跡しよう', '発送から\n到着まで'],
    'naturehike-brand':            ['Naturehike\nってどこ？', '評判・品質\n徹底解説'],
    'aliexpress-vs-temu':          ['Temu vs\nアリエク', 'どっちがいい？\n徹底比較'],
    'aliexpress-sale-calendar':    ['セール\nカレンダー', '年間日程と\n攻略法2026'],
    'aliexpress-numa':             ['気づいたら\n沼ってた', 'ジャンル別\n沼ガイド'],
  };

  const copy = ARTICLE_COPY[slug];
  const mainText  = copy ? copy[0] : shortTitle(title);
  const subText   = copy ? copy[1] : '';

  // ペルソナ
  const personaPath = selectPersona(category, slug);
  let personaResized = null;
  let personaW = 0;
  if (personaPath) {
    const personaBuf = await removeWhiteBg(personaPath);
    personaResized = await sharp(personaBuf).resize({ height: 590, fit: 'inside' }).png().toBuffer();
    personaW = (await sharp(personaResized).metadata()).width;
  }

  const mainLines = mainText.split('\n');
  const subLines  = subText.split('\n');
  const mainEls = mainLines.map((line, i) =>
    `<text x="72" y="${260 + i * 96}"
      font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
      font-size="84" font-weight="900" fill="white">${escXml(line)}</text>`
  ).join('\n  ');
  const subEls = subLines.map((line, i) =>
    `<text x="72" y="${260 + mainLines.length * 96 + 20 + i * 44}"
      font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
      font-size="36" fill="rgba(255,255,255,0.80)">${escXml(line)}</text>`
  ).join('\n  ');

  const bgSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3755"/>
      <stop offset="100%" stop-color="#b91428"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="72" y="60"
    font-family="Meiryo,'Yu Gothic','MS Gothic',sans-serif"
    font-size="24" font-weight="700" fill="rgba(255,255,255,0.85)">アリエクswipe</text>
  ${mainEls}
  ${subEls}
</svg>`;

  const bgBuf = await sharp(Buffer.from(bgSvg)).resize(1200, 630).png().toBuffer();

  const composites = [
    ...(personaResized ? [{ input: personaResized, left: 1200 - personaW - 8, top: 630 - 590 + 8 }] : []),
  ];

  await sharp(bgBuf)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);
}

// フォールバック：テキストのみSVGフォーマット（商品画像なし記事用）
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

// ロゴの赤→白変換（白背景を透明に、赤要素を白に）
async function makeLogoWhite(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 10) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0; // 透明維持
    } else {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; // RGB→白、アルファは元を保持
    }
  }
  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// index専用: ブランドレッド背景 + 白抜きロゴを大きく中央配置
async function buildIndexImage(outPath) {
  const color = CAT_COLOR.home; // #e8253a

  // logo.png: 1482×257 → 幅900px にリサイズ
  const logoW = 900;
  const logoH = Math.round(logoW * (257 / 1482));
  const logoLeft = Math.round((1200 - logoW) / 2);
  const logoTop  = Math.round((630 - logoH) / 2) - 24; // 少し上寄り

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff3755"/>
      <stop offset="100%" stop-color="#b91428"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="${logoTop + logoH + 58}"
    font-family="'Noto Sans CJK JP','Meiryo','Yu Gothic','MS Gothic',sans-serif"
    font-size="26" fill="rgba(255,255,255,0.70)" text-anchor="middle">AliExpressの格安商品をスワイプで発見</text>
</svg>`;

  const logoWhite  = await makeLogoWhite(path.resolve('public/logo.png'));
  const logoBuffer = await sharp(logoWhite).resize(logoW, logoH).png().toBuffer();

  const bgBuffer = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toBuffer();

  await sharp(bgBuffer)
    .composite([{ input: logoBuffer, left: logoLeft, top: logoTop }])
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

  const descMatch = html.match(/property="og:description"\s+content="([^"]+)"/);
  const desc = descMatch ? descMatch[1].trim() : '';

  // 商品画像がある記事 → YouTubeサムネ風（複数URLを順に試す）
  const imageUrls = extractProductImageUrls(html, slug);
  let imageBuf = null;
  for (const url of imageUrls) {
    imageBuf = await fetchImageBuffer(url);
    if (imageBuf) break;
  }
  if (imageBuf) {
    await buildThumbnailOgp({ title, desc, category, slug, imageBuf, outPath });
    console.log(`✅ ${slug}.jpg  [サムネ]`);
    generated++;
    continue;
  }

  // 商品画像なし → テキスト＋ペルソナフォーマット
  await buildTextPersonaOgp({ title, category, slug, outPath });
  console.log(`✅ ${slug}.jpg  [テキスト]`);
  generated++;
}

console.log(`\n💾 ${generated}件生成 → public/images/ogp/`);
