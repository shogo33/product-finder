import fs from 'fs';

const files = [
  'public/basics/naturehike-osusume.html',
  'public/basics/naturehike-tent-osusume.html',
  'public/basics/naturehike-airmat-osusume.html',
  'public/basics/naturehike-cot-osusume.html',
  'public/basics/naturehike-sleeping-bag-osusume.html',
  'public/basics/naturehike-brand.html',
  'public/images/naturehike-brand.svg',
];

const replacements = [
  // CSS変数の値を緑→赤に
  ['--green:   #16a34a', '--green:   #e8253a'],
  ['--green-dk:#15803d', '--green-dk:#c2185b'],
  ['--green: #16a34a',   '--green: #e8253a'],
  ['--green-dk:#15803d', '--green-dk:#c2185b'],
  // 直接カラー
  ['#16a34a', '#e8253a'],
  ['#15803d', '#c2185b'],
  ['#059669', '#c2185b'],
  ['#4ade80', '#f87171'],
  ['#86efac', '#fca5a5'],
  ['#f0fdf4', '#fff1f2'],
  ['#0a2218', '#0f172a'],  // SVG背景：緑→ダークネイビー
  ['#1a4a2e', '#1a1a2e'],
  ['#22643c', '#2d2d5e'],
  ['#0f3320', '#1e293b'],
  ['rgba(22,163,74,', 'rgba(232,37,58,'],
];

for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`skip ${f}`); continue; }
  let c = fs.readFileSync(f, 'utf8');
  for (const [from, to] of replacements) {
    c = c.replaceAll(from, to);
  }
  fs.writeFileSync(f, c, 'utf8');
  console.log(`✅ ${f}`);
}
