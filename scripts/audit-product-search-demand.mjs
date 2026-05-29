/**
 * 各記事の掲載商品に対して keyword-all.csv の月間検索数を照合し CSV で出力
 * 出力: data/product-search-demand.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 汎用語ブロックリスト（単独トークンとして使わない） ──────────────
const GENERIC_SOLO = new Set([
  'マウス','充電器','ケーブル','イヤホン','ヘッドホン','キーボード','スタンド',
  'バッテリー','モバイルバッテリー','ハブ','ドック','ドッキングステーション',
  'コントローラー','ゲームパッド','タブレット','ミニpc','プロジェクター',
  'トラッカー','tracker','mouse','keyboard','charger','cable','hub',
  'battery','earphone','headphone','stand','controller','gamepad',
  'tablet','projector','wireless','wired','usb','type-c','typec',
  'aliexpress','アリエク','アリエクスプレス','おすすめ','比較','レビュー',
  'amazon','max','plus','mini','lite','gen','rgb','led',
  'dpi','ghz','mhz','hz','gb','tb','mb','mah','mm','cm',
  'ugreen','baseus','gamesir','anbernic','miyoo','retroid','8bitdo',
  'epomaker','ajazz','haylou','moondrop','sharge','kz','atk','gmktec',
  'ayaneo','akko','onetigris','naturehike','xiaomi',
  'ワイヤレス','有線','対応','搭載','付き','用','向け',
]);

// ── keyword-all.csv をロード ──────────────────────────────────────────
function loadKeywords() {
  const raw = fs.readFileSync(
    path.join(ROOT, 'data/keyword-csvs/keyword-all.csv'), 'utf8'
  );
  const lines = raw.replace(/^﻿/, '').split('\n');
  const headers = lines[0].split('\t');
  const kwIdx  = headers.indexOf('キーワード');
  const volIdx = headers.indexOf('月間検索数');

  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length <= volIdx) continue;
    const kw  = cols[kwIdx]?.trim();
    const vol = parseInt(cols[volIdx]) || 0;
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (!map.has(key) || map.get(key) < vol) map.set(key, vol);
  }
  return map;
}

// ── 商品名から検索トークンを生成 ─────────────────────────────────────
function extractTokens(rawTitle, cleanName) {
  const title  = (rawTitle  ?? '').toLowerCase();
  const cname  = (cleanName ?? '').toLowerCase();
  const both   = `${cname} ${title}`;

  const tokens = new Set();

  // ① cleanName 全体（スペース正規化）→ ブランド+モデルの組み合わせ
  const cleanNorm = cname.replace(/\s+/g, ' ').trim();
  if (cleanNorm.length >= 4) tokens.add(cleanNorm);

  // ② cleanName の連続2〜3トークン n-gram
  const cnTokens = cname.split(/\s+/).filter(t => t.length >= 2);
  for (let i = 0; i < cnTokens.length; i++) {
    if (!GENERIC_SOLO.has(cnTokens[i])) tokens.add(cnTokens[i]);
    if (i + 1 < cnTokens.length) {
      tokens.add(`${cnTokens[i]} ${cnTokens[i+1]}`);
    }
    if (i + 2 < cnTokens.length) {
      tokens.add(`${cnTokens[i]} ${cnTokens[i+1]} ${cnTokens[i+2]}`);
    }
  }

  // ③ 型番パターン（英字+数字 or 数字+英字）— 2文字以上
  const modelPat = /[a-z]{1,4}[\- ]?\d{2,5}[a-z\-]*|\d{2,5}[a-z]+/g;
  for (const m of both.matchAll(modelPat)) {
    const t = m[0].replace(/[-\s]/g, '').trim();
    if (t.length >= 2) tokens.add(t);
    tokens.add(m[0].trim()); // ハイフンつきも追加
  }

  // ④ ブランド + モデル 組み合わせ（n-gram にすでに含まれるが明示）
  // cleanName が "GameSir G7 SE" → "gamesir g7 se", "gamesir g7", "g7 se"
  // これらは上記 n-gram で生成済み

  return [...tokens].filter(t => t.length >= 2);
}

// ── キーワードマップから最大ボリュームを取得 ─────────────────────────
function lookupVolume(rawTitle, cleanName, kwMap) {
  const tokens = extractTokens(rawTitle, cleanName);
  let best = { vol: 0, matchedKw: '' };

  for (const [kw, vol] of kwMap) {
    for (const token of tokens) {
      // キーワードがトークンを含む（部分一致）かつ単独汎用語でない
      if (kw.includes(token) && !GENERIC_SOLO.has(token) && vol > best.vol) {
        best = { vol, matchedKw: kw };
      }
    }
    // またはトークンの一つがキーワード全体に一致（短いキーワードへの完全一致）
    for (const token of tokens) {
      if (token === kw && !GENERIC_SOLO.has(token) && vol > best.vol) {
        best = { vol, matchedKw: kw };
      }
    }
  }

  return { ...best, tokens: tokens.slice(0, 8) };
}

// ── slugからフォルダを逆引き ──────────────────────────────────────────
function buildSlugFolderMap() {
  const dirs = ['gadget','game','outdoor','guide','safety','payment','shipping'];
  const map = {};
  for (const dir of dirs) {
    const p = path.join(ROOT, 'public', dir);
    if (!fs.existsSync(p)) continue;
    fs.readdirSync(p)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .forEach(f => { map[f.replace('.html', '')] = dir; });
  }
  return map;
}

// ── HTMLから<title>を抽出 ────────────────────────────────────────────
function extractTitle(slug, folder) {
  if (!folder) return '';
  const htmlPath = path.join(ROOT, 'public', folder, slug + '.html');
  if (!fs.existsSync(htmlPath)) return '';
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1].replace(/ \| アリエクswipe.*$/, '').trim() : '';
}

// ── research JSON をすべて読み込む ────────────────────────────────────
function loadAllResearch(slugFolderMap) {
  const dir = path.join(ROOT, 'data/articles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-research.json'));
  const rows = [];
  for (const file of files) {
    const slug = file.replace('-research.json', '');
    const folder = slugFolderMap[slug] ?? '';
    const articleUrl = folder ? `https://aliswipe.com/${folder}/${slug}.html` : '';
    const articleTitle = extractTitle(slug, folder);
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const p of data.products ?? []) {
      rows.push({
        slug,
        articleTitle,
        articleUrl,
        cleanName:    p.cleanName  ?? '',
        rawTitle:     p.rawTitle   ?? '',
        price_jpy:    p.price_jpy  ?? '',
        productId:    p.product_id ?? '',
        aliexpressUrl: p.affiliateLink ?? '',
        amazonUrl:    p.amazonPlaceholder?.url ?? p.amazonUrl ?? '',
      });
    }
  }
  return rows;
}

// ── メイン ────────────────────────────────────────────────────────────
console.log('keyword-all.csv をロード中...');
const kwMap = loadKeywords();
console.log(`  キーワード数: ${kwMap.size.toLocaleString()}`);

const slugFolderMap = buildSlugFolderMap();

console.log('research JSON を読み込み中...');
const rows = loadAllResearch(slugFolderMap);
console.log(`  商品件数: ${rows.length}`);

console.log('照合中...');
const results = rows.map(r => {
  const { vol, matchedKw, tokens } = lookupVolume(r.rawTitle, r.cleanName, kwMap);
  return { ...r, vol, matchedKw, tokens };
});

results.sort((a, b) => a.slug.localeCompare(b.slug) || b.vol - a.vol);

// ── CSV 出力 ──────────────────────────────────────────────────────────
const csvLines = [
  ['記事スラッグ', '記事タイトル', '記事URL', '商品名(英)', '商品名(日)', '価格(円)', '月間検索数', 'マッチKW', 'AliExpress URL', 'Amazon URL'].join(','),
  ...results.map(r => [
    `"${r.slug}"`,
    `"${r.articleTitle.replace(/"/g, '""')}"`,
    `"${r.articleUrl}"`,
    `"${r.cleanName.replace(/"/g, '""')}"`,
    `"${r.rawTitle.slice(0, 60).replace(/"/g, '""')}"`,
    r.price_jpy,
    r.vol,
    `"${r.matchedKw.replace(/"/g, '""')}"`,
    `"${r.aliexpressUrl}"`,
    `"${r.amazonUrl}"`,
  ].join(',')),
];

const outPath = path.join(ROOT, 'data/product-search-demand.csv');
fs.writeFileSync(outPath, '﻿' + csvLines.join('\n'), 'utf8');
console.log(`\n✅ 出力完了: ${outPath}`);
console.log(`   総行数: ${results.length} 商品\n`);

// ── サマリー ──────────────────────────────────────────────────────────
const zero = results.filter(r => r.vol === 0);
const low  = results.filter(r => r.vol > 0   && r.vol < 100);
const mid  = results.filter(r => r.vol >= 100 && r.vol < 1000);
const high = results.filter(r => r.vol >= 1000);

console.log('📊 検索需要別内訳:');
console.log(`  高（1000以上）:   ${high.length} 件`);
console.log(`  中（100〜999）:   ${mid.length} 件`);
console.log(`  低（1〜99）:      ${low.length} 件`);
console.log(`  なし（0）:        ${zero.length} 件`);

if (low.length + zero.length > 0) {
  console.log('\n⚠️  要確認商品（検索数 99以下）:');
  [...zero, ...low].sort((a,b) => a.vol - b.vol).forEach(r =>
    console.log(`  vol=${r.vol.toString().padStart(4)} [${r.slug}]\n           ${r.cleanName}\n           tokens: ${r.tokens.slice(0,5).join(', ')}`)
  );
}
