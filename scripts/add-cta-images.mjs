/**
 * add-cta-images.mjs
 * 各商品CTAボックスの先頭に product image を1枚挿入するスクリプト。
 * 画像ソース優先順位:
 *   1. cta-box より前に存在する最新の .carousel-track 1枚目 <img>
 *   2. fv-product-image 内の <img>
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = 'C:/Users/USER/product-finder';

function walkHtml(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkHtml(full));
    } else if (entry.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const files = walkHtml(path.join(ROOT, 'public'))
  .map(f => path.relative(ROOT, f).replace(/\\/g, '/'));

let totalFiles = 0;
let totalInserted = 0;

for (const file of files) {
  const fullPath = path.join(ROOT, file);
  const html = readFileSync(fullPath, 'utf8');

  if (!html.includes('class="cta-box"')) continue;

  // --- 画像ソースをすべて収集（position, src, alt）---
  const imageSources = [];

  // 1. carousel-track の最初の img
  const carouselRe = /class="carousel-track"[^>]*>\s*\n\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"/g;
  let m;
  while ((m = carouselRe.exec(html)) !== null) {
    imageSources.push({ pos: m.index, src: m[1], alt: m[2] });
  }

  // 2. fv-product-image 内の img (fallback)
  const fvRe = /class="fv-product-image"[^>]*>\s*\n\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"/g;
  while ((m = fvRe.exec(html)) !== null) {
    imageSources.push({ pos: m.index, src: m[1], alt: m[2] });
  }

  if (imageSources.length === 0) continue;

  // 位置順にソート
  imageSources.sort((a, b) => a.pos - b.pos);

  // --- cta-box の位置を全て収集 ---
  const ctaRe = /<div class="cta-box">/g;
  const ctaBoxes = [];
  while ((m = ctaRe.exec(html)) !== null) {
    // すでに cta-img が挿入済みならスキップ（冪等性）
    const after = html.slice(m.index + m[0].length, m.index + m[0].length + 200);
    if (after.includes('cta-img')) continue;
    ctaBoxes.push({ pos: m.index, end: m.index + m[0].length });
  }

  if (ctaBoxes.length === 0) continue;

  // --- 各 cta-box に最も近い前の画像を紐付け ---
  const insertions = [];
  for (const cta of ctaBoxes) {
    let bestImg = null;
    for (const img of imageSources) {
      if (img.pos < cta.pos) bestImg = img;
      else break;
    }
    if (!bestImg) continue;

    // cta-box 行のインデント取得
    const lineStart = html.lastIndexOf('\n', cta.pos) + 1;
    const indent = html.slice(lineStart, cta.pos).match(/^(\s*)/)[1];
    const imgHtml = `\n${indent}  <img class="cta-img" src="${bestImg.src}" alt="${bestImg.alt}" loading="lazy">`;
    insertions.push({ insertPos: cta.end, imgHtml });
  }

  if (insertions.length === 0) continue;

  // 後ろから挿入（位置ずれ防止）
  insertions.sort((a, b) => b.insertPos - a.insertPos);

  let newHtml = html;
  for (const { insertPos, imgHtml } of insertions) {
    newHtml = newHtml.slice(0, insertPos) + imgHtml + newHtml.slice(insertPos);
  }

  if (newHtml !== html) {
    writeFileSync(fullPath, newHtml, 'utf8');
    console.log(`✅ ${file} (+${insertions.length} images)`);
    totalFiles++;
    totalInserted += insertions.length;
  }
}

console.log(`\n完了: ${totalFiles} ファイル, ${totalInserted} 箇所に画像を挿入`);
