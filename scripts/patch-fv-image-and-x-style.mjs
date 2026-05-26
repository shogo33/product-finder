/**
 * 既存記事への一括パッチスクリプト
 * 1. .reddit-quote を赤からX黒カラーに変更
 * 2. ファーストビュー商品画像をTOC直前に注入
 *
 * 使い方: node scripts/patch-fv-image-and-x-style.mjs
 */
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR   = path.resolve('public');
const ARTICLES_DIR = path.resolve('data/articles');
const CATEGORIES   = ['gadget', 'game', 'outdoor'];

const OLD_QUOTE_CSS = `.reddit-quote { background: #fff8f8; border-left: 4px solid var(--red); border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: var(--red); text-decoration: none; }`;

const NEW_QUOTE_CSS = `.reddit-quote { background: #f7f9f9; border-left: 4px solid #0f1419; border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: #0f1419; text-decoration: none; }
    .reddit-voices h2 { border-left-color: #0f1419 !important; }

    /* ファーストビュー商品画像 */
    .fv-product-image { margin: 0 0 28px; text-align: center; }
    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }`;

// 旧形式（components未定義コメントあり）
const OLD_QUOTE_CSS_V2 = `/* Reddit引用（components.jsに未定義のため個別追加） */
    .reddit-quote { background: #fff8f8; border-left: 4px solid var(--red); border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: var(--red); text-decoration: none; }`;

const NEW_QUOTE_CSS_V2 = `/* Reddit引用 / Xの声（Xブランドカラー=黒系） */
    .reddit-quote { background: #f7f9f9; border-left: 4px solid #0f1419; border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: #0f1419; text-decoration: none; }
    .reddit-voices h2 { border-left-color: #0f1419 !important; }

    /* ファーストビュー商品画像 */
    .fv-product-image { margin: 0 0 28px; text-align: center; }
    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }`;

let patched = 0;
let skipped = 0;

for (const cat of CATEGORIES) {
  const catDir = path.join(PUBLIC_DIR, cat);
  if (!fs.existsSync(catDir)) continue;

  const htmlFiles = fs.readdirSync(catDir).filter(f => f.endsWith('-osusume.html'));

  for (const file of htmlFiles) {
    const slug = file.replace('.html', '');
    const htmlPath = path.join(catDir, file);
    const researchPath = path.join(ARTICLES_DIR, `${slug}-research.json`);

    let html = fs.readFileSync(htmlPath, 'utf8');
    let changed = false;

    // ① Xカラーパッチ（旧形式v2）
    if (html.includes(OLD_QUOTE_CSS_V2)) {
      html = html.replace(OLD_QUOTE_CSS_V2, NEW_QUOTE_CSS_V2);
      changed = true;
    }
    // ① Xカラーパッチ（旧形式v1）
    else if (html.includes(OLD_QUOTE_CSS)) {
      html = html.replace(OLD_QUOTE_CSS, NEW_QUOTE_CSS);
      changed = true;
    }

    // ② ファーストビュー画像注入（まだなければ）
    if (!html.includes('fv-product-image')) {
      let fvImage = null;
      let fvName  = '';

      // research.jsonがあればそこから取得
      if (fs.existsSync(researchPath)) {
        const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
        fvImage = research.products?.[0]?.images?.[0];
        fvName  = research.products?.[0]?.cleanName ?? '';
      }

      // なければHTML内の最初のproduct画像を取得
      if (!fvImage) {
        const imgMatch = html.match(/<img[^>]+src="(\/images\/products\/[^"]+)"[^>]*alt="([^"]*)"[^>]*>/);
        if (imgMatch) {
          fvImage = imgMatch[1];
          fvName  = imgMatch[2];
        }
      }

      if (fvImage) {
        // CSSにfv-product-imageが未定義なら</style>直前に追加
        if (!html.includes('.fv-product-image')) {
          html = html.replace('</style>', `    .fv-product-image { margin: 0 0 28px; text-align: center; }\n    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }\n  </style>`);
        }
        const fvHtml = `<figure class="fv-product-image">\n  <img src="${fvImage}" alt="${fvName}" loading="eager">\n</figure>`;
        const before = html.length;
        html = html.replace(/(<(?:nav|div)[^>]*class="toc")/, `${fvHtml}\n$1`);
        if (html.length !== before) changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(htmlPath, html, 'utf8');
      console.log(`✅ ${cat}/${file}`);
      patched++;
    } else {
      console.log(`⏭  skip: ${cat}/${file}`);
      skipped++;
    }
  }
}

console.log(`\n完了: ${patched}件更新, ${skipped}件スキップ`);
