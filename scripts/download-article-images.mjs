/**
 * download-article-images.mjs
 * public/basics/ 内の全記事HTMLに含まれる外部画像URLを
 * ローカル(public/images/products/{slug}/)にダウンロードし、
 * 記事HTML内の src を相対パスに書き換える。
 *
 * 使い方: node scripts/download-article-images.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ARTICLE_DIRS = ['gadget','game','outdoor','guide','safety','payment','shipping'].map(d => `public/${d}`);
const IMAGES_BASE  = 'public/images/products';
const CONCURRENCY  = 4;   // 並列ダウンロード数
const TIMEOUT_MS   = 20000;

// 記事ファイル名 → ディレクトリ名
const slugFromFile = (filename) => filename.replace(/\.html$/, '');

// URLから拡張子を取得（クエリ除去）
function extFromUrl(url) {
  const p = url.split('?')[0];
  const m = p.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) return null; // 壊れた画像を除外
      return buf;
    } catch (_) {
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// URLの安定したハッシュ（先頭8文字）
function urlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
}

async function processFile(htmlFile, dir) {
  const slug = slugFromFile(htmlFile);
  const htmlPath = path.join(dir, htmlFile);
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 外部imgを全部抽出（重複含む）
  const allMatches = [...html.matchAll(/<img([^>]+)src="(https?:\/\/[^"]+)"/g)];
  if (allMatches.length === 0) return { slug, downloaded: 0, failed: 0, skipped: 0 };

  // URLの重複排除（同じURLは1回だけダウンロード）
  const uniqueUrls = [...new Set(allMatches.map(m => m[2]))];

  const outDir = path.join(IMAGES_BASE, slug);
  fs.mkdirSync(outDir, { recursive: true });

  // 既存ファイルの対応表を読み込む
  const urlMap = {}; // originalUrl → localPath
  const mapFile = path.join(outDir, '_urlmap.json');
  if (fs.existsSync(mapFile)) {
    Object.assign(urlMap, JSON.parse(fs.readFileSync(mapFile, 'utf8')));
  }

  let downloaded = 0, failed = 0, skipped = 0;

  // バッチ並列ダウンロード
  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (url) => {
      // すでに対応表にあり、ファイルも存在する場合はスキップ
      if (urlMap[url] && fs.existsSync(path.join('public', urlMap[url]))) {
        skipped++;
        return;
      }

      const ext = extFromUrl(url);
      const hash = urlHash(url);
      const filename = `${hash}.${ext}`;
      const localRelPath = `/images/products/${slug}/${filename}`;
      const localAbsPath = path.join(outDir, filename);

      const buf = await fetchWithRetry(url);
      if (buf) {
        fs.writeFileSync(localAbsPath, buf);
        urlMap[url] = localRelPath;
        downloaded++;
        process.stdout.write('.');
      } else {
        failed++;
        process.stdout.write('x');
      }
    }));
  }

  // 対応表を保存
  fs.writeFileSync(mapFile, JSON.stringify(urlMap, null, 2), 'utf8');

  // HTMLのsrcを書き換え（対応表にあるもののみ）
  let newHtml = html;
  for (const [origUrl, localPath] of Object.entries(urlMap)) {
    // グローバル置換（同じURLが複数箇所にある場合も対応）
    newHtml = newHtml.replaceAll(`src="${origUrl}"`, `src="${localPath}"`);
  }

  if (newHtml !== html) {
    fs.writeFileSync(htmlPath, newHtml, 'utf8');
  }

  return { slug, downloaded, failed, skipped };
}

// ── メイン ──────────────────────────────────────────────────
const allFiles = [];
for (const dir of ARTICLE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html')) allFiles.push({ file: f, dir });
  }
}

console.log(`\n🔍 ${allFiles.length}ファイルを処理します...\n`);

let totalDown = 0, totalFail = 0, totalSkip = 0;

for (const { file, dir } of allFiles) {
  process.stdout.write(`\n[${file}] `);
  const r = await processFile(file, dir);
  totalDown += r.downloaded;
  totalFail += r.failed;
  totalSkip += r.skipped;
  console.log(` → 取得${r.downloaded} / スキップ${r.skipped} / 失敗${r.failed}`);
}

console.log(`\n✅ 完了: 取得${totalDown} / スキップ${totalSkip} / 失敗${totalFail}`);
if (totalFail > 0) {
  console.log('⚠️  失敗した画像はsrcが書き換えられていません。手動で確認してください。');
}
