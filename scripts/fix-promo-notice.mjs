import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'public');

const dirs = ['basics', 'shipping', 'safety', 'payment', 'tips', '.'];
const allFiles = [];

for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.html') && !['index.html', 'sitemap.html', 'admin.html', 'nav.html', 'template.html'].includes(f))
    .map(f => path.join(dirPath, f));
  allFiles.push(...files);
}

const NOTICE = '<p class="promo-notice">本ページはプロモーションが含まれています</p>';

let changed = 0;
let skipped = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // 1. Remove "※ AliExpressリンクはアフィリエイトリンクです" lines
  content = content.replace(/\n?\s*<p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです<\/p>/g, '');

  // 2. Add promo notice after meta div closing tag (if not already present)
  if (!content.includes('本ページはプロモーションが含まれています')) {
    // Try A: after 読了 span (covers 読了約 and 読了目安：)
    let next = content.replace(
      /(<span>読了[^<]*<\/span>)(\s*<\/div>)/,
      `$1$2\n${NOTICE}`
    );

    if (next === content) {
      // Try B: after meta div - match last </span></div> in meta block
      // Find <div class="meta">...</div> and insert after closing </div>
      next = content.replace(
        /(<div class="meta">[\s\S]*?<\/div>)/,
        `$1\n${NOTICE}`
      );
    }

    if (next === content) {
      // Try C: after first </h1> in the file as final fallback
      next = content.replace('</h1>', `</h1>\n${NOTICE}`);
    }

    content = next;
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ ${path.relative(root, file)}`);
    changed++;
  } else {
    console.log(`⏭ ${path.relative(root, file)} (変更なし)`);
    skipped++;
  }
}

console.log(`\n📝 ${changed}件更新 / ${skipped}件スキップ`);
