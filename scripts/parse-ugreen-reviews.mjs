/**
 * UGREEN Amazonレビュー .txtファイルをパースして構造化JSONに変換
 * Usage: node scripts/parse-ugreen-reviews.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = 'data/ugreen/review';
const OUT = 'data/ugreen/review-parsed.json';

// ファイル名（拡張子除く） → ASIN マップ
const FILE_TO_ASIN = {
  'Nexode 25000mAh 200W (PB722)': 'B0CXHM5RY2',
  'Nexode 20000mAh 130W (PB721)': 'B0CXHNGDC1',
  'Nexode 12000mAh 100W (PB724)': 'B0CXJ1F1M7',
  'UGREEN Nexode 20000mAh 2way急速 100W ケーブル付き (25188)': 'B0C3GTMX5M',
  'UGREEN MagFlow マグネット式 10000mAh 25W Qi2 (PB773)': 'B0F37VLJQW',
  'UGREEN MagFlow Air 10000mAh 15W MagSafe (PB570)': 'B0F6NC41DZ',
  'Nexode 巻き取り20000mAh 165W (PB726)': 'B0DSPXHFBM',
  'Built-In USB-C 5000mAh 22.5W (PB503)': 'B0CXHRNVNW',
  'UGREEN Earcuff Earphones (45785)': 'B0DMZWD4JP',
};

function parseReviews(text) {
  // 各レビューは "ユーザー名" 行で始まり、"レポート" 行で終わる傾向
  // パターン: 名前\n5つ星のうちN.N タイトル\n日付に日本でレビュー済み\n[スタイル: ...]\n本文\nN人のお客様がこれが役に立ったと考えています(option)\n役に立った\nレポート

  const reviews = [];
  // 行分割
  const lines = text.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    // "5つ星のうち" 行を探す
    while (i < lines.length && !/^5つ星のうち[\d.]+/.test(lines[i])) i++;
    if (i >= lines.length) break;

    const ratingLine = lines[i];
    const ratingMatch = ratingLine.match(/^5つ星のうち([\d.]+)\s*(.*)$/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const title = ratingMatch ? ratingMatch[2].trim() : '';

    // 名前は1行前
    const author = (lines[i - 1] || '').trim();

    // 日付行
    i++;
    const dateLine = (lines[i] || '').trim();
    const dateMatch = dateLine.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : null;

    // スタイル行（あれば）
    i++;
    let style = '';
    if (lines[i] && /^スタイル:|^Style:|Amazonで購入/.test(lines[i])) {
      style = lines[i].replace('Amazonで購入', '').replace(/^スタイル:\s*/, '').trim();
      i++;
    }

    // 本文：「レポート」または次のユーザー名まで（次レビューの開始は空行 + 名前 + 「5つ星のうち」）
    const bodyLines = [];
    while (i < lines.length) {
      const line = lines[i];
      if (/^役に立った$|^レポート$|^レビュー を日本語に翻訳する$|^翻訳/.test(line.trim())) break;
      if (/^\d+人のお客様がこれが役に立った/.test(line)) break;
      if (line.trim() === '' && i + 2 < lines.length && /^5つ星のうち/.test(lines[i + 2])) break;
      bodyLines.push(line);
      i++;
    }

    // 役に立った数を抽出
    let helpful = 0;
    while (i < lines.length && !/^5つ星のうち/.test(lines[i])) {
      const hMatch = lines[i].match(/^(\d+)人のお客様がこれが役に立った/);
      if (hMatch) helpful = parseInt(hMatch[1], 10);
      i++;
    }
    if (i < lines.length) i--; // 次のレビューのratingLineに進めるよう調整

    const body = bodyLines.join('\n').trim();
    if (rating !== null && body.length > 0) {
      reviews.push({ author, rating, title, date, style, body, helpful });
    }
  }

  return reviews;
}

const result = {};
const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.txt'));
for (const f of files) {
  const baseName = f.replace(/\.txt$/, '');
  const asin = FILE_TO_ASIN[baseName];
  if (!asin) {
    console.warn('No ASIN mapping for:', baseName);
    continue;
  }
  const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const reviews = parseReviews(text);
  result[asin] = { fileName: baseName, reviews };
  console.log(`  ${asin} (${baseName.slice(0, 30)}...): ${reviews.length} reviews`);
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n✅ Saved: ${OUT}`);
console.log(`   Total products: ${Object.keys(result).length}`);
console.log(`   Total reviews: ${Object.values(result).reduce((s, r) => s + r.reviews.length, 0)}`);
