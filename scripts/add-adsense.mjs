import fs from 'fs';
import path from 'path';

const ADSENSE_TAG = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6858217811913334" crossorigin="anonymous"></script>`;

const SKIP = new Set(['admin.html', 'preview.html', 'template.html', 'nav.html']);
const base = path.resolve('public');
let updated = 0;

function getAllHtmlFiles(dir) {
  const files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) files.push(...getAllHtmlFiles(path.join(dir, e.name)));
    else if (e.name.endsWith('.html')) files.push(path.join(dir, e.name));
  });
  return files;
}

for (const file of getAllHtmlFiles(base)) {
  const basename = path.basename(file);
  const rel = path.relative(base, file).replace(/\\/g, '/');
  if (SKIP.has(basename)) continue;

  let html = fs.readFileSync(file, 'utf8');

  if (html.includes('adsbygoogle.js')) {
    console.log(`⏭  skip (already has AdSense): ${rel}`);
    continue;
  }

  html = html.replace('</head>', `  ${ADSENSE_TAG}\n</head>`);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${rel}`);
  updated++;
}

console.log(`\n💾 ${updated}件更新`);
