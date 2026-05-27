/**
 * 全記事の cta-sticky を共通JSで一元管理する形に統一
 * - インライン内容を空にして <div id="cta-sticky"></div> に統一
 * - <script src="/js/cta-sticky.js"> を </body> 直前に追加
 * - インラインスタイル版も統一
 */
import fs from 'fs';
import path from 'path';

const DIRS = [
  'public/gadget', 'public/game', 'public/outdoor',
  'public/guide', 'public/safety', 'public/payment', 'public/shipping'
];

const SCRIPT_TAG = '<script src="/js/cta-sticky.js" defer></script>';

function processFile(filepath) {
  let html = fs.readFileSync(filepath, 'utf8');
  let changed = false;

  // 1. インラインスタイル版を統一
  html = html.replace(
    /<div id="cta-sticky"[^>]*style="[^"]*"[^>]*>[\s\S]*?<\/div>/g,
    '<div id="cta-sticky" class="cta-sticky"></div>'
  );

  // 2. インライン内容付き版を空にする
  html = html.replace(
    /<div class="cta-sticky"(?:\s+id="cta-sticky")?>([\s\S]*?)<\/div>/g,
    (match, inner) => {
      if (inner.trim() === '') return match; // 既に空
      changed = true;
      return '<div class="cta-sticky" id="cta-sticky"></div>';
    }
  );

  // 3. id="cta-sticky" がなければ追加
  html = html.replace(
    /<div class="cta-sticky"(?!\s+id="cta-sticky")>/g,
    () => { changed = true; return '<div class="cta-sticky" id="cta-sticky">'; }
  );

  // 4. scriptタグがなければ </body> 直前に追加
  if (!html.includes('cta-sticky.js')) {
    html = html.replace('</body>', `${SCRIPT_TAG}\n</body>`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filepath, html, 'utf8');
    return 'fixed';
  }

  // scriptタグだけ追加が必要な場合
  if (!html.includes('cta-sticky.js') && html.includes('cta-sticky')) {
    html = html.replace('</body>', `${SCRIPT_TAG}\n</body>`);
    fs.writeFileSync(filepath, html, 'utf8');
    return 'script-added';
  }

  return 'ok';
}

let fixed = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const file of files) {
    const result = processFile(path.join(dir, file));
    if (result !== 'ok') {
      console.log(`✅ ${dir}/${file} (${result})`);
      fixed++;
    }
  }
}
console.log(`\n完了: ${fixed}件更新`);
