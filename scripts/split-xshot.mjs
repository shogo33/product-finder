/**
 * X スクショを 20 分割して public/x-data/split-<slug>/ に保存
 * 使い方: node scripts/split-xshot.mjs <slug> <画像ファイル名（rawフォルダ内）>
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';

const ROOT  = 'c:/Users/USER/product-finder';
const RAW   = path.join(ROOT, 'public/x-data/raw');
const PARTS = 20;

const [,, slug, filename] = process.argv;
if (!slug || !filename) {
  console.error('Usage: node scripts/split-xshot.mjs <slug> <filename>');
  process.exit(1);
}

const src  = path.join(RAW, filename);
const dest = path.join(ROOT, 'public/x-data/split-' + slug);
mkdirSync(dest, { recursive: true });

const meta = await sharp(src).metadata();
const chunkH = Math.ceil(meta.height / PARTS);

for (let i = 0; i < PARTS; i++) {
  const top  = i * chunkH;
  const h    = Math.min(chunkH, meta.height - top);
  if (h <= 0) break;
  const out  = path.join(dest, String(i + 1).padStart(2, '0') + '.png');
  await sharp(src).extract({ left: 0, top, width: meta.width, height: h }).toFile(out);
}
console.log(`✅ ${PARTS} 分割完了 → ${dest}`);
