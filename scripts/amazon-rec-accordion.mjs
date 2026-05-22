/**
 * amazon-rec セクションの変更:
 * 1. "Amazonで見る →" → "Amazonで見る"（矢印削除）
 * 2. アコーディオン化（デフォルト3件表示・もっと見るボタン）
 */
import fs from 'fs';
import path from 'path';

const BASE = path.resolve('public/basics');

const files = [
  'aliexpress-osusume.html',
  'aliexpress-projector-under-10000.html',
  'aliexpress-sticker-osusume.html',
  'baseus-mobile-battery-osusume.html',
  'naturehike-airmat-osusume.html',
  'naturehike-brand.html',
  'naturehike-osusume.html',
  'naturehike-tent-osusume.html',
  'ugreen-cable-osusume.html',
  'ugreen-earphone-osusume.html',
  'ugreen-mouse-osusume.html',
];

// 追加するCSS（既存の .amazon-rec-cta 定義の後に挿入）
const extraCss = `
    .amazon-rec-list:not(.expanded) .amazon-rec-item:nth-child(n+4) { display: none; }
    .amazon-rec-toggle { display: block; text-align: center; margin-top: 12px; color: #f59e0b; font-size: 0.82rem; font-weight: 700; cursor: pointer; background: none; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; width: 100%; }
    .amazon-rec-toggle:hover { background: #fff8f0; }`;

// トグルボタン HTML（インデント8スペース版）
const toggleBtn8 = `        <button class="amazon-rec-toggle" onclick="this.previousElementSibling.classList.toggle('expanded');this.textContent=this.previousElementSibling.classList.contains('expanded')?'閉じる':'もっと見る'">もっと見る</button>\n`;
// トグルボタン HTML（インデント4スペース版）
const toggleBtn4 = `    <button class="amazon-rec-toggle" onclick="this.previousElementSibling.classList.toggle('expanded');this.textContent=this.previousElementSibling.classList.contains('expanded')?'閉じる':'もっと見る'">もっと見る</button>\n`;

for (const name of files) {
  const file = path.join(BASE, name);
  let html = fs.readFileSync(file, 'utf8');

  // 1. 矢印削除
  html = html.replaceAll('Amazonで見る →', 'Amazonで見る');

  // 2. アコーディオン CSS 追加（まだ未追加の場合のみ）
  if (!html.includes('amazon-rec-toggle')) {
    const cssAnchor = '.amazon-rec-cta { font-size: 0.78rem; color: #f59e0b; font-weight: 700; white-space: nowrap; flex-shrink: 0; }';
    html = html.replace(cssAnchor, cssAnchor + extraCss);

    // 3. トグルボタン挿入（amazon-rec-list の閉じタグの直後）
    const listStart = html.indexOf('<div class="amazon-rec-list">');
    if (listStart === -1) {
      console.error(`❌ amazon-rec-list not found: ${name}`);
      continue;
    }

    // 8スペース閉じか4スペース閉じかを判定
    const close8 = '        </div>';
    const close4 = '    </div>';
    let closingDiv = close8;
    let closeIdx = html.indexOf(close8, listStart);
    if (closeIdx === -1) {
      closingDiv = close4;
      closeIdx = html.indexOf(close4, listStart);
    }
    if (closeIdx === -1) {
      console.error(`❌ closing </div> not found: ${name}`);
      continue;
    }

    // 閉じタグの後ろにボタンを挿入
    const afterClose = closeIdx + closingDiv.length;
    const btn = (closingDiv === close8) ? toggleBtn8 : toggleBtn4;
    html = html.slice(0, afterClose) + '\n' + btn + html.slice(afterClose);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${name}`);
}

console.log('\nDone!');
