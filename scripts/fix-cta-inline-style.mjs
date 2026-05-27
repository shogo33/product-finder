/**
 * .cta-inline を「白背景・グラデーション枠」デザインに一括更新
 * - 全面グラデーション → 白背景 + 3px グラデーションボーダー
 * - ボタン: 白/赤 → グラデーション塗り/白文字
 * - ボタンテキスト末尾の「 →」を削除
 */
import fs from 'fs';
import path from 'path';

const DIRS = ['public/gadget','public/game','public/outdoor','public/guide','public/safety','public/payment','public/shipping'];

function processFile(filepath) {
  let html = fs.readFileSync(filepath, 'utf8');
  if (!html.includes('cta-inline')) return 'skip';
  const original = html;

  // 1. メインのcta-inline CSS（グラデーション背景 → 白背景+グラデーション枠）
  //    border-radius の値（var(--radius) or 12px など）は保持
  html = html.replace(
    /\.cta-inline \{ background: linear-gradient\([^)]+\)[^;]*;(\s*border-radius: ([^;]+);)\s*padding: ([^;]+);\s*text-align: center;\s*margin: ([^;]+);\s*color: #fff;\s*\}/g,
    (match, _brPart, brValue, padding, margin) =>
      `.cta-inline { background: linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#e8253a 0%,#ff6b35 100%) border-box; border: 3px solid transparent; border-radius: ${brValue}; padding: ${padding}; text-align: center; margin: ${margin}; color: #1a1a1a; }`
  );

  // 2. .cta-label（opacity → グラデーション文字）
  html = html.replace(
    /\.cta-inline \.cta-label \{[^}]+opacity: 0\.85;[^}]+\}/g,
    '.cta-inline .cta-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; background: linear-gradient(135deg,#e8253a 0%,#ff6b35 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }'
  );

  // 3. h3（font-size は保持、色追加）
  html = html.replace(
    /\.cta-inline h3 \{ (font-size: [^;]+;) font-weight: 700; margin-bottom: 8px; \}/g,
    '.cta-inline h3 { $1 font-weight: 700; margin-bottom: 8px; color: #111; }'
  );

  // 4. p（opacity → color）
  html = html.replace(
    /\.cta-inline p \{ font-size: 0\.85rem; opacity: 0\.9; margin-bottom: 20px; \}/g,
    '.cta-inline p { font-size: 0.85rem; color: #6b7280; margin-bottom: 20px; }'
  );

  // 5. a（白背景/赤文字 → グラデーション塗り/白文字）
  //    transition あり・なし両対応
  html = html.replace(
    /\.cta-inline a \{ display: inline-block; background: #fff; color: [^;]+; font-weight: 700; font-size: 0\.9rem; padding: 12px 28px; border-radius: 999px; text-decoration: none;[^}]*\}/g,
    '.cta-inline a { display: inline-block; background: linear-gradient(135deg,#e8253a 0%,#ff6b35 100%); color: #fff; font-weight: 700; font-size: 0.9rem; padding: 12px 28px; border-radius: 999px; text-decoration: none; transition: opacity 0.15s; }'
  );

  // 6. a:hover
  html = html.replace(
    /\.cta-inline a:hover \{ transform: translateY\(-2px\); box-shadow: [^}]+\}/g,
    '.cta-inline a:hover { opacity: 0.88; transform: translateY(-2px); }'
  );

  // 7. ボタンテキスト末尾の「 →」を削除（cta-inline div 内の <a> タグ内）
  html = html.replace(
    /(<div class="cta-inline">[\s\S]*?<\/div>)/g,
    (block) => block.replace(/ →<\/a>/g, '</a>')
  );

  if (html === original) return 'no-change';
  fs.writeFileSync(filepath, html, 'utf8');
  return 'updated';
}

let updated = 0, skipped = 0, noChange = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html')) {
    const result = processFile(path.join(dir, file));
    if (result === 'updated') { console.log(`✅ ${dir}/${file}`); updated++; }
    else if (result === 'no-change') { console.log(`⚠️  ${dir}/${file} (変更なし)`); noChange++; }
    else skipped++;
  }
}
console.log(`\n完了: ${updated} 更新, ${noChange} 変更なし, ${skipped} スキップ`);
