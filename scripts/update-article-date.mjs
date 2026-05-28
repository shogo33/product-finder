/**
 * update-article-date.mjs <slug> [YYYY-MM-DD]
 * 記事の更新日を手動で変更する。
 * 日付省略時は今日の日付を使用。
 *
 * 使い方:
 *   node scripts/update-article-date.mjs ugreen-mouse-osusume
 *   node scripts/update-article-date.mjs ugreen-mouse-osusume 2026-06-01
 */
import fs from 'fs';

const DATES_FILE = 'data/article-dates.json';

const slug = process.argv[2];
const dateArg = process.argv[3];

if (!slug) {
  console.error('使い方: node scripts/update-article-date.mjs <slug> [YYYY-MM-DD]');
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];
const newDate = dateArg || today;

if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
  console.error('日付形式は YYYY-MM-DD にしてください');
  process.exit(1);
}

const dates = fs.existsSync(DATES_FILE)
  ? JSON.parse(fs.readFileSync(DATES_FILE, 'utf8'))
  : {};

if (!dates[slug]) {
  console.error(`"${slug}" は article-dates.json に見つかりません`);
  console.error('既存のスラッグ一覧:', Object.keys(dates).join(', '));
  process.exit(1);
}

const before = dates[slug].modified;
dates[slug].modified = newDate;
fs.writeFileSync(DATES_FILE, JSON.stringify(dates, null, 2), 'utf8');

console.log(`✅ ${slug}`);
console.log(`   更新日: ${before} → ${newDate}`);
console.log(`   公開日: ${dates[slug].published}（変更なし）`);
console.log('\nnpm run gen-all を実行してHTMLに反映してください');
