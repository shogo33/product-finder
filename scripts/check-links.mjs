import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

function walk(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const full = path.join(dir, f);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (f.endsWith('.html')) files.push(full);
  }
  return files;
}

const ROOT = process.cwd();
const htmlFiles = walk(path.join(ROOT, 'public'));
const exists = new Set(htmlFiles.map(f => '/' + path.relative(path.join(ROOT, 'public'), f).replace(/\\/g, '/')));

const errors = [];
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  const matches = content.matchAll(/href="(\/[^"#?]+\.html)"/g);
  for (const m of matches) {
    const href = m[1];
    if (!exists.has(href)) {
      errors.push({ from: path.relative(path.join(ROOT, 'public'), file).replace(/\\/g, '/'), href });
    }
  }
}

if (errors.length === 0) {
  console.log('✅ リンク切れなし');
} else {
  const seen = new Set();
  for (const e of errors) {
    if (!seen.has(e.href)) {
      seen.add(e.href);
      console.log('❌ BROKEN: ' + e.href + '  (参照元: ' + e.from + ')');
    }
  }
  process.exit(1);
}
