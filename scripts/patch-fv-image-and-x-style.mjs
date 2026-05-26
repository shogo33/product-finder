/**
 * 既存記事への一括パッチスクリプト
 * 1. .reddit-quote を赤からX黒カラーに変更
 * 2. TOC自動生成（新テンプレート記事のみ）＋FV画像注入
 * 3. 読書進捗バー追加
 *
 * 使い方: node scripts/patch-fv-image-and-x-style.mjs
 */
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR   = path.resolve('public');
const ARTICLES_DIR = path.resolve('data/articles');
const CATEGORIES   = ['gadget', 'game', 'outdoor'];

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

const OLD_QUOTE_CSS_V1 = `.reddit-quote { background: #fff8f8; border-left: 4px solid var(--red); border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: var(--red); text-decoration: none; }
    .reddit-voices h2 { border-left-color: #0f1419 !important; }

    /* ファーストビュー商品画像 */
    .fv-product-image { margin: 0 0 28px; text-align: center; }
    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }`;

const NEW_QUOTE_CSS_V1 = `.reddit-quote { background: #f7f9f9; border-left: 4px solid #0f1419; border-radius: 8px; padding: 16px 18px; margin: 20px 0; font-size: 0.9rem; line-height: 1.7; }
    .reddit-quote p { margin: 0 0 8px; }
    .reddit-quote cite { font-size: 0.76rem; color: var(--muted); font-style: normal; }
    .reddit-quote cite a { color: #0f1419; text-decoration: none; }
    .reddit-voices h2 { border-left-color: #0f1419 !important; }

    /* ファーストビュー商品画像 */
    .fv-product-image { margin: 0 0 28px; text-align: center; }
    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }`;

const PROGRESS_CSS = `\n    /* 読書進捗バー */\n    #reading-progress { position: fixed; top: 0; left: 0; width: 0%; height: 3px; background: var(--red); z-index: 9999; transition: width 0.15s; }`;

const PROGRESS_HTML = `<div id="reading-progress"></div>\n`;

const PROGRESS_JS = `  // 読書進捗バー
  (function() {
    var bar = document.getElementById('reading-progress');
    if (!bar) return;
    window.addEventListener('scroll', function() {
      var s = window.scrollY || window.pageYOffset;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (s / h) * 100 : 0) + '%';
    }, { passive: true });
  })();`;

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

    // ① Xカラーパッチ（未適用の旧形式）
    if (html.includes(OLD_QUOTE_CSS_V2)) {
      html = html.replace(OLD_QUOTE_CSS_V2, NEW_QUOTE_CSS_V2);
      changed = true;
    } else if (html.includes(OLD_QUOTE_CSS_V1)) {
      html = html.replace(OLD_QUOTE_CSS_V1, NEW_QUOTE_CSS_V1);
      changed = true;
    }

    // ② FV画像 + TOC（新テンプレート記事）
    const hasNewTemplate = !html.includes('class="toc"') && !html.includes('<nav class="toc"');
    if (!html.includes('fv-product-image') || (hasNewTemplate && !html.includes('<nav class="toc"'))) {
      // FV画像URLを取得
      let fvImage = null, fvName = '';
      if (fs.existsSync(researchPath)) {
        const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
        fvImage = research.products?.[0]?.images?.[0];
        fvName  = research.products?.[0]?.cleanName ?? '';
      }
      if (!fvImage) {
        const imgMatch = html.match(/<img[^>]+src="(\/images\/products\/[^"]+)"[^>]*alt="([^"]*)"[^>]*>/);
        if (imgMatch) { fvImage = imgMatch[1]; fvName = imgMatch[2]; }
      }

      if (fvImage) {
        if (hasNewTemplate) {
          // CSS追加
          if (!html.includes('.fv-product-image')) {
            html = html.replace('</style>', `    .fv-product-image { margin: 0 0 28px; text-align: center; }\n    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }\n  </style>`);
          }
          // H2にID付与
          let secIdx = 0;
          html = html.replace(/<h2([^>]*)>/g, (match, attrs) => {
            if (/id=/.test(attrs)) return match;
            secIdx++;
            return `<h2${attrs} id="sec-${secIdx}">`;
          });
          // TOC生成
          const h2Matches = [...html.matchAll(/<h2[^>]+id="(sec-\d+)"[^>]*>([\s\S]*?)<\/h2>/g)];
          if (h2Matches.length >= 2 && !html.includes('<nav class="toc"')) {
            const tocItems = h2Matches.map(([, id, inner]) => {
              const text = inner.replace(/<[^>]+>/g, '').trim();
              return `      <li><a href="#${id}">${text}</a></li>`;
            }).join('\n');
            const tocHtml = `<nav class="toc">\n  <div class="toc-title">📋 この記事の目次</div>\n  <ol>\n${tocItems}\n  </ol>\n</nav>`;
            const fvHtml = `<figure class="fv-product-image">\n  <img src="${fvImage}" alt="${fvName}" loading="eager">\n</figure>\n`;
            const before = html.length;
            html = html.replace(/(<h2[^>]+id="sec-1")/, `${fvHtml}${tocHtml}\n$1`);
            if (html.length !== before) changed = true;
          }
        } else {
          // 旧テンプレート：TOC直前にFV画像
          if (!html.includes('fv-product-image')) {
            if (!html.includes('.fv-product-image')) {
              html = html.replace('</style>', `    .fv-product-image { margin: 0 0 28px; text-align: center; }\n    .fv-product-image img { max-width: 480px; width: 100%; border-radius: 12px; object-fit: contain; max-height: 320px; }\n  </style>`);
            }
            const fvHtml = `<figure class="fv-product-image">\n  <img src="${fvImage}" alt="${fvName}" loading="eager">\n</figure>`;
            const before = html.length;
            html = html.replace(/(<(?:nav|div)[^>]*class="toc")/, `${fvHtml}\n$1`);
            if (html.length !== before) changed = true;
          }
        }
      }
    }

    // ③ 読書進捗バー
    if (!html.includes('reading-progress')) {
      // CSS
      html = html.replace('</style>', `${PROGRESS_CSS}\n  </style>`);
      // HTML
      html = html.replace('<script id="site-header-inject">', `${PROGRESS_HTML}<script id="site-header-inject">`);
      // JS（</script>の直前に追記）
      html = html.replace(/(\s*<\/script>\s*<\/body>)/, `\n${PROGRESS_JS}$1`);
      changed = true;
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
